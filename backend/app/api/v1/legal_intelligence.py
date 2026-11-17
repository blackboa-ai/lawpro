"""Authenticated read-only access to public legal research."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.api.v1.auth import get_current_user
from app.legal_intelligence import MAX_OFFSET, LegalAggregator, LegalDetail, LegalFilters, LegalPage

router = APIRouter(dependencies=[Depends(get_current_user)])


class ResearchQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str | None = Field(default=None, max_length=200, pattern=r"^[^\x00-\x1f\x7f]+$")
    court: str | None = Field(default=None, pattern=r"^[a-z0-9-]{1,50}$")
    category: str | None = Field(default=None, pattern=r"^[A-Za-z][A-Za-z -]{0,79}$")
    date_from: date | None = None
    date_to: date | None = None
    limit: int = Field(default=10, ge=1, le=25)
    offset: int = Field(default=0, ge=0, le=MAX_OFFSET)


def aggregator(request: Request, response: Response) -> LegalAggregator:
    response.headers["Cache-Control"] = "no-store"
    return request.app.state.legal_aggregator


Client = Annotated[LegalAggregator, Depends(aggregator)]


@router.get("/updates")
async def updates(query: Annotated[ResearchQuery, Query()], client: Client) -> LegalPage:
    q = query.q.strip() if query.q else None
    if query.q is not None and not q:
        raise HTTPException(422, "Enter a search term.")
    if q and (query.date_from or query.date_to):
        raise HTTPException(422, "Date filters are available when browsing updates.")
    if query.date_from and query.date_to and query.date_from > query.date_to:
        raise HTTPException(422, "The end date must be on or after the start date.")
    params = query.model_dump(mode="json", exclude={"q"}, exclude_none=True)
    return await client.page(q=q, params=params, limit=query.limit, offset=query.offset)


@router.get("/filters")
async def filters(client: Client) -> LegalFilters:
    return await client.filters()


@router.get("/updates/{item_id}")
async def update_detail(item_id: UUID, client: Client) -> LegalDetail:
    return await client.detail(item_id)
