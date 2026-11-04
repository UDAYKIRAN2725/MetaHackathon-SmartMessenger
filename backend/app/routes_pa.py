import uuid
from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from . import llm, pa
from .config import settings
from .db import get_db
from .deps import current_user, rate_limit
from .models import Contact, Message, Reminder, Task, TaskEvent, User
from .realtime import publish
from .routes_chats import msg_out, my_conversation, partner_id
from .security import utcnow

router = APIRouter(prefix="/api", tags=["assistant"])

Repeat = Literal["none", "daily", "weekdays", "weekly", "monthly"]
Alert = Literal["notification", "sound", "alarm"]


def _title(v: str | None) -> str | None:
    if v is None:
        return v
    v = " ".join(v.split())
    if not v:
        raise ValueError("Give the task a title.")
    return v


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = Field("", max_length=1000)
    due_date: date | None = None
    due_time: time | None = None
    tz: str = Field("", max_length=64)
    repeat: Repeat = "none"
    remind_offset_min: int = Field(30, ge=0, le=10080)
    alert_style: Alert = "notification"
    source: Literal["typed", "voice", "chat"] = "typed"
    source_text: str = Field("", max_length=1000)
    conversation_id: uuid.UUID | None = None

    @field_validator("title")
    @classmethod
    def _t(cls, v: str) -> str:
        return _title(v)


class TaskPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    notes: str | None = Field(None, max_length=1000)
    due_date: date | None = None
    due_time: time | None = None
    repeat: Repeat | None = None
    remind_offset_min: int | None = Field(None, ge=0, le=10080)
    alert_style: Alert | None = None

    @field_validator("title")
    @classmethod
    def _t(cls, v: str | None) -> str | None:
        return _title(v)


class SnoozeIn(BaseModel):
    minutes: int = Field(15, ge=1, le=10080)


class ParseIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    tz: str = Field("", max_length=64)
    source: Literal["typed", "voice"] = "typed"


class TzIn(BaseModel):
    tz: str = Field("", max_length=64)


# ---------- helpers ----------

def build_due(d: date | None, t: time | None, tz: str, repeat: str, now: datetime) -> datetime | None:
    due = pa.to_due(d, t, tz)
    if due is None:
        if repeat != "none":
            raise HTTPException(400, "A repeating task needs a start date.")
        return None
    if due < now:
        if repeat == "none":
            raise HTTPException(400, "That time has already passed. Pick a later time.")
        due = pa.next_occurrence(repeat, due, tz, now)
    if due > now + pa.MAX_AHEAD:
        raise HTTPException(400, "That date is too far in the future.")
    return due


async def my_task(db: AsyncSession, task_id: uuid.UUID, user_id: uuid.UUID) -> Task:
    t = await db.get(Task, task_id)
    if not t or t.user_id != user_id:
        raise HTTPException(404, "Task not found.")
    return t


async def respond(db: AsyncSession, user: User, task: Task) -> dict:
    out = (await pa.views(db, user.id, [task]))[0]
    await publish(user.id, {"type": "task.updated", "task": out})  # keeps other tabs in sync
    return out


# ---------- tasks ----------

