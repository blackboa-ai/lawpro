"""Case management endpoints."""

from datetime import date, datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.case import Case, CaseStatus, HearingHistory
from app.schemas import CaseCreate, CaseRead, CaseUpdate, DashboardStats
from app.schemas.case import HearingHistoryRead
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
        if value is None and field in {"case_title", "status"}:
            continue
        # Map schema field names to column names
        actual_field = field_mappings.get(field, field)
        # Only set if the attribute exists on the model
        if hasattr(case, actual_field):
            setattr(case, actual_field, value)


@router.post("/", response_model=CaseRead, status_code=status.HTTP_201_CREATED)
def create_case(
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
def list_cases(
    response: Response,
    offset: int = Query(0, ge=0),
    limit: int | None = Query(None, ge=1, le=200),
    search: str = "",
    case_status: CaseStatus | None = None,
    upcoming_from: date | None = None,
    upcoming_before: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
) -> Any:
    """List the user's cases, optionally filtered and paginated."""
    conditions = [Case.user_id == current_user.id]
    if search.strip():
        term = search.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions.append(or_(*(func.lower(column).like(f"%{term}%", escape="\\") for column in (Case.case_title, Case.case_number, Case.court_name))))
    if case_status:
        conditions.append(Case.status == case_status)
    if upcoming_from:
        conditions.append(Case.next_hearing_date >= upcoming_from)
    if upcoming_before:
        conditions.append(Case.next_hearing_date < upcoming_before)
    query = select(Case).where(*conditions).order_by(Case.next_hearing_date.nulls_last(), Case.created_at.desc(), Case.id.desc())
    if limit is not None:
        response.headers["X-Total-Count"] = str(db.scalar(select(func.count(Case.id)).where(*conditions)))
        response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"
        query = query.offset(offset).limit(limit)
    return db.execute(query).scalars().all()


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(
    today: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
) -> Any:
    """Get dashboard statistics for the authenticated user."""
    counts = db.execute(select(
        func.count(Case.id),
        func.count(case((Case.status == CaseStatus.PENDING, 1))),
        func.count(case((Case.status == CaseStatus.ONGOING, 1))),
        func.count(case((Case.status == CaseStatus.COMPLETED, 1))),
        func.count(case((Case.next_hearing_date >= (today or date.today()), 1))),
    ).where(Case.user_id == current_user.id)).one()
    return DashboardStats(
        total_cases=counts[0], pending_cases=counts[1], ongoing_cases=counts[2],
        completed_cases=counts[3], upcoming_hearings=counts[4],
    )


@router.get("/{case_id}", response_model=CaseRead)
def get_case(
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
def update_case(
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
        .with_for_update()
    )
    case = result.scalar_one_or_none()

    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    # Apply updates with field name mappings
    update_data = case_in.model_dump(exclude_unset=True)
    hearing_notes = (update_data.pop("hearing_notes", None) or "").strip() or None
    previous_date = case.next_hearing_date
    expected_date = update_data.pop("expected_hearing_date", previous_date)
    expected_updated_at = update_data.pop("expected_updated_at", None)
    if expected_updated_at is not None and expected_updated_at != case.updated_at:
        raise HTTPException(status_code=409, detail="This case was updated elsewhere. Refresh the dashboard and review the latest changes before saving.")
    if "next_hearing_date" in update_data and expected_date != previous_date:
        raise HTTPException(status_code=409, detail="The hearing date changed. Refresh the dashboard before saving.")
    date_changed = "next_hearing_date" in update_data and update_data["next_hearing_date"] != previous_date
    if hearing_notes and not (date_changed and previous_date):
        raise HTTPException(status_code=422, detail="Change or clear the current hearing date to save hearing notes.")
    if date_changed and previous_date:
        db.add(HearingHistory(
            case_id=case.id,
            hearing_date=previous_date,
            next_hearing_date=update_data["next_hearing_date"],
            notes=hearing_notes,
        ))
    _apply_case_updates(case, update_data)

    db.commit()
    db.refresh(case)

    return case


@router.get("/{case_id}/hearing-history", response_model=List[HearingHistoryRead])
def get_hearing_history(
    case_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Any:
    case = get_case(case_id, db, current_user)
    return db.scalars(
        select(HearingHistory)
        .where(HearingHistory.case_id == case.id)
        .order_by(HearingHistory.id.desc())
    ).all()


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case(
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
