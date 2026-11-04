"""Memory helpers shared by the Memory routes, AI assist and the seed."""
import json
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import crypto, pa
from .models import Contact, MemoryNote, MemoryRule

TAGS = ("Role", "Preference", "Fact", "Language", "Date", "Note")
RULE_TYPES = ("tone", "language", "avoid", "culture")
TARGETS = ("all", "fr", "pro", "fam", "rel")
MAX_NOTES_PER_CONTACT = 50
MAX_RULES = 100


def seal(owner_id: uuid.UUID, wrapped: bytes, data: dict) -> tuple[bytes, bytes]:
    return crypto.encrypt(owner_id, wrapped, json.dumps(data, ensure_ascii=False))


def unseal(owner_id: uuid.UUID, wrapped: bytes, row) -> dict:
    return json.loads(crypto.decrypt(owner_id, wrapped, row.nonce, row.ciphertext))


def note_out(n: MemoryNote, d: dict) -> dict:
    return {"id": n.id, "tag": n.tag, "text": d.get("text", ""), "src": d.get("src", ""), "status": n.status,
            "source": n.source, "created_at": n.created_at.isoformat() if n.created_at else None}


def rule_out(r: MemoryRule, d: dict) -> dict:
    return {"id": r.id, "type": r.type, "text": d.get("text", ""), "applies": r.applies.split(","),
            "created_at": r.created_at.isoformat() if r.created_at else None}


async def context_for(db: AsyncSession, owner_id: uuid.UUID, contact: Contact) -> tuple[list[str], list[str]]:
    """Approved notes about this contact and the rules that apply to them, for AI assist."""
    wrapped = await pa.user_key(db, owner_id)
    notes = (await db.execute(select(MemoryNote).where(
        MemoryNote.owner_id == owner_id, MemoryNote.contact_id == contact.contact_id, MemoryNote.status == "approved",
    ).order_by(MemoryNote.id).limit(15))).scalars().all()
    rules = (await db.execute(select(MemoryRule).where(MemoryRule.owner_id == owner_id)
                              .order_by(MemoryRule.id))).scalars().all()
    applies = lambda r: "all" in r.applies.split(",") or contact.category in r.applies.split(",")  # noqa: E731
    return (
        [f"{n.tag}: {unseal(owner_id, wrapped, n)['text']}" for n in notes],
        [unseal(owner_id, wrapped, r)["text"] for r in rules if applies(r)][:20],
    )
