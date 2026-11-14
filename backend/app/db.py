"""Database configuration."""

import os
import sys

# Check for psycopg2 availability before importing settings
try:
    import psycopg2
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

from app.core.config import settings

DATABASE_URL = str(settings.DATABASE_URL)

# Handle async driver URLs for PostgreSQL - convert asyncpg to syncpsycopg
# for compatibility with synchronous session usage in FastAPI routes
if DATABASE_URL.startswith("postgresql+asyncpg"):
    # Convert async URL to sync URL
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2", 1)
elif DATABASE_URL.startswith("postgresql+psycopg"):
    # Already using psycopg driver, keep as-is
    pass
elif DATABASE_URL.startswith("postgresql://"):
    # Plain postgresql:// URL - convert to use psycopg2
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgresql://"):]

# Validate PostgreSQL driver availability for PostgreSQL URLs
if DATABASE_URL.startswith("postgresql") and not PSYCOPG2_AVAILABLE:
    raise ImportError(
        "PostgreSQL support requires psycopg2-binary. "
        "Install it with: pip install psycopg2-binary"
    )

# Create engine with appropriate settings for each database type
if DATABASE_URL.startswith("sqlite"):
    # SQLite: use check_same_thread=False for testing
    engine = create_engine(
        DATABASE_URL.replace("sqlite:///", "sqlite:///./"),
        connect_args={"check_same_thread": False},
    )
else:
    # PostgreSQL: use psycopg2 with connection pooling
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool if DATABASE_URL.startswith("postgresql") else NullPool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

# Synchronous session for all database types
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()