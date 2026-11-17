"""Application configuration using Pydantic settings."""

import os
from functools import lru_cache
from typing import Optional

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: AnyUrl

    # Security
    SECRET_KEY: str = Field(..., min_length=1, description="Secret key for JWT signing")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Hosts for CORS - FRONTEND_HOST is required for production
    BACKEND_HOST: Optional[str] = Field(default=None, description="Backend host URL")
    FRONTEND_HOST: str = Field(..., description="Frontend host URL for CORS - required")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
