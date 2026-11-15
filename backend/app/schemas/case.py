"""Case schemas for request/response validation."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CaseCreate(BaseModel):
    """Schema for creating a new case."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )

    case_title: str = Field(..., min_length=1, description="Case title")
    case_number: Optional[str] = Field(None, max_length=100, description="Case number/reference")
    court_name: Optional[str] = Field(None, max_length=255, description="Court name")
    client_name: Optional[str] = Field(None, max_length=255, description="Client name")
    case_type: Optional[str] = Field(None, max_length=100, description="Case type (Civil, Criminal, etc.)")
    description: Optional[str] = Field(None, max_length=10000, description="Case description")
    filing_date: Optional[date] = Field(None, description="Date case was filed")
    next_hearing_date: Optional[date] = Field(None, description="Next hearing date")
    status: Optional[str] = Field(default="pending", description="Case status")


class CaseUpdate(BaseModel):
    """Schema for updating a case."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )

    case_title: Optional[str] = Field(None, min_length=1, max_length=255)
    case_number: Optional[str] = Field(None, max_length=100)
    court_name: Optional[str] = Field(None, max_length=150)
    client_name: Optional[str] = Field(None, max_length=255)
    case_type: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=10000)
    filing_date: Optional[date] = Field(None)
    next_hearing_date: Optional[date] = Field(None)
    status: Optional[str] = Field(None)
    hearing_notes: Optional[str] = Field(None, max_length=10000)
    expected_hearing_date: Optional[date] = None


class HearingHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hearing_date: date
    next_hearing_date: Optional[date]
    notes: Optional[str]
    recorded_at: datetime


class CaseRead(BaseModel):
    """Schema for reading case data.
    
    This schema uses snake_case field names to match the API schema and database columns.
    """

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )

    id: int
    user_id: int
    case_title: str
    case_number: Optional[str] = None
    court_name: Optional[str] = None
    next_hearing_date: Optional[date] = None
    description: Optional[str] = None
    status: str
    client_name: Optional[str] = None
    case_type: Optional[str] = None
    filing_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class DashboardStats(BaseModel):
    """Dashboard statistics schema."""

    total_cases: int
    pending_cases: int
    ongoing_cases: int
    completed_cases: int
    upcoming_hearings: int
