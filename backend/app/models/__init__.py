"""Database models package."""

from sqlalchemy.orm import declarative_base

# Create a single Base for all models to share for migrations
Base = declarative_base()

# Import models after Base is defined
from app.models.case import Case, CaseStatus
from app.models.user import User

__all__ = ["Base", "User", "Case", "CaseStatus"]