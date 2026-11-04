"""Memory: notes about contacts and 'My rules'. All text is encrypted with the owner's key.
Approved notes and matching rules are added to AI-assist prompts; suggested notes are not used until approved."""
import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from . import llm, memory, pa
from .config import settings
from .db import get_db
from .deps import current_user, rate_limit
from .memory import note_out, rule_out, seal, unseal
from .models import Contact, Conversation, Message, MemoryNote, MemoryRule, User
from .routes_chats import msg_out, my_conversation, partner_id

router = APIRouter(prefix="/api", tags=["memory"])

Tag = Literal["Role", "Preference", "Fact", "Language", "Date", "Note"]
RuleType = Literal["tone", "language", "avoid", "culture"]
Target = Literal["all", "fr", "pro", "fam", "rel"]


def _text(v: str | None) -> str | None:
    if v is None:
        return v
    v = re.sub(r"\s+", " ", v).strip()
    if not v:
        raise ValueError("Write something first.")
    return v


class NoteIn(BaseModel):
    tag: Tag = "Note"
    text: str = Field(min_length=1, max_length=300)

    @field_validator("text")
    @classmethod
    def _t(cls, v: str) -> str:
        return _text(v)


class NotePatch(BaseModel):
    tag: Tag | None = None
    text: str | None = Field(None, min_length=1, max_length=300)

    @field_validator("text")
    @classmethod
    def _t(cls, v: str | None) -> str | None:
        return _text(v)


class RuleIn(BaseModel):
    type: RuleType
    text: str = Field(min_length=1, max_length=200)
    applies: list[Target] = Field(min_length=1, max_length=5)

    @field_validator("text")
    @classmethod
    def _t(cls, v: str) -> str:
        return _text(v)


async def _contact(db: AsyncSession, owner: uuid.UUID, contact_id: uuid.UUID) -> Contact:
    k = await db.get(Contact, (owner, contact_id))
    if not k:
        raise HTTPException(404, "Contact not found.")
    return k


async def _note(db: AsyncSession, owner: uuid.UUID, note_id: int) -> MemoryNote:
    n = await db.get(MemoryNote, note_id)
    if not n or n.owner_id != owner:
        raise HTTPException(404, "Note not found.")
    return n


async def _conv_id(db: AsyncSession, a: uuid.UUID, b: uuid.UUID) -> str | None:
    x, y = sorted([a, b])
    cid = (await db.execute(select(Conversation.id).where(Conversation.user_a_id == x, Conversation.user_b_id == y))).scalar()
    return str(cid) if cid else None


# ---------- people ----------

@router.get("/memory/people")
async def people(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Contact, User.name).join(User, User.id == Contact.contact_id)
        .where(Contact.owner_id == user.id, Contact.category != "ext").order_by(User.name)
    )).all()
    counts = {}
    for cid, status, n in (await db.execute(
        select(MemoryNote.contact_id, MemoryNote.status, func.count()).where(MemoryNote.owner_id == user.id)
        .group_by(MemoryNote.contact_id, MemoryNote.status)
    )).all():
        counts.setdefault(cid, {})[status] = n
    return {"items": [{
        "contact_id": str(k.contact_id), "name": name, "category": k.category, "ai_allowed": k.ai_allowed,
        "notes": counts.get(k.contact_id, {}).get("approved", 0),
        "suggested": counts.get(k.contact_id, {}).get("suggested", 0),
    } for k, name in rows]}


