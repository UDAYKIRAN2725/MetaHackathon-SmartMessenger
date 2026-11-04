"""Feature 1: behaviour-based chat ranking. Uses timestamps only, never message text.

read_delay  = read_at − delivered_at          (messages the partner sent to me)
read_speed  = 1 ÷ (1 + avg_delay_min ÷ 10)
time_score  = min(avg_min_per_day ÷ most_used_chat_min_per_day, 1)
score       = 100 × (0.5·read_speed + 0.5·time_score)

A chat needs `min_tracked_for_score` read messages in the window before it gets a score.
"""
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .models import ChatActivity, Message
from .security import utcnow


@dataclass
class Stats:
    avg_delay_min: float | None
    min_per_day: float
    tracked: int
    read_speed: float | None = None
    time_score: float | None = None
    score: int | None = None

    def as_dict(self) -> dict:
        r = lambda v, n=2: None if v is None else round(v, n)  # noqa: E731
        return {
            "avg_delay_min": r(self.avg_delay_min, 1),
            "min_per_day": r(self.min_per_day, 1),
            "tracked": self.tracked,
            "read_speed": r(self.read_speed),
            "time_score": r(self.time_score),
            "score": self.score,
        }


async def compute(db: AsyncSession, user_id: uuid.UUID, conv_ids: list[uuid.UUID]) -> tuple[dict[uuid.UUID, Stats], float]:
    """Returns stats per conversation and the most-used chat's minutes/day (the time_score scale)."""
    if not conv_ids:
        return {}, 0.0
    days = settings.ranking_window_days
    since = utcnow() - timedelta(days=days)

    delay_sec = func.extract("epoch", Message.read_at - func.coalesce(Message.delivered_at, Message.created_at))
    delays = await db.execute(
        select(Message.conversation_id, func.avg(func.greatest(delay_sec, 0)), func.count())
        .where(
            Message.conversation_id.in_(conv_ids),
            Message.sender_id != user_id,
            Message.read_at.is_not(None),
            Message.created_at >= since,
        )
        .group_by(Message.conversation_id)
    )
    delay_map = {cid: (float(avg) / 60, int(n)) for cid, avg, n in delays.all()}

    activity = await db.execute(
        select(ChatActivity.conversation_id, func.sum(ChatActivity.seconds))
        .where(
            and_(ChatActivity.user_id == user_id, ChatActivity.conversation_id.in_(conv_ids)),
            ChatActivity.day >= since.date(),
        )
        .group_by(ChatActivity.conversation_id)
    )
    minutes = {cid: float(sec) / 60 / days for cid, sec in activity.all()}
    top = max(minutes.values(), default=0.0)

    out: dict[uuid.UUID, Stats] = {}
    for cid in conv_ids:
        avg_delay, n = delay_map.get(cid, (None, 0))
        s = Stats(avg_delay_min=avg_delay, min_per_day=minutes.get(cid, 0.0), tracked=n)
        if n >= settings.min_tracked_for_score:
            s.read_speed = 1 / (1 + avg_delay / 10)
            s.time_score = min(s.min_per_day / top, 1.0) if top > 0 else 0.0
            s.score = round(100 * (0.5 * s.read_speed + 0.5 * s.time_score))
        out[cid] = s
    return out, top
