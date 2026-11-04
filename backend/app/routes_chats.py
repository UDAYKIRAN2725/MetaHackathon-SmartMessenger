import uuid
from collections import defaultdict
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from . import ai_rank, crypto, pa, ranking
from .config import settings
from .db import get_db
from .deps import current_user, redis
from .models import ChatActivity, ChatPriority, Contact, Conversation, Message, User
from .realtime import publish
from .security import norm_email, norm_phone, utcnow

router = APIRouter(prefix="/api", tags=["chats"])

Category = Literal["fr", "pro", "fam", "rel", "ext"]


# ---------- helpers ----------

def partner_id(c: Conversation, me: uuid.UUID) -> uuid.UUID:
    return c.user_b_id if c.user_a_id == me else c.user_a_id


def msg_out(c: Conversation, m: Message, me: uuid.UUID) -> dict:
    return {
        "id": m.id,
        "conversation_id": str(m.conversation_id),
        "sender_id": str(m.sender_id),
        "from_me": m.sender_id == me,
        "text": crypto.decrypt(c.id, c.wrapped_key, m.nonce, m.ciphertext),
        "created_at": m.created_at,
        "delivered_at": m.delivered_at,
        "read_at": m.read_at,
    }


async def my_conversation(db: AsyncSession, conv_id: uuid.UUID, me: uuid.UUID) -> Conversation:
    c = await db.get(Conversation, conv_id)
    if not c or me not in (c.user_a_id, c.user_b_id):
        raise HTTPException(404, "Conversation not found.")
    return c


def mine(me: uuid.UUID):
    return or_(Conversation.user_a_id == me, Conversation.user_b_id == me)


async def mark_delivered(db: AsyncSession, me: uuid.UUID, ids: list[int] | None = None) -> None:
    """Sets delivered_at on messages sent *to* me and tells each sender. ids=None means all pending."""
    my_convs = select(Conversation.id).where(mine(me))
    q = (
        update(Message)
        .where(Message.conversation_id.in_(my_convs), Message.sender_id != me, Message.delivered_at.is_(None))
        .values(delivered_at=utcnow())
        .returning(Message.id, Message.conversation_id, Message.sender_id, Message.delivered_at)
    )
    if ids is not None:
        q = q.where(Message.id.in_(ids[:500]))
    rows = (await db.execute(q)).all()
    await db.commit()
    groups: dict[tuple, list[int]] = defaultdict(list)
    at = {}
    for mid, cid, sid, d in rows:
        groups[(cid, sid)].append(mid)
        at[(cid, sid)] = d
    for (cid, sid), mids in groups.items():
        await publish(sid, {"type": "message.delivered", "conversation_id": str(cid), "ids": mids, "at": at[(cid, sid)]})


async def build_items(db: AsyncSession, me: uuid.UUID, convs: list[Conversation]) -> tuple[list[dict], float]:
    if not convs:
        return [], 0.0
    ids = [c.id for c in convs]
    pids = [partner_id(c, me) for c in convs]
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(pids)))).scalars()}
    contacts = {
        k.contact_id: k
        for k in (await db.execute(select(Contact).where(Contact.owner_id == me, Contact.contact_id.in_(pids)))).scalars()
    }
    last = {
        m.conversation_id: m
        for m in (
            await db.execute(
                select(Message).where(Message.conversation_id.in_(ids))
                .distinct(Message.conversation_id).order_by(Message.conversation_id, Message.id.desc())
            )
        ).scalars()
    }
    unread_rows = (await db.execute(
        select(Message.conversation_id, func.count(), func.max(Message.id))
        .where(Message.conversation_id.in_(ids), Message.sender_id != me, Message.read_at.is_(None))
        .group_by(Message.conversation_id)
    )).all()
    unread = {cid: n for cid, n, _ in unread_rows}
    newest_unread = {cid: mx for cid, _, mx in unread_rows}
    stats, top = await ranking.compute(db, me, ids)

    # Smart priority with AI: only for contacts the user picked in Settings, and only while unread.
    owner = await db.get(User, me)
    master = bool(owner and owner.ai_rank_enabled)
    prios = {p.conversation_id: p for p in (await db.execute(
        select(ChatPriority).where(ChatPriority.owner_id == me, ChatPriority.conversation_id.in_(ids))
    )).scalars()}
    wrapped = await pa.user_key(db, me) if prios else None
    # Transparency: does the other person let AI read *my* unread messages to them?
    theirs = {k.owner_id: k for k in (await db.execute(
        select(Contact).where(Contact.contact_id == me, Contact.owner_id.in_(pids), Contact.ai_rank.is_(True))
    )).scalars()}

    items = []
    needs_rank = False
    for c in convs:
        p = users[partner_id(c, me)]
        k = contacts.get(p.id)
        m = last.get(c.id)
        ai_rank_on = bool(master and k and k.ai_rank and k.category != "ext")
        prio = prios.get(c.id)
        data = ai_rank.payload(prio, wrapped) if prio else {"reason": "", "suggestions": []}
        n_unread = unread.get(c.id, 0)
        habit = stats[c.id].score
        urgency = prio.urgency if (ai_rank_on and prio and n_unread and prio.urgency is not None) else None
        if urgency is None:
            final = habit
        else:
            final = urgency if habit is None else round(habit + settings.rank_weight * (urgency - habit))
        if ai_rank_on and n_unread and (urgency is None or prio.last_message_id < newest_unread.get(c.id, 0)):
            needs_rank = True
        items.append({
            "ai_rank": ai_rank_on,
            "llm": {"urgency": urgency, "reason": data.get("reason", "")} if urgency is not None else None,
            "final": final,
            "suggestions": len(data.get("suggestions", [])),
            "partner_ai_rank": p.id in theirs and p.ai_rank_enabled,
            "id": str(c.id),
            "partner": {"id": str(p.id), "name": p.name, "email": p.email, "phone": p.phone},
            "category": k.category if k else "ext",
            "ai_allowed": bool(k and k.ai_allowed),
            "last": msg_out(c, m, me) if m else None,
            "last_message_at": c.last_message_at or c.created_at,
            "unread": unread.get(c.id, 0),
            "stats": stats[c.id].as_dict(),
        })
    if needs_rank:
        await ai_rank.enqueue(me, delay=2)  # self-heals after restarts or a Redis flush
    return items, top


