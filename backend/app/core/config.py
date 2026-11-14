"""Application configuration using Pydantic settings."""

import os
from functools import lru_cache
from typing import Optional

from pydantic import BaseSettings, Field, PostgresDsn


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: PostgresDsn = Field(..., env="DATABASE_URL")

    # Security
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)

    # Hosts for CORS
    BACKEND_HOST: Optional[str] = Field(default=None, env="BACKEND_HOST")
    FRONTEND_HOST: Optional[str] = Field(default=None, env="FRONTEND_HOST")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()