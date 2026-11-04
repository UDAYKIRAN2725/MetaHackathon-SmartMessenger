"""Settings for Smart priority with AI, and the task suggestions it finds."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from . import ai_rank, pa
from .db import get_db
from .deps import current_user
from .models import ChatPriority, Contact, Conversation, User
from .realtime import publish
from .routes_chats import my_conversation, partner_id

router = APIRouter(prefix="/api", tags=["smart-priority"])


async def _settings_out(db: AsyncSession, user: User) -> dict:
    rows = (await db.execute(
        select(Contact, User.name).join(User, User.id == Contact.contact_id).where(Contact.owner_id == user.id)
        .order_by(User.name)
    )).all()
    return {
        "enabled": user.ai_rank_enabled,
        "contacts": [{"contact_id": str(k.contact_id), "name": name, "category": k.category,
                      "allowed": bool(k.ai_rank and k.category != "ext")} for k, name in rows],
    }


async def _conv_ids(db: AsyncSession, me: uuid.UUID, partners: list[uuid.UUID]) -> list[uuid.UUID]:
    pairs = [tuple(sorted([me, p])) for p in partners]
    if not pairs:
        return []
    q = select(Conversation.id).where(or_(*[(Conversation.user_a_id == a) & (Conversation.user_b_id == b) for a, b in pairs]))
    return list((await db.execute(q)).scalars())


class EnabledIn(BaseModel):
    enabled: bool


class ContactsIn(BaseModel):
    contact_ids: list[uuid.UUID] = Field(max_length=1000)
    allowed: bool


@router.get("/settings/ai-rank")
async def get_settings(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await _settings_out(db, user)


@router.patch("/settings/ai-rank")
async def set_enabled(body: EnabledIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    user.ai_rank_enabled = body.enabled
    if not body.enabled:
        await ai_rank.forget(db, user.id)  # off means off: stored AI results are deleted
    await db.commit()
    if body.enabled:
        await ai_rank.enqueue(user.id, delay=0)
    await publish(user.id, {"type": "ranking.updated"})
    return await _settings_out(db, user)


@router.patch("/settings/ai-rank/contacts")
async def set_contacts(body: ContactsIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ks = (await db.execute(select(Contact).where(Contact.owner_id == user.id, Contact.contact_id.in_(body.contact_ids)))).scalars().all()
    if body.allowed and any(k.category == "ext" for k in ks) and len(ks) == 1:
        raise HTTPException(400, "Save this contact in a category first. External contacts are never sent to the AI.")
    changed = []
    for k in ks:
        if k.category == "ext":
            continue
        k.ai_rank = body.allowed
        changed.append(k.contact_id)
    if not body.allowed:
        await ai_rank.forget(db, user.id, await _conv_ids(db, user.id, changed))
    await db.commit()
    if body.allowed and user.ai_rank_enabled:
        await ai_rank.enqueue(user.id, delay=0)
    await publish(user.id, {"type": "ranking.updated"})
    return await _settings_out(db, user)


# ---------- task suggestions found automatically ----------

@router.get("/suggestions")
async def all_suggestions(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    prios = (await db.execute(select(ChatPriority).where(ChatPriority.owner_id == user.id))).scalars().all()
    if not prios:
        return {"items": []}
    wrapped = await pa.user_key(db, user.id)
    convs = {c.id: c for c in (await db.execute(
        select(Conversation).where(Conversation.id.in_([p.conversation_id for p in prios])))).scalars()}
    names = dict((await db.execute(select(User.id, User.name).where(
        User.id.in_([partner_id(c, user.id) for c in convs.values()])))).all())
    out = []
    for p in prios:
        for s in ai_rank.payload(p, wrapped).get("suggestions", []):
            out.append({**s, "chat_name": names.get(partner_id(convs[p.conversation_id], user.id), "")})
    return {"items": out}


@router.get("/conversations/{conv_id}/suggestions")
async def chat_suggestions(conv_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    c = await my_conversation(db, conv_id, user.id)
    p = await db.get(ChatPriority, (user.id, c.id))
    if not p:
        return {"items": []}
    return {"items": ai_rank.payload(p, await pa.user_key(db, user.id)).get("suggestions", [])}


@router.post("/conversations/{conv_id}/suggestions/{sid}/dismiss")
async def dismiss_suggestion(conv_id: uuid.UUID, sid: str, user: User = Depends(current_user),
                             db: AsyncSession = Depends(get_db)):
    """Called after the user adds (or ignores) a suggestion, so it isn't shown again."""
    c = await my_conversation(db, conv_id, user.id)
    await ai_rank.save_suggestions(db, user.id, c.id, lambda lst: [s for s in lst if s.get("id") != sid])
    await db.commit()
    await publish(user.id, {"type": "ranking.updated"})
    return {"ok": True}
