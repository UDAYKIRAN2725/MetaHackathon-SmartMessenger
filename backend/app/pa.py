"""Personal-assistant domain logic: encryption of task text, due dates, recurrence, reminder scheduling.

Times: the user gives a local date + time + IANA zone; we store an aware UTC timestamp plus the zone,
so recurrence ("every Tuesday 7 PM") keeps the wall-clock time.
"""
import json
import re
import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dateutil import rrule as rr
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from . import crypto
from .config import settings
from .models import REPEATS, Conversation, Reminder, Task, TaskEvent, User, UserKey
from .security import utcnow

ACTIVE = ("pending", "sent")
DEFAULT_TIME = time(9, 0)
MAX_AHEAD = timedelta(days=5 * 366)
_FREQ = {
    "daily": {"freq": rr.DAILY},
    "weekdays": {"freq": rr.WEEKLY, "byweekday": (rr.MO, rr.TU, rr.WE, rr.TH, rr.FR)},
    "weekly": {"freq": rr.WEEKLY},
    "monthly": {"freq": rr.MONTHLY},
}


# ---------- time helpers ----------

def zone(tz: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz or settings.default_tz)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(settings.default_tz)


def valid_tz(tz: str | None) -> str:
    return zone(tz).key


def to_due(d: date | None, t: time | None, tz: str) -> datetime | None:
    return None if d is None else datetime.combine(d, t or DEFAULT_TIME, tzinfo=zone(tz))


def next_occurrence(repeat: str, due: datetime, tz: str, after: datetime) -> datetime | None:
    if repeat not in _FREQ:
        return None
    z = zone(tz)
    rule = rr.rrule(dtstart=due.astimezone(z), **_FREQ[repeat])
    return rule.after(after.astimezone(z), inc=False)


# ---------- encryption of task text (per-user key) ----------

async def user_key(db: AsyncSession, user_id: uuid.UUID) -> bytes:
    q = select(UserKey.wrapped_key).where(UserKey.user_id == user_id)
    w = (await db.execute(q)).scalar_one_or_none()
    if w is None:
        await db.execute(pg_insert(UserKey).values(user_id=user_id, wrapped_key=crypto.new_wrapped_key(user_id))
                         .on_conflict_do_nothing())
        w = (await db.execute(q)).scalar_one()
    return w


def seal(user_id: uuid.UUID, wrapped: bytes, payload: dict) -> tuple[bytes, bytes]:
    return crypto.encrypt(user_id, wrapped, json.dumps(payload, ensure_ascii=False))


def unseal(task: Task, wrapped: bytes) -> dict:
    return json.loads(crypto.decrypt(task.user_id, wrapped, task.nonce, task.ciphertext))


# ---------- scheduling ----------

def event(db: AsyncSession, task_id: uuid.UUID, action: str, detail: str = "") -> None:
    db.add(TaskEvent(task_id=task_id, action=action, detail=detail[:120], at=utcnow()))


async def close_active(db: AsyncSession, task_id: uuid.UUID, status: str) -> None:
    await db.execute(update(Reminder).where(Reminder.task_id == task_id, Reminder.status.in_(ACTIVE))
                     .values(status=status))


async def reschedule(db: AsyncSession, task: Task, now: datetime | None = None) -> Reminder | None:
    """Replace the task's active reminder with one at due_at − offset (or now, if that has passed)."""
    now = now or utcnow()
    await close_active(db, task.id, "cancelled")
    if task.status != "open" or task.due_at is None or task.due_at < now - timedelta(minutes=1):
        return None  # to-do, done, or overdue (shown as overdue, no new alert)
    fire = max(task.due_at - timedelta(minutes=task.remind_offset_min), now)
    r = Reminder(task_id=task.id, user_id=task.user_id, fire_at=fire, status="pending", snooze_count=0, created_at=now)
    db.add(r)
    return r


# ---------- output ----------

def _utc(dt: datetime | None) -> str | None:
    # Always UTC, so the same instant always serialises to the same string.
    return dt.astimezone(timezone.utc).isoformat() if dt else None


