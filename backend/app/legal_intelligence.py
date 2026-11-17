"""Bounded client for public India Legal News Aggregator content."""

import asyncio
import json
import re
from collections import OrderedDict
from datetime import date
from time import monotonic
from typing import TypeVar
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError, field_validator

MAX_BODY = 4 * 1024 * 1024
MAX_OFFSET = 1000
SEARCH_WINDOW = 25
T = TypeVar("T", bound=BaseModel)


class AggregatorError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message


def safe_source_url(value: str | None) -> str | None:
    if not value or len(value) > 4096 or re.search(r"[\s\\\x00-\x1f\x7f]", value):
        return None
    try:
        url = urlsplit(value)
        if (
            url.scheme in {"http", "https"}
            and url.hostname
            and url.username is None
            and url.password is None
            and (url.port is None or 1 <= url.port <= 65535)
        ):
            return value
    except ValueError:
        pass
    return None


class LegalItem(BaseModel):
    id: UUID
    title: str = Field(min_length=1)
    court_name: str | None = None
    judgment_date: date | None = None
    subject_category: str | None = None
    source: str | None = None
    excerpt: str | None = None
    url: str | None = None

    @field_validator("title", "court_name", "subject_category", "source", "excerpt", mode="before")
    @classmethod
    def trim_public_text(cls, value, info):
        if isinstance(value, str):
            return value.strip()[: 600 if info.field_name == "excerpt" else 400]
        return value

    @field_validator("url")
    @classmethod
    def validate_source_url(cls, value: str | None) -> str | None:
        return safe_source_url(value)


class LegalDetail(LegalItem):
    full_text: str | None = None

    @field_validator("full_text")
    @classmethod
    def bound_reader_text(cls, value: str | None) -> str | None:
        if value and len(value) > 60_000:
            return value[:60_000] + "\n\n[Continued at the original source.]"
        return value


class LegalPage(BaseModel):
    items: list[LegalItem]
    offset: int
    limit: int
    has_more: bool


class CourtOption(BaseModel):
    code: str = Field(pattern=r"^[a-z0-9-]{1,50}$")
    name: str = Field(min_length=1, max_length=150)


