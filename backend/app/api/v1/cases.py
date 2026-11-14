"""Case management endpoints."""

from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter()


# In-memory storage for now (replace with database)
FAKE_CASES = [
    {
        "id": 1,
        "title": "Civil Suit - Property Dispute",
        "case_number": "CS-2024-001",
        "court": "District Court, Mumbai",
        "next_hearing": "2024-12-15",
        "notes": "Filed by advocate XYZ",
    }
]


@router.get("/", response_model=List[dict])
async def list_cases() -> Any:
    """List all cases sorted by next hearing date."""
    return sorted(FAKE_CASES, key=lambda x: x["next_hearing"])


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_case(case_data: dict) -> Any:
    """Create a new case."""
    case_id = len(FAKE_CASES) + 1
    case = {"id": case_id, **case_data}
    FAKE_CASES.append(case)
    return case


@router.get("/{case_id}", response_model=dict)
async def get_case(case_id: int) -> Any:
    """Get a specific case."""
    for case in FAKE_CASES:
        if case["id"] == case_id:
            return case
    raise HTTPException(status_code=404, detail="Case not found")


@router.put("/{case_id}", response_model=dict)
async def update_case(case_id: int, case_data: dict) -> Any:
    """Update a case."""
    for idx, case in enumerate(FAKE_CASES):
        if case["id"] == case_id:
            FAKE_CASES[idx] = {"id": case_id, **case_data}
            return FAKE_CASES[idx]
    raise HTTPException(status_code=404, detail="Case not found")


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(case_id: int) -> None:
    """Delete a case."""
    for idx, case in enumerate(FAKE_CASES):
        if case["id"] == case_id:
            FAKE_CASES.pop(idx)
            return
    raise HTTPException(status_code=404, detail="Case not found")