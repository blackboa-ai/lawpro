"""User model."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Enum, text
from sqlalchemy.orm import declarative_base

# Import Base from package __init__ to share with Case model
from app.models import Base


class RoleType(str):
    """User role enumeration."""
    ADVOCATE = "advocate"
    CLERK = "clerk"
    ADMIN = "admin"


class User(Base):
    """User model for authentication and authorization."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(20), server_default=text("'advocate'"), nullable=False)
    is_active = Column(Boolean(), server_default=text("true"), nullable=False)
    created_at = Column(DateTime(), server_default=text("CURRENT_TIMESTAMP"), nullable=False)
    updated_at = Column(DateTime(), server_default=text("CURRENT_TIMESTAMP"), onupdate=text("CURRENT_TIMESTAMP"), nullable=False)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"