class CategoryOption(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class LegalFilters(BaseModel):
    courts: list[CourtOption] = Field(max_length=100)
    categories: list[CategoryOption] = Field(max_length=100)


class UpstreamPage(BaseModel):
    model_config = ConfigDict(strict=True)
    total: int = Field(ge=0)


class FeedPage(UpstreamPage):
    data: list[LegalItem] = Field(max_length=25)
    limit: int
    offset: int


class SearchPage(UpstreamPage):
    results: list[LegalItem] = Field(max_length=25)


class LegalAggregator:
    def __init__(
        self,
        base_url: str | None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        api_key_header: str | None = None,
        api_key: SecretStr | None = None,
    ):
        self.base_url = base_url
        self.transport = transport
        self.api_key_header = api_key_header
        self.api_key = api_key
        self.slots = asyncio.Semaphore(8)
        self.cache: OrderedDict[tuple, tuple[float, BaseModel]] = OrderedDict()
        self.cache_locks = [asyncio.Lock() for _ in range(16)]

    async def _get(self, path: str, params: dict | None = None, *, detail: bool = False):
        if not self.base_url:
            raise AggregatorError(503, "Legal research is temporarily unavailable.")
        headers = {"Accept": "application/json"}
        if self.api_key_header and self.api_key:
            value = self.api_key.get_secret_value()
            if self.api_key_header.lower() == "authorization":
                value = f"Bearer {value}"
            headers[self.api_key_header] = value
        try:
            async with asyncio.timeout(15), self.slots:
                # Each call has its own cookie jar. Only the public query parameters go upstream.
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(10, connect=4),
                    follow_redirects=False,
                    trust_env=False,
                    transport=self.transport,
                ) as client, client.stream(
                    "GET", f"{self.base_url}{path}", params=params, headers=headers
                ) as response:
                    if response.status_code == 404 and detail:
                        raise AggregatorError(404, "This update is no longer available.")
                    if response.status_code == 429 or response.status_code >= 500:
                        raise AggregatorError(503, "The legal source is temporarily unavailable. Try again shortly.")
                    response.raise_for_status()
                    body = bytearray()
                    async for chunk in response.aiter_bytes(chunk_size=64 * 1024):
                        if len(body) + len(chunk) > MAX_BODY:
                            raise ValueError("Legal source response too large")
                        body.extend(chunk)
                    return json.loads(body)
        except (TimeoutError, httpx.TimeoutException):
            raise AggregatorError(504, "The legal source took too long to respond. Try again shortly.") from None
        except httpx.TransportError:
            raise AggregatorError(503, "The legal source is temporarily unavailable. Try again shortly.") from None
        except (httpx.HTTPError, ValueError, RecursionError):
            raise AggregatorError(502, "The legal source returned an unexpected response.") from None

    async def _cached(self, key: tuple, ttl: int, load):
        try:
            async with asyncio.timeout(16), self.cache_locks[hash(key) % len(self.cache_locks)]:
                cached = self.cache.get(key)
                if cached and cached[0] > monotonic():
                    self.cache.move_to_end(key)
                    return cached[1]
                value = await load()
                self.cache[key] = (monotonic() + ttl, value)
                self.cache.move_to_end(key)
                if len(self.cache) > 64:
                    self.cache.popitem(last=False)
                return value
        except TimeoutError:
            raise AggregatorError(504, "The legal source took too long to respond. Try again shortly.") from None

    async def _model(self, model: type[T], path: str, params: dict | None = None, *, detail: bool = False) -> T:
        return self._validate(model, await self._get(path, params, detail=detail))

    @staticmethod
    def _validate(model: type[T], payload) -> T:
        try:
            return model.model_validate(payload)
        except ValidationError:
            raise AggregatorError(502, "The legal source returned an unexpected response.") from None

    async def page(self, *, q: str | None, params: dict, limit: int, offset: int) -> LegalPage:
        async def load() -> LegalPage:
            if q:
                # The upstream search cache omits offset and mode from its internal key.
                # Request a stable first window and paginate the returned ranked items here.
                upstream = await self._model(
                    SearchPage, "/search", {**params, "q": q, "limit": SEARCH_WINDOW, "offset": 0},
                )
                if len(upstream.results) != min(upstream.total, SEARCH_WINDOW):
                    raise AggregatorError(502, "The legal source returned an incomplete search page.")
                items = upstream.results[offset:offset + limit]
                total = len(upstream.results)
            else:
                upstream = await self._model(FeedPage, "/judgments", params)
                if upstream.offset != offset or upstream.limit != limit:
                    raise AggregatorError(502, "The legal source returned an unexpected page.")
                items = upstream.data
                total = upstream.total
            if len(items) > limit:
                raise AggregatorError(502, "The legal source returned an unexpected page.")
            return LegalPage(
                items=items,
                limit=limit,
                offset=offset,
                has_more=(
                    len(items) == limit
                    and offset + limit < total
                    and offset + limit <= MAX_OFFSET
                ),
            )

        # Cache only browse requests without user-authored strings.
        if q or params.get("court") or params.get("category"):
            return await load()
        return await self._cached(("feed", *sorted(params.items())), 45, load)

    async def detail(self, item_id: UUID) -> LegalDetail:
        async def load() -> LegalDetail:
            item = await self._model(LegalDetail, f"/judgments/{item_id}", detail=True)
            if item.id != item_id:
                raise AggregatorError(502, "The legal source returned an unexpected result.")
            return item

        return await self._cached(("detail", item_id), 90, load)

    async def filters(self) -> LegalFilters:
        async def load() -> LegalFilters:
            # Cancel the other metadata request if one fails.
            courts = asyncio.create_task(self._get("/courts"))
            categories = asyncio.create_task(self._get("/categories"))
            try:
                values = await asyncio.gather(courts, categories)
            finally:
                for task in (courts, categories):
                    task.cancel()
                await asyncio.gather(courts, categories, return_exceptions=True)
            return self._validate(LegalFilters, {"courts": values[0], "categories": values[1]})

        return await self._cached(("filters",), 600, load)
