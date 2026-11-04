"""Reminder worker. Every few seconds: claim due reminders, mark them sent, push them to the user.

`FOR UPDATE SKIP LOCKED` lets several API processes run this loop without sending an alert twice,
and since reminders live in Postgres, a restart loses nothing (overdue ones fire on the next tick).
Users who are offline get the alert when they reconnect: sent-but-unanswered reminders are part of /api/tasks.
"""
import asyncio
import logging
from collections import defaultdict

from sqlalchemy import select

from . import ai_rank, pa
from .config import settings
from .db import SessionLocal
from .models import Reminder, Task
from .realtime import publish
from .security import utcnow

log = logging.getLogger("smart.scheduler")


async def tick() -> int:
    async with SessionLocal() as db:
        now = utcnow()
        due = list((await db.execute(
            select(Reminder).where(Reminder.status == "pending", Reminder.fire_at <= now)
            .order_by(Reminder.fire_at).limit(100).with_for_update(skip_locked=True)
        )).scalars())
        if not due:
            return 0
        for r in due:
            r.status, r.sent_at = "sent", now
            pa.event(db, r.task_id, "alerted", f"after {r.snooze_count} snooze(s)" if r.snooze_count else "")
        await db.commit()

        tasks = (await db.execute(select(Task).where(Task.id.in_([r.task_id for r in due])))).scalars().all()
        by_user: dict = defaultdict(list)
        for t in tasks:
            by_user[t.user_id].append(t)
        for uid, ts in by_user.items():
            for out in await pa.views(db, uid, ts):
                await publish(uid, {"type": "reminder.due", "task": out})
        return len(due)


async def run(stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            n = await tick()
            if n:
                log.info("sent %d reminder(s)", n)  # counts only, never task text
        except Exception:  # keep the loop alive; the next tick retries
            log.exception("reminder tick failed")
        try:
            n = await ai_rank.tick()
            if n:
                log.info("AI-ranked %d chat(s)", n)
        except Exception:
            log.exception("ranking tick failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=settings.scheduler_interval_seconds)
        except asyncio.TimeoutError:
            pass
