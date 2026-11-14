"""Database configuration."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

# SQLite for local testing, PostgreSQL for production
DATABASE_URL = str(settings.DATABASE_URL)
if DATABASE_URL.startswith("sqlite"):
    engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL connection
    engine = create_async_engine(DATABASE_URL, poolclass=NullPool)

AsyncSessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    class_=AsyncSession,
    bind=engine
)


async def get_db():
    """Get database session."""
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        await db.close()