"""Audit regression coverage using only a disposable in-memory database."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import Base
from app.models.case import Case
from app.models.user import User
from app.api.v1.auth import get_current_user


@pytest.fixture
def client():
    engine = create_engine("sqlite://", poolclass=StaticPool,
                           connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(email="audit@example.com", password_hash="unused", role="advocate")
        other = User(email="other@example.com", password_hash="unused", role="advocate")
        db.add_all([owner, other])
        db.commit()
        owner_id, other_id = owner.id, other.id
        for i in range(31):
            db.add(Case(user_id=owner_id, case_title=f"Matter {i}",
                        status="pending", next_hearing_date=date(2026, 12, 1)))
        db.add(Case(user_id=owner_id, case_title="100% literal_", status="completed"))
        db.add(Case(user_id=other_id, case_title="Matter private", status="pending"))
        db.commit()
    def session():
        with Session(engine) as db:
            yield db
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = session
    app.dependency_overrides[get_current_user] = lambda: User(id=owner_id)
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_pagination_filters_export_and_stats(client):
    params = {"limit": 25, "search": "Matter", "case_status": "pending"}
    first = client.get("/api/v1/cases/", params=params, headers={"Origin": "http://localhost:3000"})
    assert first.status_code == 200
    assert first.headers["X-Total-Count"] == "31"
    assert "X-Total-Count" in first.headers["Access-Control-Expose-Headers"]
    second = client.get("/api/v1/cases/", params={**params, "offset": 25})
    all_cases = first.json() + second.json()
    assert len(all_cases) == len({row["id"] for row in all_cases}) == 31
    assert len(client.get("/api/v1/cases/").json()) == 32
    assert len(client.get("/api/v1/cases/", params={"search": "%"}).json()) == 1
    assert len(client.get("/api/v1/cases/", params={"search": "_"}).json()) == 1
    assert client.get("/api/v1/cases/", params={"upcoming_before": "2026-12-01"}).json() == []
    assert client.get("/api/v1/cases/dashboard?today=2026-12-01").json() == {
        "total_cases": 32, "pending_cases": 31, "ongoing_cases": 0,
        "completed_cases": 1, "upcoming_hearings": 31,
    }
    assert client.get("/api/v1/cases/?limit=201").status_code == 422


@pytest.mark.parametrize("field,length", [("case_title", 255), ("case_number", 100),
                                          ("court_name", 150), ("client_name", 255), ("case_type", 100)])
def test_case_lengths_and_status(client, field, length):
    payload = {"case_title": "Valid", field: "x" * length}
    created = client.post("/api/v1/cases/", json=payload)
    assert created.status_code == 201
    path = f"/api/v1/cases/{created.json()['id']}"
    payload[field] += "x"
    assert client.post("/api/v1/cases/", json=payload).status_code == 422
    assert client.put(path, json={field: payload[field]}).status_code == 422
    assert client.post("/api/v1/cases/", json={"case_title": "Valid", "status": "invalid"}).status_code == 422
    assert client.put(path, json={"status": "invalid"}).status_code == 422
    for status in ("pending", "ongoing", "completed", "dismissed"):
        assert client.put(path, json={"status": status}).json()["status"] == status


def test_password_utf8_boundaries(client):
    password = "\u00e9" * 36  # 72 UTF-8 bytes, 36 characters
    assert client.post("/api/v1/auth/register", json={"email": "bytes@example.com", "password": password}).status_code == 201
    assert client.post("/api/v1/auth/login", data={"username": "bytes@example.com", "password": password}).status_code == 200
    for oversized in (password + "x", "x" * 73):
        response = client.post("/api/v1/auth/register", json={"email": "reject@example.com", "password": oversized})
        assert response.status_code == 422
        assert "72 UTF-8 bytes" in response.text
        assert client.post("/api/v1/auth/login", data={"username": "bytes@example.com", "password": oversized}).status_code == 422