async def views(db: AsyncSession, user_id: uuid.UUID, tasks: list[Task]) -> list[dict]:
    if not tasks:
        return []
    wrapped = await user_key(db, user_id)
    ids = [t.id for t in tasks]
    rems: dict[uuid.UUID, Reminder] = {}
    for r in (await db.execute(select(Reminder).where(Reminder.task_id.in_(ids), Reminder.status.in_(ACTIVE))
                               .order_by(Reminder.id))).scalars():
        rems[r.task_id] = r  # latest active wins

    names: dict[uuid.UUID, str] = {}
    conv_ids = {t.conversation_id for t in tasks if t.conversation_id}
    if conv_ids:
        convs = (await db.execute(select(Conversation).where(Conversation.id.in_(conv_ids)))).scalars().all()
        pid = {c.id: (c.user_b_id if c.user_a_id == user_id else c.user_a_id) for c in convs}
        users = dict((await db.execute(select(User.id, User.name).where(User.id.in_(set(pid.values()))))).all())
        names = {cid: users.get(p, "") for cid, p in pid.items()}

    out = []
    for t in tasks:
        p = unseal(t, wrapped)
        r = rems.get(t.id)
        local = t.due_at.astimezone(zone(t.tz)) if t.due_at else None
        out.append({
            "id": str(t.id),
            "title": p.get("title", ""),
            "notes": p.get("notes", ""),
            "source_text": p.get("source_text", ""),
            "due_at": _utc(t.due_at),
            "due_date": local.date().isoformat() if local else None,
            "due_time": local.strftime("%H:%M") if local else None,
            "tz": t.tz,
            "repeat": t.repeat,
            "remind_offset_min": t.remind_offset_min,
            "alert_style": t.alert_style,
            "source": t.source,
            "conversation_id": str(t.conversation_id) if t.conversation_id else None,
            "chat_name": names.get(t.conversation_id) if t.conversation_id else None,
            "status": t.status,
            "created_at": _utc(t.created_at),
            "completed_at": _utc(t.completed_at),
            "reminder": {"id": r.id, "fire_at": _utc(r.fire_at), "status": r.status,
                         "snooze_count": r.snooze_count} if r else None,
        })
    return out


# ---------- LLM output -> editable draft (validated in code) ----------

def _date(v) -> date | None:
    try:
        return date.fromisoformat(str(v)[:10]) if v else None
    except ValueError:
        return None


def _time(v) -> time | None:
    if not v:
        return None
    s = str(v).strip().upper().replace(".", "")
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I %p", "%I:%M%p", "%I%p"):
        try:
            return datetime.strptime(s, fmt).time().replace(second=0)
        except ValueError:
            continue
    return None


def _clean(v, n: int) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()[:n]


def draft_from_llm(r: dict, now_local: datetime) -> tuple[dict, list[str]]:
    """Turns the model's fields into a draft the user edits. Returns (draft, notes about assumptions)."""
    notes: list[str] = []
    today = now_local.date()
    d, t = _date(r.get("date")), _time(r.get("time"))
    repeat = r.get("repeat") if r.get("repeat") in REPEATS else "none"

    if d and (d < today - timedelta(days=1) or d > today + MAX_AHEAD):
        d = None
        notes.append("The date didn’t look right, please pick one.")
    if t and not d:
        d = today if t > now_local.time() else today + timedelta(days=1)
        notes.append(f"No day given, set to {'today' if d == today else 'tomorrow'}.")
    if repeat != "none" and not d:
        d = today
        notes.append("No start day given, starting today.")
    if d and not t:
        t = DEFAULT_TIME
        notes.append("No time given, set to 9:00 AM.")
    if d and repeat == "none" and datetime.combine(d, t, now_local.tzinfo) < now_local:
        notes.append("That time has already passed. Pick a later one.")

    try:
        offset = max(0, min(int(r.get("remind_before_min")), 10080))
    except (TypeError, ValueError):
        offset = 30

    draft = {
        "title": _clean(r.get("title"), 200) or "New task",
        "notes": _clean(r.get("notes"), 1000),
        "due_date": d.isoformat() if d else None,
        "due_time": t.strftime("%H:%M") if d else None,
        "repeat": repeat if d else "none",
        "remind_offset_min": offset,
    }
    return draft, notes
