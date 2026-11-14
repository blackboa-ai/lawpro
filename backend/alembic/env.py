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

# Import models after path setup
from app.core.config import settings
from app.models.user import Base

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
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

# target_metadata for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    on this line too.

    """
    url = str(settings.DATABASE_URL)
    context.configure(
        url=url,
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
        {"sqlalchemy.url": str(settings.DATABASE_URL)},
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()