@router.get("/memory/people/{contact_id}")
async def person(contact_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    k = await _contact(db, user.id, contact_id)
    other = await db.get(User, contact_id)
    wrapped = await pa.user_key(db, user.id)
    notes = (await db.execute(select(MemoryNote).where(MemoryNote.owner_id == user.id, MemoryNote.contact_id == contact_id)
                              .order_by(MemoryNote.id))).scalars().all()
    return {
        "contact_id": str(contact_id), "name": other.name, "category": k.category, "ai_allowed": k.ai_allowed,
        "conversation_id": await _conv_id(db, user.id, contact_id),
        "notes": [note_out(n, unseal(user.id, wrapped, n)) for n in notes],
    }


@router.post("/memory/people/{contact_id}/notes", status_code=201)
async def add_note(contact_id: uuid.UUID, body: NoteIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await _contact(db, user.id, contact_id)
    n_existing = (await db.execute(select(func.count()).where(MemoryNote.owner_id == user.id,
                                                              MemoryNote.contact_id == contact_id))).scalar()
    if n_existing >= memory.MAX_NOTES_PER_CONTACT:
        raise HTTPException(400, "Too many notes for this contact. Delete some first.")
    wrapped = await pa.user_key(db, user.id)
    nonce, ct = seal(user.id, wrapped, {"text": body.text, "src": "Added by you"})
    n = MemoryNote(owner_id=user.id, contact_id=contact_id, tag=body.tag, status="approved", source="you",
                   nonce=nonce, ciphertext=ct, created_at=pa.utcnow())
    db.add(n)
    await db.commit()
    return note_out(n, {"text": body.text, "src": "Added by you"})


@router.patch("/memory/notes/{note_id}")
async def edit_note(note_id: int, body: NotePatch, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    n = await _note(db, user.id, note_id)
    wrapped = await pa.user_key(db, user.id)
    d = unseal(user.id, wrapped, n)
    if body.text is not None:
        d["text"] = body.text
        if n.source == "chat":
            d["src"] = (d.get("src", "") + " · edited by you").strip(" ·")
    if body.tag is not None:
        n.tag = body.tag
    n.nonce, n.ciphertext = seal(user.id, wrapped, d)
    await db.commit()
    return note_out(n, d)


@router.post("/memory/notes/{note_id}/approve")
async def approve_note(note_id: int, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    n = await _note(db, user.id, note_id)
    wrapped = await pa.user_key(db, user.id)
    d = unseal(user.id, wrapped, n)
    if n.status != "approved":
        n.status = "approved"
        d["src"] = (d.get("src") or "Suggested from chat") + " · approved by you"
        n.nonce, n.ciphertext = seal(user.id, wrapped, d)
        await db.commit()
    return note_out(n, d)


@router.delete("/memory/notes/{note_id}", status_code=204)
async def delete_note(note_id: int, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await db.delete(await _note(db, user.id, note_id))
    await db.commit()
    return Response(status_code=204)


@router.delete("/memory/people/{contact_id}/notes", status_code=204)
async def delete_all(contact_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(MemoryNote).where(MemoryNote.owner_id == user.id, MemoryNote.contact_id == contact_id))
    await db.commit()
    return Response(status_code=204)


@router.post("/memory/people/{contact_id}/suggest")
async def suggest(contact_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """AI reads the last 20 messages with this contact and proposes notes. They're stored as 'suggested'
    and are never used until you approve them. Needs AI assist permission for the chat."""
    k = await _contact(db, user.id, contact_id)
    if k.category == "ext" or not k.ai_allowed:
        raise HTTPException(403, "AI isn’t allowed for this chat. Turn on AI assist for this contact first.")
    cid = await _conv_id(db, user.id, contact_id)
    if not cid:
        raise HTTPException(400, "No chat with this contact yet.")
    await rate_limit(f"pa:{user.id}", settings.pa_rate_per_minute)
    c = await my_conversation(db, uuid.UUID(cid), user.id)
    rows = list((await db.execute(select(Message).where(Message.conversation_id == c.id)
                                  .order_by(Message.id.desc()).limit(20))).scalars())
    history = [msg_out(c, m, user.id) for m in reversed(rows)]
    wrapped = await pa.user_key(db, user.id)
    existing_rows = (await db.execute(select(MemoryNote).where(MemoryNote.owner_id == user.id,
                                                               MemoryNote.contact_id == contact_id))).scalars().all()
    existing = [unseal(user.id, wrapped, n)["text"] for n in existing_rows]
    other = await db.get(User, partner_id(c, user.id))
    first = lambda s: s.replace("(", " ").split()[0]  # noqa: E731
    try:
        found = await llm.suggest_memories(me=first(user.name), them=first(other.name), history=history, existing=existing)
    except llm.LLMUnavailable as e:
        raise HTTPException(503, str(e))

    seen = {e.lower() for e in existing}
    added = []
    for f in found[:3]:
        text = pa._clean(f.get("text"), 120)
        if not text or text.lower() in seen:
            continue
        seen.add(text.lower())
        tag = f.get("tag") if f.get("tag") in memory.TAGS else "Fact"
        quote = pa._clean(f.get("quote"), 120)
        d = {"text": text, "src": f"Suggested from chat{f': “{quote}”' if quote else ''}"}
        nonce, ct = seal(user.id, wrapped, d)
        n = MemoryNote(owner_id=user.id, contact_id=contact_id, tag=tag, status="suggested", source="chat",
                       nonce=nonce, ciphertext=ct, created_at=pa.utcnow())
        db.add(n)
        added.append((n, d))
    await db.commit()
    return {"items": [note_out(n, d) for n, d in added]}


# ---------- rules ----------

@router.get("/memory/rules")
async def rules(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    wrapped = await pa.user_key(db, user.id)
    rows = (await db.execute(select(MemoryRule).where(MemoryRule.owner_id == user.id).order_by(MemoryRule.id))).scalars().all()
    return {"items": [rule_out(r, unseal(user.id, wrapped, r)) for r in rows]}


@router.post("/memory/rules", status_code=201)
async def add_rule(body: RuleIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    n = (await db.execute(select(func.count()).where(MemoryRule.owner_id == user.id))).scalar()
    if n >= memory.MAX_RULES:
        raise HTTPException(400, "Too many rules. Delete some first.")
    applies = ["all"] if "all" in body.applies else list(dict.fromkeys(body.applies))
    wrapped = await pa.user_key(db, user.id)
    nonce, ct = seal(user.id, wrapped, {"text": body.text})
    r = MemoryRule(owner_id=user.id, type=body.type, applies=",".join(applies), nonce=nonce, ciphertext=ct,
                   created_at=pa.utcnow())
    db.add(r)
    await db.commit()
    return rule_out(r, {"text": body.text})


@router.delete("/memory/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: int, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    r = await db.get(MemoryRule, rule_id)
    if not r or r.owner_id != user.id:
        raise HTTPException(404, "Rule not found.")
    await db.delete(r)
    await db.commit()
    return Response(status_code=204)
