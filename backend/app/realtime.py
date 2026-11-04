"""Live events over Redis pub/sub: one channel per user (user:<id>).

Any backend process can publish; every open WebSocket of that user receives it,
so this keeps working with several uvicorn workers or several open tabs.
"""
import json
import uuid

from .deps import redis


def channel(user_id: uuid.UUID) -> str:
    return f"user:{user_id}"


async def publish(user_id: uuid.UUID, event: dict) -> None:
    await redis.publish(channel(user_id), json.dumps(event, default=str))
