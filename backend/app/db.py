from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def create_tables() -> None:
    # Hackathon shortcut: create missing tables on startup. Switch to Alembic migrations
    # before the schema changes on a database with real data.
    from . import models  # noqa: F401  (registers the tables)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # create_all doesn't add columns to existing tables; these keep older dev databases working.
        for stmt in MIGRATIONS:
            await conn.execute(text(stmt))


MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_rank_enabled boolean NOT NULL DEFAULT false",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tz varchar(64) NOT NULL DEFAULT ''",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_rank boolean NOT NULL DEFAULT false",
]
