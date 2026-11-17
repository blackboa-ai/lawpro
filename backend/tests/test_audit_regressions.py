"""Audit regression coverage using only a disposable in-memory database."""

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import Base
from app.models.case import Case
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.core.config import settings


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


@pytest.mark.parametrize("password", ["lawpro-test-password", "x" * 72, "\u00e9" * 36])
def test_password_utf8_boundaries(client, password):
    assert client.post("/api/v1/auth/register", json={"email": "bytes@example.com", "password": password}).status_code == 201
    assert client.post("/api/v1/auth/login", data={"username": "bytes@example.com", "password": password}).status_code == 200
    for oversized in ("\u00e9" * 36 + "x", "x" * 73):
        response = client.post("/api/v1/auth/register", json={"email": "reject@example.com", "password": oversized})
        assert response.status_code == 422
        assert "72 UTF-8 bytes" in response.text
        assert client.post("/api/v1/auth/login", data={"username": "bytes@example.com", "password": oversized}).status_code == 422


def test_malformed_login_forms_are_rejected(client):
    url = "/api/v1/auth/login"
    malformed = client.post(
        url, content=b"invalid", headers={"Content-Type": "multipart/form-data"}
    )
    assert malformed.status_code == 400
    assert client.post(url, data={"username": "missing@example.com"}).status_code == 422


@pytest.mark.parametrize("encoding", ["multipart/form-data", "application/x-www-form-urlencoded"])
def test_oversized_login_form_fields_are_rejected(client, encoding):
    oversized = b"x" * (1024 * 1024 + 1)
    if encoding == "multipart/form-data":
        body = b'--lawpro\r\nContent-Disposition: form-data; name="username"\r\n\r\n'
        body += oversized + b"\r\n--lawpro--\r\n"
        encoding += "; boundary=lawpro"
    else:
        body = b"username=" + oversized
    response = client.post("/api/v1/auth/login", content=body, headers={"Content-Type": encoding})
    assert response.status_code == 400


def test_registered_user_authentication_and_case_isolation(client):
    email = "isolated@example.com"
    password = "lawpro-test-password"
    registration = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert registration.status_code == 201
    assert "password" not in registration.json()
    assert "password_hash" not in registration.json()

    for username in (email, "unknown@example.com"):
        failure = client.post("/api/v1/auth/login", data={"username": username, "password": "wrong"})
        assert failure.status_code == 401
        assert failure.json()["detail"] == "Incorrect email or password"
        assert failure.headers["WWW-Authenticate"] == "Bearer"

    # Exercise real JWT verification instead of the fixture's synthetic case owner.
    with pytest.MonkeyPatch.context() as patch:
        patch.delitem(app.dependency_overrides, get_current_user)
        login = client.post("/api/v1/auth/login", data={"username": email, "password": password})
        assert login.status_code == 200
        assert login.json()["token_type"] == "bearer"
        token = login.json()["access_token"]
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert claims["sub"] == str(registration.json()["id"])
        assert claims["exp"] > datetime.now(timezone.utc).timestamp()
        headers = {"Authorization": f"Bearer {token}"}
        assert client.get("/api/v1/auth/me", headers=headers).json()["email"] == email
        assert client.get("/api/v1/cases/", headers=headers).json() == []
        assert client.get("/api/v1/cases/1", headers=headers).status_code == 404
        assert client.get("/api/v1/cases/1/hearing-history", headers=headers).status_code == 404

        expired = jwt.encode(
            {**claims, "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        invalid_signature = jwt.encode(claims, "untrusted-test-key", algorithm=settings.ALGORITHM)
        assert client.get("/api/v1/auth/me").status_code == 401
        for invalid_token in ("malformed", expired, invalid_signature):
            invalid_headers = {"Authorization": f"Bearer {invalid_token}"}
            assert client.get("/api/v1/auth/me", headers=invalid_headers).status_code == 401
            assert client.get("/api/v1/cases/", headers=invalid_headers).status_code == 401