@router.get("/tasks")
async def list_tasks(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    open_ = (await db.execute(select(Task).where(Task.user_id == user.id, Task.status == "open")
                              .order_by(Task.due_at.asc().nulls_last(), Task.created_at))).scalars().all()
    done = (await db.execute(select(Task).where(Task.user_id == user.id, Task.status == "done")
                             .order_by(Task.completed_at.desc()).limit(50))).scalars().all()
    return {"items": await pa.views(db, user.id, [*open_, *done])}


@router.post("/tasks", status_code=201)
async def create_task(body: TaskIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    now = utcnow()
    tz = pa.valid_tz(body.tz)
    due = build_due(body.due_date, body.due_time, tz, body.repeat, now)
    if body.conversation_id:
        await my_conversation(db, body.conversation_id, user.id)
    wrapped = await pa.user_key(db, user.id)
    nonce, ct = pa.seal(user.id, wrapped, {"title": body.title, "notes": body.notes.strip(),
                                           "source_text": body.source_text.strip()})
    t = Task(id=uuid.uuid4(), user_id=user.id, nonce=nonce, ciphertext=ct, due_at=due, tz=tz, repeat=body.repeat,
             remind_offset_min=body.remind_offset_min, alert_style=body.alert_style, source=body.source,
             conversation_id=body.conversation_id, status="open", created_at=now)
    db.add(t)
    await db.flush()
    await pa.reschedule(db, t, now)
    pa.event(db, t.id, "created", body.source)
    await db.commit()
    return await respond(db, user, t)


@router.patch("/tasks/{task_id}")
async def update_task(task_id: uuid.UUID, body: TaskPatch, user: User = Depends(current_user),
                      db: AsyncSession = Depends(get_db)):
    t = await my_task(db, task_id, user.id)
    f = body.model_fields_set
    now = utcnow()

    if f & {"title", "notes"}:
        wrapped = await pa.user_key(db, user.id)
        p = pa.unseal(t, wrapped)
        if body.title is not None:
            p["title"] = body.title
        if body.notes is not None:
            p["notes"] = body.notes.strip()
        t.nonce, t.ciphertext = pa.seal(user.id, wrapped, p)
    if body.alert_style is not None:
        t.alert_style = body.alert_style
    if body.remind_offset_min is not None:
        t.remind_offset_min = body.remind_offset_min
    if body.repeat is not None:
        t.repeat = body.repeat

    timing = f & {"due_date", "due_time", "repeat"}
    if timing:
        local = t.due_at.astimezone(pa.zone(t.tz)) if t.due_at else None
        d = body.due_date if "due_date" in f else (local.date() if local else None)
        tm = body.due_time if "due_time" in f else (local.time() if local else None)
        if d is None:
            t.repeat = "none"
        t.due_at = build_due(d, tm, t.tz, t.repeat, now)
    if timing or "remind_offset_min" in f:
        await pa.reschedule(db, t, now)
    pa.event(db, t.id, "edited", ", ".join(sorted(f)))
    await db.commit()
    return await respond(db, user, t)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    t = await my_task(db, task_id, user.id)
    await db.delete(t)
    await db.commit()
    await publish(user.id, {"type": "task.deleted", "id": str(task_id)})
    return Response(status_code=204)


@router.post("/tasks/{task_id}/done")
async def done_task(task_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    t = await my_task(db, task_id, user.id)
    if t.status != "open":
        return await respond(db, user, t)
    now = utcnow()
    await pa.close_active(db, t.id, "done")
    nxt = pa.next_occurrence(t.repeat, t.due_at, t.tz, max(now, t.due_at)) if t.due_at else None
    if nxt:
        # Recurring: this occurrence is done, the task moves to the next one.
        t.due_at = nxt
        await pa.reschedule(db, t, now)
        pa.event(db, t.id, "done", "next occurrence scheduled")
    else:
        t.status, t.completed_at = "done", now
        pa.event(db, t.id, "done")
    await db.commit()
    return await respond(db, user, t)


@router.post("/tasks/{task_id}/reopen")
async def reopen_task(task_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    t = await my_task(db, task_id, user.id)
    if t.status == "done":
        t.status, t.completed_at = "open", None
        await pa.reschedule(db, t)
        pa.event(db, t.id, "reopened")
        await db.commit()
    return await respond(db, user, t)


@router.post("/tasks/{task_id}/snooze")
async def snooze_task(task_id: uuid.UUID, body: SnoozeIn, user: User = Depends(current_user),
                      db: AsyncSession = Depends(get_db)):
    t = await my_task(db, task_id, user.id)
    if t.status != "open":
        raise HTTPException(400, "Only open tasks can be snoozed.")
    now = utcnow()
    cur = (await db.execute(select(Reminder).where(Reminder.task_id == t.id, Reminder.status.in_(pa.ACTIVE))
                            .order_by(Reminder.id.desc()).limit(1))).scalar_one_or_none()
    count = (cur.snooze_count if cur else 0) + 1
    await pa.close_active(db, t.id, "cancelled")
    db.add(Reminder(task_id=t.id, user_id=user.id, fire_at=now + timedelta(minutes=body.minutes), status="pending",
                    snooze_count=count, created_at=now))
    pa.event(db, t.id, "snoozed", f"{body.minutes} min")
    await db.commit()
    return await respond(db, user, t)


@router.post("/tasks/{task_id}/dismiss")
async def dismiss_alert(task_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Close the alert without completing the task. The task stays open (and shows as overdue once due)."""
    t = await my_task(db, task_id, user.id)
    await db.execute(update(Reminder).where(Reminder.task_id == t.id, Reminder.status == "sent")
                     .values(status="dismissed"))
    pa.event(db, t.id, "dismissed")
    await db.commit()
    return await respond(db, user, t)


@router.get("/tasks/{task_id}/events")
async def task_events(task_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await my_task(db, task_id, user.id)
    rows = (await db.execute(select(TaskEvent).where(TaskEvent.task_id == task_id)
                             .order_by(TaskEvent.id.desc()).limit(30))).scalars().all()
    return {"items": [{"action": e.action, "detail": e.detail, "at": e.at.isoformat()} for e in rows]}


# ---------- understanding requests (LLM) ----------

@router.post("/pa/parse")
async def parse_request(body: ParseIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Understand a typed or spoken request. Returns a draft to confirm, a follow-up question, or a task list.
    Never saves anything."""
    await rate_limit(f"pa:{user.id}", settings.pa_rate_per_minute)
    tz = pa.valid_tz(body.tz)
    now_local = utcnow().astimezone(pa.zone(tz))
    try:
        r = await llm.parse_request(body.text.strip(), now_local)
    except llm.LLMUnavailable as e:
        raise HTTPException(503, str(e))

    action = r.get("action")
    if action == "ask" and r.get("question"):
        opts = [pa._clean(o, 40) for o in (r.get("options") or []) if pa._clean(o, 40)][:5]
        return {"action": "ask", "question": pa._clean(r["question"], 200), "options": opts}

    if action == "list":
        f = pa._date(r.get("from")) or now_local.date()
        to = pa._date(r.get("to")) or f
        f, to = min(f, to), max(f, to)
        to = min(to, f + timedelta(days=31))
        z = pa.zone(tz)
        start, end = datetime.combine(f, time(0), z), datetime.combine(to + timedelta(days=1), time(0), z)
        rows = (await db.execute(select(Task).where(Task.user_id == user.id, Task.status == "open",
                                                    Task.due_at >= start, Task.due_at < end)
                                 .order_by(Task.due_at))).scalars().all()
        return {"action": "list", "from": f.isoformat(), "to": to.isoformat(), "tasks": await pa.views(db, user.id, rows)}

    draft, assumed = pa.draft_from_llm(r, now_local)
    draft.update(source=body.source, source_text=body.text.strip(), tz=tz)
    return {"action": "create", "draft": draft, "assumed": assumed}


@router.post("/conversations/{conv_id}/tasks/suggest")
async def suggest_from_chat(conv_id: uuid.UUID, body: TzIn, user: User = Depends(current_user),
                            db: AsyncSession = Depends(get_db)):
    """Find follow-ups in the last messages of one chat. Needs AI permission for that chat. Never saves anything."""
    c = await my_conversation(db, conv_id, user.id)
    pid = partner_id(c, user.id)
    contact = await db.get(Contact, (user.id, pid))
    if not contact or contact.category == "ext" or not contact.ai_allowed:
        raise HTTPException(403, "AI isn’t allowed for this chat. Turn it on in contact info.")
    await rate_limit(f"pa:{user.id}", settings.pa_rate_per_minute)

    tz = pa.valid_tz(body.tz)
    z = pa.zone(tz)
    now_local = utcnow().astimezone(z)
    rows = list((await db.execute(select(Message).where(Message.conversation_id == c.id)
                                  .order_by(Message.id.desc()).limit(settings.find_tasks_messages))).scalars())
    history = [{**msg_out(c, m, user.id), "created_local": m.created_at.astimezone(z)} for m in reversed(rows)]
    partner = await db.get(User, pid)

    def first(n: str) -> str:
        return n.replace("(", " ").split()[0]

    try:
        found = await llm.find_tasks(me=first(user.name), them=first(partner.name), history=history, now=now_local)
    except llm.LLMUnavailable as e:
        raise HTTPException(503, str(e))

    out = []
    for item in found[:3]:
        draft, assumed = pa.draft_from_llm(item, now_local)
        quote = pa._clean(item.get("quote"), 200)
        draft.update(source="chat", source_text=quote, tz=tz, conversation_id=str(c.id))
        out.append({"draft": draft, "assumed": assumed, "quote": quote})
    return {"suggestions": out, "chat_name": partner.name, "scanned": len(history)}
