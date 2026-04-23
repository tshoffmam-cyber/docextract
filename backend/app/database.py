from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def _async_db_url(url: str) -> str:
    # Railway injects postgresql:// — SQLAlchemy async requires asyncpg driver
    for old in ("postgresql://", "postgres://"):
        if url.startswith(old):
            return url.replace(old, "postgresql+asyncpg://", 1)
    return url


engine = create_async_engine(_async_db_url(settings.database_url), echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
