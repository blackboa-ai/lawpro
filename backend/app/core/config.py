"""Application configuration using Pydantic settings."""

import os
from functools import lru_cache
from typing import Optional

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: AnyUrl = Field(..., env="DATABASE_URL")

    # Security
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Hosts for CORS
    BACKEND_HOST: Optional[str] = Field(default=None, env="BACKEND_HOST")
    FRONTEND_HOST: Optional[str] = Field(default=None, env="FRONTEND_HOST")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()