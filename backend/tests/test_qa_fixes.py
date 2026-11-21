"""Regressions for QA fixes; use only a disposable, in-memory database."""
from datetime import datetime
import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db import get_db
from app.main import app
from app.models import Base


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)

    def session():
        with Session(engine) as db:
            yield db

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_registration_name_and_email_limits(client):
    payload = {"email": "limit@example.com", "password": "A strong test password"}
    for field, invalid in (
        ("full_name", "a" * 256),
        ("email", "x" * 245 + "@example.com"),
    ):
        assert client.post("/api/v1/auth/register", json={**payload, field: invalid}).status_code == 422
    accepted = client.post("/api/v1/auth/register", json={**payload, "full_name": "A" * 255})
    assert accepted.status_code == 201
    assert accepted.json()["full_name"] == "A" * 255


def test_real_timestamps_and_optimistic_case_edits(client):
    account = {"email": "qa-case@example.com", "password": "ExamplePass123", "full_name": "QA Lawyer"}
    response = client.post("/api/v1/auth/register", json=account)
    assert response.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        data={"username": account["email"], "password": account["password"]},
    )
    assert login.status_code == 200
    claims = jwt.decode(login.json()["access_token"], settings.SECRET_KEY, algorithms=["HS256"])
    assert claims["full_name"] == "QA Lawyer"
    headers = {"Authorization": "Bearer " + login.json()["access_token"]}
    created = client.post("/api/v1/cases/", json={"case_title": "Property matter"}, headers=headers)
    assert created.status_code == 201
    item = created.json()
    assert datetime.fromisoformat(item["created_at"]) > datetime(2020, 1, 1)
    expected = item["updated_at"]
    url = "/api/v1/cases/" + str(item["id"])
    edited = client.put(url, json={"status": "ongoing", "expected_updated_at": expected}, headers=headers)
    assert edited.status_code == 200
    assert edited.json()["updated_at"] != expected
    stale = client.put(url, json={"description": "Lost update", "expected_updated_at": expected}, headers=headers)
    assert stale.status_code == 409
    assert client.get(url, headers=headers).json()["description"] is None
    current = edited.json()["updated_at"]
    assert client.put(
        url, json={"description": "Safe update", "expected_updated_at": current}, headers=headers
    ).status_code == 200


def test_category_punctuation_does_not_allow_external_urls(client):
    registered = client.post(
        "/api/v1/auth/register", json={"email": "qa-research@example.com", "password": "ExamplePass123"}
    )
    assert registered.status_code == 201
    login = client.post(
        "/api/v1/auth/login", data={"username": "qa-research@example.com", "password": "ExamplePass123"}
    )
    headers = {"Authorization": "Bearer " + login.json()["access_token"]}
    # A valid category reaches the configured source (or returns service unavailable);
    # it must not fail local request validation.
    response = client.get("/api/v1/legal-intelligence/updates", params={"category": "Civil & Commercial"}, headers=headers)
    assert response.status_code != 422
    invalid = client.get(
        "/api/v1/legal-intelligence/updates", params={"category": "https://example.org"}, headers=headers
    )
    assert invalid.status_code == 422


def test_database_readiness_uses_disposable_session(client):
    assert client.get("/health").json()["status"] == "healthy"
    assert client.get("/ready").json()["status"] == "ready"
