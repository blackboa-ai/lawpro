"""Case model for legal case management.

Maps to the cases table. The API uses snake_case field names:
- case_title: str
- court_name: str
- next_hearing_date: date
- description: str
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import declarative_base

# Import Base from package __init__ to share with User model
from app.models import Base


class CaseStatus(str, Enum):
    """Case status enumeration."""
    PENDING = "pending"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    DISMISSED = "dismissed"


class Case(Base):
    """Legal case model.
    
    This model uses snake_case column names to match the API schema directly.
    """

    __tablename__ = "cases"

    # Primary key and relationship
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Core fields - using snake_case column names to match API
    case_title = Column(String(255), nullable=False)
    case_number = Column(String(100), nullable=True)
    court_name = Column(String(150), nullable=True)
    next_hearing_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    
    # Additional fields
    status = Column(String(20), server_default='pending', nullable=False)
    client_name = Column(String(255), nullable=True)
    case_type = Column(String(100), nullable=True)
    filing_date = Column(Date, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default=text("'1970-01-01 00:00:00'"), nullable=False)
    updated_at = Column(DateTime, server_default=text("'1970-01-01 00:00:00'"), nullable=False)


class HearingHistory(Base):
    """A previous hearing date and the change that replaced it."""

    __tablename__ = "hearing_history"

    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    hearing_date = Column(Date, nullable=False)
    next_hearing_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False)