def sort_items(items: list[dict], sort: str) -> list[dict]:
    recent = lambda i: i["last_message_at"].timestamp()  # noqa: E731
    if sort == "recent":
        return sorted(items, key=recent, reverse=True)
    # Smart: unread first, then final score (habit, shifted by AI for opted-in chats; unscored last), then newest.
    return sorted(items, key=lambda i: (i["unread"] == 0, i["final"] is None, -(i["final"] or 0), -recent(i)))


# ---------- conversations ----------

@router.get("/conversations")
async def list_conversations(sort: Literal["smart", "recent"] = "smart", tz: str = Query("", max_length=64),
                             user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if tz and pa.valid_tz(tz) == tz and user.tz != tz:
        user.tz = tz  # used to resolve "today" / "4 PM" in automatically found tasks
        await db.commit()
    await mark_delivered(db, user.id)  # opening the app delivers everything pending
    has_msgs = select(Message.id).where(Message.conversation_id == Conversation.id).exists()
    convs = list((await db.execute(
        select(Conversation).where(mine(user.id), or_(has_msgs, Conversation.created_by == user.id))
    )).scalars())
    items, top = await build_items(db, user.id, convs)
    return {
        "items": sort_items(items, sort),
        "meta": {"top_min_per_day": round(top, 1), "window_days": settings.ranking_window_days,
                 "min_tracked": settings.min_tracked_for_score},
    }


class StartIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    category: Category = "fr"


@router.post("/conversations")
async def start_conversation(body: StartIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ident = body.identifier.strip()
    cond = User.email == norm_email(ident) if "@" in ident else User.phone == norm_phone(ident)
    other = (await db.execute(select(User).where(cond))).scalar_one_or_none()
    if not other:
        raise HTTPException(404, "No Smart Messenger user has that email or phone number.")
    if other.id == user.id:
        raise HTTPException(400, "You can’t start a chat with yourself.")

    a, b = sorted([user.id, other.id])
    conv = (await db.execute(select(Conversation).where(Conversation.user_a_id == a, Conversation.user_b_id == b))).scalar_one_or_none()
    if not conv:
        cid = uuid.uuid4()
        conv = Conversation(id=cid, user_a_id=a, user_b_id=b, created_by=user.id, wrapped_key=crypto.new_wrapped_key(cid))
        db.add(conv)
        await db.flush()

    # I chose a category for them; they see me as External until they save me.
    await db.execute(
        pg_insert(Contact).values(owner_id=user.id, contact_id=other.id, category=body.category,
                                  ai_allowed=False).on_conflict_do_nothing()
    )
    await db.execute(
        pg_insert(Contact).values(owner_id=other.id, contact_id=user.id, category="ext", ai_allowed=False)
        .on_conflict_do_nothing()
    )
    await db.commit()
    items, _ = await build_items(db, user.id, [conv])
    return items[0]


class ContactPatch(BaseModel):
    category: Category | None = None
    ai_allowed: bool | None = None


@router.patch("/contacts/{contact_id}")
async def update_contact(contact_id: uuid.UUID, body: ContactPatch, user: User = Depends(current_user),
                         db: AsyncSession = Depends(get_db)):
    k = await db.get(Contact, (user.id, contact_id))
    if not k:
        raise HTTPException(404, "Contact not found.")
    if body.category is not None:
        k.category = body.category
    if body.ai_allowed is not None:
        k.ai_allowed = body.ai_allowed
    if k.category == "ext" and k.ai_allowed:
        raise HTTPException(400, "Save this contact in a category before allowing AI.")
    await db.commit()
    return {"contact_id": str(contact_id), "category": k.category, "ai_allowed": k.ai_allowed}


# ---------- messages ----------

@router.get("/conversations/{conv_id}/messages")
async def list_messages(conv_id: uuid.UUID, before: int | None = None, limit: int = Query(50, ge=1, le=100),
                        user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    c = await my_conversation(db, conv_id, user.id)
    q = select(Message).where(Message.conversation_id == c.id)
    if before:
        q = q.where(Message.id < before)
    rows = list((await db.execute(q.order_by(Message.id.desc()).limit(limit + 1))).scalars())
    has_more = len(rows) > limit
    rows = list(reversed(rows[:limit]))
    return {"items": [msg_out(c, m, user.id) for m in rows], "has_more": has_more}


class SendIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)

    @field_validator("text")
    @classmethod
    def _text(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message is empty.")
        return v.strip()


@router.post("/conversations/{conv_id}/messages", status_code=201)
async def send_message(conv_id: uuid.UUID, body: SendIn, user: User = Depends(current_user),
                       db: AsyncSession = Depends(get_db)):
    c = await my_conversation(db, conv_id, user.id)
    nonce, ct = crypto.encrypt(c.id, c.wrapped_key, body.text)
    m = Message(conversation_id=c.id, sender_id=user.id, nonce=nonce, ciphertext=ct, created_at=utcnow())
    db.add(m)
    c.last_message_at = m.created_at
    await db.commit()
    await db.refresh(m)
    out = msg_out(c, m, user.id)
    event = {"type": "message.new", "message": {**out, "from_me": None}}
    pid = partner_id(c, user.id)
    await publish(pid, event)
    await publish(user.id, event)  # other tabs of the sender
    # If the receiver opted in to AI priority for me, score their unread batch (debounced).
    rcv = await db.get(User, pid)
    k = await db.get(Contact, (pid, user.id))
    if rcv and rcv.ai_rank_enabled and k and k.ai_rank and k.category != "ext":
        await ai_rank.enqueue(pid)
    return out


@router.post("/conversations/{conv_id}/read")
async def mark_read(conv_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    c = await my_conversation(db, conv_id, user.id)
    now = utcnow()
    rows = (await db.execute(
        update(Message)
        .where(Message.conversation_id == c.id, Message.sender_id != user.id, Message.read_at.is_(None))
        .values(read_at=now, delivered_at=func.coalesce(Message.delivered_at, now))
        .returning(Message.id)
    )).scalars().all()
    # Read chats go back to habit order; found task suggestions are kept until accepted or ignored.
    await db.execute(update(ChatPriority).where(ChatPriority.owner_id == user.id, ChatPriority.conversation_id == c.id)
                     .values(urgency=None))
    await db.commit()
    if rows:
        event = {"type": "message.read", "conversation_id": str(c.id), "ids": list(rows), "at": now}
        await publish(partner_id(c, user.id), event)
        await publish(user.id, event)
    return {"ids": list(rows)}


@router.post("/conversations/{conv_id}/heartbeat")
async def heartbeat(conv_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Called every HEARTBEAT seconds while the chat is open and the tab is visible."""
    c = await my_conversation(db, conv_id, user.id)
    sec = settings.heartbeat_seconds
    # At most one counted beat per window, even with several tabs open.
    if not await redis.set(f"hb:{user.id}:{c.id}", 1, nx=True, ex=max(sec - 2, 1)):
        return {"counted": False}
    stmt = pg_insert(ChatActivity).values(user_id=user.id, conversation_id=c.id, day=utcnow().date(), seconds=sec)
    await db.execute(stmt.on_conflict_do_update(
        index_elements=["user_id", "conversation_id", "day"],
        set_={"seconds": ChatActivity.seconds + sec},
    ))
    await db.commit()
    return {"counted": True}
