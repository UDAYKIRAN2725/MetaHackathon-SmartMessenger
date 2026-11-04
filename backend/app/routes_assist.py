import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import llm, memory
from .config import settings
from .db import get_db
from .deps import current_user, redis
from .models import Contact, Message, User
from .routes_chats import msg_out, my_conversation, partner_id

router = APIRouter(prefix="/api", tags=["ai-assist"])


class AssistIn(BaseModel):
    goal: str = Field("", max_length=80)
    context: str = Field("", max_length=1000)


async def _rate_limit(user_id: uuid.UUID) -> None:
    key = f"assist:{user_id}"
    n = await redis.incr(key)
    if n == 1:
        await redis.expire(key, 60)
    if n > settings.assist_rate_per_minute:
        raise HTTPException(429, "Too many AI requests. Wait a minute and try again.")


@router.post("/conversations/{conv_id}/assist")
async def assist(conv_id: uuid.UUID, body: AssistIn, user: User = Depends(current_user),
                 db: AsyncSession = Depends(get_db)):
    c = await my_conversation(db, conv_id, user.id)
    pid = partner_id(c, user.id)
    contact = await db.get(Contact, (user.id, pid))
    # Permission is enforced here, not just in the UI: nothing is read or sent without it.
    if not contact or contact.category == "ext" or not contact.ai_allowed:
        raise HTTPException(403, "AI assist isn’t allowed for this chat. Turn it on in contact info.")
    await _rate_limit(user.id)

    partner = await db.get(User, pid)
    rows = list((await db.execute(
        select(Message).where(Message.conversation_id == c.id)
        .order_by(Message.id.desc()).limit(settings.assist_history_messages)
    )).scalars())
    history = [msg_out(c, m, user.id) for m in reversed(rows)]

    notes, rules = await memory.context_for(db, user.id, contact)  # approved notes + matching rules only
    first = lambda n: n.replace("(", " ").split()[0]  # noqa: E731
    try:
        replies = await llm.suggest_replies(
            me=first(user.name), them=first(partner.name), category=contact.category,
            goal=body.goal.strip(), context=body.context.strip(), history=history, notes=notes, rules=rules,
        )
    except llm.LLMUnavailable as e:
        raise HTTPException(503, str(e))

    return {
        "replies": replies,
        # Shown in "Context sent to AI" so the user can see exactly what left the server.
        "sent": {
            "goal": body.goal.strip(),
            "context": body.context.strip(),
            "messages": len(history),
            "tone": llm.CATEGORY_TONE.get(contact.category),
            "notes": notes,
            "rules": rules,
            "model": settings.llm_model,
        },
    }
