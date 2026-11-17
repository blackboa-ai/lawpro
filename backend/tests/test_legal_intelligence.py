"""Exercise the authenticated proxy using the verified public response shapes."""

from datetime import datetime, timedelta, timezone
from secrets import token_hex
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient
from jose import jwt as jose_jwt
from pydantic import SecretStr, ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import Settings, settings
from app.db import get_db
from app.legal_intelligence import LegalAggregator
from app.main import app
from app.models import Base
from app.models.case import Case
from app.models.user import User
from tests.legal_source_fixture import ITEMS, LegalSourceFixture

ROOT = "/api/v1/legal-intelligence"
BASE = "https://upstream.example/api/v1"


@pytest.fixture
def research():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(User(id=1, email="lawyer@example.com", password_hash="unused", role="advocate"))
        db.add(Case(user_id=1, case_title="Private trial title", client_name="Private client"))
        db.commit()

    statements = []

    @event.listens_for(engine, "before_cursor_execute")
    def record_query(_connection, _cursor, statement, *_args):
        statements.append(statement)

    def session():
        with Session(engine) as db:
            yield db

    def token(expiry):
        return jose_jwt.encode(
            {"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(minutes=expiry)},
            settings.SECRET_KEY,
            algorithm="HS256",
        )

    requests = []
    source = LegalSourceFixture()

    def record_request(request):
        requests.append(request)
        return source(request)

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = session
    try:
        with TestClient(app) as client:
            service = LegalAggregator(BASE, transport=httpx.MockTransport(record_request))
            app.state.legal_aggregator = service
            jwt = token(10)
            client.headers.update({"Authorization": f"Bearer {jwt}", "Cookie": "private=case-note"})
            yield client, service, requests, statements, jwt, token(-10)
    finally:
        app.dependency_overrides = previous
        engine.dispose()


def test_listing_filter_pagination_metadata_and_cache(research):
    client, _, requests, *_ = research
    params = {"court": "sc", "category": "Criminal", "date_from": "2026-11-05", "date_to": "2026-11-15"}
    first = client.get(f"{ROOT}/updates", params=params)
    assert first.status_code == 200
    assert first.headers["cache-control"] == "no-store"
    assert len(first.json()["items"]) == 10
    assert first.json()["has_more"]
    assert first.json()["items"][-1]["url"] is None
    assert "full_text" not in first.json()["items"][0]
    assert requests[0].url.path == "/api/v1/judgments"
    assert dict(requests[0].url.params) == {**params, "limit": "10", "offset": "0"}

    second = client.get(f"{ROOT}/updates", params={**params, "offset": 10}).json()
    assert [item["id"] for item in second["items"]] == [ITEMS[10]["id"]]
    assert not second["has_more"]
    assert client.get(f"{ROOT}/updates", params={"category": "Family"}).json()["items"] == []
    options = client.get(f"{ROOT}/filters").json()
    assert options["courts"][0]["code"] == "sc"
    assert options["categories"][0]["name"] == "Criminal"
    assert client.get(f"{ROOT}/filters").json() == options
    assert len(requests) == 5
    for _ in range(2):
        assert client.get(f"{ROOT}/updates").status_code == 200
    assert len(requests) == 6
    assert sorted(r.url.path for r in requests[-3:-1]) == ["/api/v1/categories", "/api/v1/courts"]


def test_search_normalizes_without_forwarding_identity_or_accessing_cases(research):
    client, service, requests, statements, jwt, _ = research
    params = {"q": " bail ", "court": "sc", "category": "Criminal", "offset": 10}
    response = client.get(f"{ROOT}/updates", params=params)
    assert response.status_code == 200
    assert response.json()["items"][0]["title"] == ITEMS[10]["title"]
    assert response.json()["items"][0]["url"] == "https://example.org/"
    assert client.get(f"{ROOT}/updates", params=params).status_code == 200
    assert len(requests) == 2
    assert not service.cache
    assert statements and all("cases" not in statement.lower() for statement in statements)
    for request in requests:
        assert request.url.path == "/api/v1/search"
        assert dict(request.url.params) == {**params, "q": "bail", "offset": "0", "limit": "25"}
        assert "authorization" not in request.headers
        assert "cookie" not in request.headers
        assert not request.content
        assert jwt not in str(request.url)


def test_listing_accepts_page_number_envelope_and_rejects_mismatched_page(research):
    client, service, *_ = research
    source = LegalSourceFixture()

    def page_number_response(request):
        response = source(request).json()
        limit, offset = response.pop("limit"), response.pop("offset")
        # Simulate an upstream that returns its first page again on a later request.
        page = 1 if offset == 12 else offset // limit + 1
        return httpx.Response(200, json={**response, "page": page, "page_size": limit})

    service.transport = httpx.MockTransport(page_number_response)
    first = client.get(f"{ROOT}/updates", params={"limit": 6})
    assert first.status_code == 200
    assert first.json()["has_more"]
    second = client.get(f"{ROOT}/updates", params={"limit": 6, "offset": 6})
    assert second.status_code == 200
    assert [item["id"] for item in second.json()["items"]] == [row["id"] for row in ITEMS[6:12]]
    assert client.get(f"{ROOT}/updates", params={"limit": 6, "offset": 12}).status_code == 502


def test_detail_normalizes_and_rejects_invalid_ids(research):
    client, _, requests, *_ = research
    item_id = ITEMS[0]["id"]
    detail = client.get(f"{ROOT}/updates/{item_id}")
    assert detail.status_code == 200
    assert detail.json()["full_text"] == ITEMS[0]["full_text"]
    assert detail.json()["url"] == "https://example.org/"
    assert client.get(f"{ROOT}/updates/{UUID(int=99)}").status_code == 404
    assert client.get(f"{ROOT}/updates/not-a-uuid").status_code == 422
    assert len(requests) == 2


@pytest.mark.parametrize("query", [
    {"q": "x" * 201}, {"q": "  "}, {"q": "a\nb"}, {"limit": 26}, {"offset": 1001},
    {"court": "../courts"}, {"category": "https://example.org"}, {"mode": "vector"},
    {"mode": "keyword"}, {"q": "bail", "date_from": "2026-11-01"}, {"date_to": "2026-02-31"},
    {"date_from": "2026-11-01", "date_to": "2026-01-01"}, {"url": "https://example.org"},
])
def test_invalid_input_never_reaches_upstream(research, query):
    client, _, requests, *_ = research
    assert client.get(f"{ROOT}/updates", params=query).status_code == 422
    assert not requests


def test_all_routes_require_active_lawpro_session(research):
    client, _, requests, _statements, _jwt, expired = research
    for suffix in ("/updates", "/filters", f"/updates/{ITEMS[0]['id']}"):
        assert client.get(f"{ROOT}{suffix}", headers={"Authorization": ""}).status_code == 401
        assert client.get(f"{ROOT}{suffix}", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    assert not requests


@pytest.mark.parametrize(("kind", "status"), [
    ("timeout", 504), ("transport", 503), ("rate", 503), ("outage", 503),
    ("private", 502), ("redirect", 502), ("json", 502), ("large", 502),
    ("schema", 502), ("page", 502), ("search-page", 502), ("unconfigured", 503),
])
def test_errors_are_safe_and_uncached(research, kind, status):
    client, service, *_ = research
    calls = []

    def fail(request):
        calls.append(request)
        if kind == "timeout":
            raise httpx.ReadTimeout("private upstream detail")
        if kind == "transport":
            raise httpx.ConnectError("private upstream detail")
        if kind == "redirect":
            return httpx.Response(302, headers={"Location": "https://other.example/private"})
        if kind == "json":
            return httpx.Response(200, content="private upstream detail")
        if kind == "large":
            return httpx.Response(200, content=b"x" * (4 * 1024 * 1024 + 1))
        if kind == "schema":
            return httpx.Response(200, json={"data": [{"title": "Missing ID"}], "limit": 10, "offset": 0, "total": 1})
        if kind == "search-page":
            return httpx.Response(200, json={"results": ITEMS[:1], "total": 11})
        if kind == "page":
            return httpx.Response(200, json={"data": [], "limit": 10, "offset": 1, "total": 1})
        return httpx.Response({"rate": 429, "outage": 500, "private": 401}[kind], text="private upstream detail")

    service.transport = httpx.MockTransport(fail)
    if kind == "unconfigured":
        service.base_url = None
    for _ in range(2):
        params = {"q": "bail"} if kind == "search-page" else {}
        response = client.get(f"{ROOT}/updates", params=params)
        assert response.status_code == status
        assert "private" not in response.text
        assert response.headers["cache-control"] == "no-store"
    assert len(calls) == (0 if kind == "unconfigured" else 2)


@pytest.mark.parametrize("base", [
    "https://user:pass@example.org/api/v1", "https://example.org/api/v1?secret=yes",
    "http://example.org/api/v1", "https://example.org/other", "https://example.org:65536/api/v1",
])
def test_aggregator_settings_reject_unsafe_bases(base):
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="sqlite:///:memory:", SECRET_KEY=token_hex(32),
            FRONTEND_HOST="http://localhost:3000", LEGAL_AGGREGATOR_API_URL=base,
        )


@pytest.mark.parametrize(("header", "expected"), [
    ("X-API-Key", "fixture-key"),
    ("Authorization", "Bearer fixture-key"),
])
def test_aggregator_key_is_sent_only_to_configured_origin(research, header, expected):
    client, service, *_ = research
    requests = []

    def redirect(request):
        requests.append(request)
        return httpx.Response(302, headers={"Location": "https://other.example/api/v1/judgments"})

    service.api_key_header = header
    service.api_key = SecretStr("fixture-key")
    service.transport = httpx.MockTransport(redirect)

    response = client.get(f"{ROOT}/updates")
    assert response.status_code == 502
    assert "fixture-key" not in response.text
    assert len(requests) == 1
    assert requests[0].url.host == "upstream.example"
    assert requests[0].headers[header] == expected
    assert "cookie" not in requests[0].headers
    if header != "Authorization":
        assert "authorization" not in requests[0].headers


@pytest.mark.parametrize(("base", "header", "key"), [
    (None, "X-API-Key", "fixture-key"),
    ("http://localhost/api/v1", "X-API-Key", "fixture-key"),
    (BASE, "Host", "fixture-key"),
    (BASE, "X-API-Key", None),
    (BASE, "X-API-Key", "invalid\r\nkey"),
])
def test_settings_reject_invalid_aggregator_auth(base, header, key):
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="sqlite:///:memory:", SECRET_KEY=token_hex(32),
            FRONTEND_HOST="http://localhost:3000", LEGAL_AGGREGATOR_API_URL=base,
            LEGAL_AGGREGATOR_API_KEY_HEADER=header, AUTHORIZED_API_KEY1=key,
        )
