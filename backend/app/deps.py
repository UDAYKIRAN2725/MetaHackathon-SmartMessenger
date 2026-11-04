from fastapi import Depends, HTTPException, Request, WebSocket
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import get_db
from .models import AuthSession, User
from .security import token_hash, utcnow

redis = Redis.from_url(settings.redis_url, decode_responses=True)


async def user_from_token(db: AsyncSession, token: str | None) -> User | None:
    if not token:
        return None
    row = await db.execute(
        select(User)
        .join(AuthSession, AuthSession.user_id == User.id)
        .where(AuthSession.token_hash == token_hash(token), AuthSession.expires_at > utcnow())
    )
    return row.scalar_one_or_none()


async def current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    user = await user_from_token(db, request.cookies.get(settings.session_cookie))
    if not user:
        raise HTTPException(401, "Not logged in.")
    return user


async def rate_limit(key: str, per_minute: int) -> None:
    n = await redis.incr(key)
    if n == 1:
        await redis.expire(key, 60)
    if n > per_minute:
        raise HTTPException(429, "Too many AI requests. Wait a minute and try again.")


async def ws_user(ws: WebSocket, db: AsyncSession) -> User | None:
    return await user_from_token(db, ws.cookies.get(settings.session_cookie))
