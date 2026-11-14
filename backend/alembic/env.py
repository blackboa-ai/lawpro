"""Alembic environment configuration - fixed for Python 3.12 and Pydantic v2."""

import os
import sys
from logging.config import dictConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine.base import Connection

# Add the parent directory to sys.path to allow imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
if context.config.config_file_name is not None:
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "generic": {
                    "format": "%(levelname)-5.5s [%(name)s] %(message)s",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "generic",
                    "stream": "ext://sys.stdout",
                }
            },
            "loggers": {
                "sqlalchemy.engine": {"level": "INFO", "handlers": ["console"], "propagate": False},
            },
        }
    )

# For migrations, we need a minimal database URL that handles asyncpg -> psycopg2 conversion
# This avoids needing SECRET_KEY and FRONTEND_HOST for migrations
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

# Get DATABASE_URL directly from environment for migrations
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///./lawpro.db')

# Handle async driver URLs for PostgreSQL - convert asyncpg to syncpsycopg
# Also handle plain postgresql:// URLs and Neon URLs with sslmode
# for compatibility with synchronous session usage in FastAPI routes
if DATABASE_URL.startswith("postgresql+asyncpg"):
    # Convert async URL to sync URL
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2", 1)
elif DATABASE_URL.startswith("postgresql://"):
    # Plain postgresql:// URL - convert to use psycopg2
    # Preserve any query parameters (like sslmode=require for Neon)
    if '?' in DATABASE_URL:
        url_part, query_part = DATABASE_URL.split('?', 1)
        DATABASE_URL = "postgresql+psycopg2://" + url_part[len("postgresql://"):] + "?" + query_part
    else:
        DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgresql://"):]

# Import models after path setup - use the shared Base from models package
from app.models import Base


# target_metadata for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    on this line too.

    """
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        {"sqlalchemy.url": DATABASE_URL},
        poolclass=NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()