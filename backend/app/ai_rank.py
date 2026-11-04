"""Smart priority with AI: score unread chats from opted-in contacts and spot tasks.

Flow: a new message to an opted-in chat -> enqueue the receiver (debounced, Redis sorted set)
-> the worker claims the user -> one LLM call per batch of changed chats -> results stored encrypted
-> "ranking.updated" pushed to the user. Only UNREAD messages of contacts the user picked in Settings
are ever sent; external contacts never are.
"""
import json
import logging
import secrets
import time
import uuid

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from . import crypto, llm, pa
from .config import settings
from .db import SessionLocal
from .deps import redis
from .models import ChatPriority, Contact, Conversation, Message, User
from .realtime import publish
from .security import utcnow

log = logging.getLogger("smart.ai_rank")
QUEUE = "rank:queue"
RELATION = {"fr": "Friend", "pro": "Professional", "fam": "Family", "rel": "Relative"}


async def enqueue(user_id: uuid.UUID, delay: float | None = None) -> None:
    # LT: only moves the run time earlier, so a burst of messages still runs within one debounce window.
    when = time.time() + (settings.rank_debounce_seconds if delay is None else delay)
    await redis.zadd(QUEUE, {str(user_id): when}, lt=True)


def payload(p: ChatPriority | None, wrapped: bytes) -> dict:
    if not p:
        return {"reason": "", "suggestions": []}
    return json.loads(crypto.decrypt(p.owner_id, wrapped, p.nonce, p.ciphertext))


def seal(owner_id: uuid.UUID, wrapped: bytes, data: dict) -> tuple[bytes, bytes]:
    return crypto.encrypt(owner_id, wrapped, json.dumps(data, ensure_ascii=False))


async def forget(db: AsyncSession, owner_id: uuid.UUID, conv_ids: list[uuid.UUID] | None = None) -> None:
    """Delete stored AI results (all, or for some chats) when permission is turned off."""
    q = delete(ChatPriority).where(ChatPriority.owner_id == owner_id)
    if conv_ids is not None:
        q = q.where(ChatPriority.conversation_id.in_(conv_ids))
    await db.execute(q)


async def save_suggestions(db: AsyncSession, owner_id: uuid.UUID, conv_id: uuid.UUID, fn) -> None:
    """Edit the stored suggestions list with fn(list) -> list."""
    p = await db.get(ChatPriority, (owner_id, conv_id))
    if not p:
        return
    wrapped = await pa.user_key(db, owner_id)
    data = payload(p, wrapped)
    data["suggestions"] = fn(data.get("suggestions", []))
    p.nonce, p.ciphertext = seal(owner_id, wrapped, data)


def _first(n: str) -> str:
    return n.replace("(", " ").split()[0]


async def score_user(user_id: uuid.UUID) -> int:
    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        if not user or not user.ai_rank_enabled:
            return 0
        contacts = {k.contact_id: k for k in (await db.execute(
            select(Contact).where(Contact.owner_id == user_id, Contact.ai_rank.is_(True), Contact.category != "ext")
        )).scalars()}
        if not contacts:
            return 0
        convs = (await db.execute(select(Conversation).where(or_(
            and_(Conversation.user_a_id == user_id, Conversation.user_b_id.in_(contacts)),
            and_(Conversation.user_b_id == user_id, Conversation.user_a_id.in_(contacts)),
        )))).scalars().all()

        tz = pa.valid_tz(user.tz)
        z = pa.zone(tz)
        now_local = utcnow().astimezone(z)
        jobs = []
        for c in convs:
            pid = c.user_b_id if c.user_a_id == user_id else c.user_a_id
            unread = list((await db.execute(
                select(Message).where(Message.conversation_id == c.id, Message.sender_id == pid, Message.read_at.is_(None))
                .order_by(Message.id.desc()).limit(settings.rank_unread_messages)
            )).scalars())
            if not unread:
                continue
            prio = await db.get(ChatPriority, (user_id, c.id))
            if prio and prio.urgency is not None and prio.last_message_id >= unread[0].id:
                continue  # already scored this batch
            jobs.append((c, pid, list(reversed(unread)), prio))
        if not jobs:
            return 0

        names = dict((await db.execute(select(User.id, User.name).where(User.id.in_([j[1] for j in jobs])))).all())
        wrapped = await pa.user_key(db, user_id)
        scored = 0
        for start in range(0, len(jobs), settings.rank_batch_chats):
            batch = jobs[start:start + settings.rank_batch_chats]
            chats = [{
                "id": f"c{i}", "name": _first(names[pid]), "relation": RELATION.get(contacts[pid].category, "Contact"),
                "messages": [{"local": m.created_at.astimezone(z), "text": crypto.decrypt(c.id, c.wrapped_key, m.nonce, m.ciphertext)}
                             for m in msgs],
            } for i, (c, pid, msgs, _) in enumerate(batch)]
            try:
                result = await llm.rank_chats(me=_first(user.name), chats=chats, now=now_local)
            except llm.LLMUnavailable as e:
                log.warning("ranking skipped: %s", e)  # status only, never message text
                continue

            for i, (c, pid, msgs, prio) in enumerate(batch):
                r = result.get(f"c{i}")
                if not r:
                    continue
                try:
                    urgency = max(0, min(int(r.get("urgency")), 100))
                except (TypeError, ValueError):
                    continue
                old = payload(prio, wrapped).get("suggestions", [])
                seen = {s["draft"]["title"].lower() for s in old}
                for t in (r.get("tasks") or [])[:2]:
                    if not isinstance(t, dict):
                        continue
                    draft, assumed = pa.draft_from_llm(t, now_local)
                    if draft["title"].lower() in seen:
                        continue
                    seen.add(draft["title"].lower())
                    quote = pa._clean(t.get("quote"), 200)
                    draft.update(source="chat", source_text=quote, tz=tz, conversation_id=str(c.id))
                    old.append({"id": secrets.token_hex(6), "draft": draft, "assumed": assumed, "quote": quote})
                nonce, ct = seal(user_id, wrapped, {"reason": pa._clean(r.get("reason"), 80), "suggestions": old[-5:]})
                values = dict(urgency=urgency, nonce=nonce, ciphertext=ct, last_message_id=msgs[-1].id, scored_at=utcnow())
                await db.execute(pg_insert(ChatPriority).values(owner_id=user_id, conversation_id=c.id, **values)
                                 .on_conflict_do_update(index_elements=["owner_id", "conversation_id"], set_=values))
                scored += 1
        await db.commit()
    if scored:
        await publish(user_id, {"type": "ranking.updated"})
    return scored


async def tick() -> int:
    due = await redis.zrangebyscore(QUEUE, 0, time.time(), start=0, num=20)
    n = 0
    for uid in due:
        if await redis.zrem(QUEUE, uid):  # claimed by this process
            try:
                n += await score_user(uuid.UUID(uid))
            except Exception:
                log.exception("ranking failed for one user")
    return n
