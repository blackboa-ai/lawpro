"""Case management endpoints."""

from datetime import date
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.case import Case, CaseStatus
from app.schemas import CaseCreate, CaseRead, CaseUpdate, DashboardStats
from app.api.v1.auth import get_current_user

router = APIRouter()


def _apply_case_updates(case: Case, update_data: dict) -> None:
    """Apply updates to a case, handling field name mappings."""
    # Field name mappings from schema to model columns
    field_mappings = {
        'case_title': 'case_title',
        'court_name': 'court_name',
        'next_hearing_date': 'next_hearing_date',
        'description': 'description',  # Map description API field to description column
    }
    
    for field, value in update_data.items():
        if value is None:
            continue
        # Map schema field names to column names
        actual_field = field_mappings.get(field, field)
        # Only set if the attribute exists on the model
        if hasattr(case, actual_field):
            setattr(case, actual_field, value)


@router.post("/", response_model=CaseRead, status_code=status.HTTP_201_CREATED)
async def create_case(
    case_in: CaseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
) -> Any:
    """Create a new case for the authenticated user."""
    # Create case with field name mappings for legacy column names
    # Note: case_number, court_name, next_hearing_date can be nullable per the updated schema
    case = Case(
        case_title=case_in.case_title,
        case_number=case_in.case_number,
        court_name=case_in.court_name,
        client_name=case_in.client_name,
        case_type=case_in.case_type,
        description=case_in.description,
        next_hearing_date=case_in.next_hearing_date,
        filing_date=case_in.filing_date,
        status=case_in.status or CaseStatus.PENDING,
        user_id=current_user.id
    )

    db.add(case)
    db.commit()
    db.refresh(case)

    return case


@router.get("/", response_model=List[CaseRead])
async def list_cases(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
) -> Any:
    """List all cases for the authenticated user."""
    result = db.execute(
        select(Case)
        .where(Case.user_id == current_user.id)
        .order_by(Case.next_hearing_date.nulls_last(), Case.created_at.desc())
    )
    cases = result.scalars().all()

    return cases


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
) -> Any:
    """Get dashboard statistics for the authenticated user."""
    # Count cases by status
    pending_count = db.execute(
        select(func.count(Case.id)).where(
            and_(Case.user_id == current_user.id, Case.status == CaseStatus.PENDING)
        )
    ).scalar() or 0
    
    ongoing_count = db.execute(
        select(func.count(Case.id)).where(
            and_(Case.user_id == current_user.id, Case.status == CaseStatus.ONGOING)
        )
    ).scalar() or 0
    
    completed_count = db.execute(
        select(func.count(Case.id)).where(
            and_(Case.user_id == current_user.id, Case.status == CaseStatus.COMPLETED)
        )
    ).scalar() or 0
    
    total_count = db.execute(
        select(func.count(Case.id)).where(Case.user_id == current_user.id)
    ).scalar() or 0
    
    upcoming_count = db.execute(
        select(func.count(Case.id)).where(
            and_(
                Case.user_id == current_user.id,
                Case.next_hearing_date != None,
                Case.next_hearing_date >= date.today()
            )
        )
    ).scalar() or 0

    return DashboardStats(
        total_cases=total_count,
        pending_cases=pending_count,
        ongoing_cases=ongoing_count,
        completed_cases=completed_count,
        upcoming_hearings=upcoming_count
    )


@router.get("/{case_id}", response_model=CaseRead)
async def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
) -> Any:
    """Get a specific case belonging to the authenticated user."""
    result = db.execute(
        select(Case)
        .where(Case.id == case_id)
        .where(Case.user_id == current_user.id)
    )
    case = result.scalar_one_or_none()

    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    return case


@router.put("/{case_id}", response_model=CaseRead)
async def update_case(
    case_id: int,
    case_in: CaseUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
) -> Any:
    """Update a case belonging to the authenticated user."""
    result = db.execute(
        select(Case)
        .where(Case.id == case_id)
        .where(Case.user_id == current_user.id)
    )
    case = result.scalar_one_or_none()

    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    # Apply updates with field name mappings
    update_data = case_in.model_dump(exclude_unset=True)
    _apply_case_updates(case, update_data)

    db.commit()
    db.refresh(case)

    return case


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
) -> None:
    """Delete a case belonging to the authenticated user."""
    result = db.execute(
        select(Case)
        .where(Case.id == case_id)
        .where(Case.user_id == current_user.id)
    )
    case = result.scalar_one_or_none()

    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    db.delete(case)
    db.commit()