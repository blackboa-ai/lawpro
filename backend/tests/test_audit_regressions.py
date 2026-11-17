"""Audit regression coverage using only a disposable in-memory database."""

from datetime import date, datetime, timedelta, timezone
from secrets import token_hex, token_urlsafe

import pytest
from fastapi.testclient import TestClient
from jose import jws, jwt
from jose.utils import base64url_encode
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import Base
from app.models.case import Case
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.core.config import Settings, settings


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
        before_login = int(datetime.now(timezone.utc).timestamp())
        login = client.post("/api/v1/auth/login", data={"username": email, "password": password})
        after_login = int(datetime.now(timezone.utc).timestamp())
        assert login.status_code == 200
        assert login.json()["token_type"] == "bearer"
        token = login.json()["access_token"]
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert claims["sub"] == str(registration.json()["id"])
        assert jwt.get_unverified_header(token)["alg"] == "HS256"
        assert before_login + 1800 <= claims["exp"] <= after_login + 1800
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


def test_rejects_jwt_algorithm_confusion_and_malformed_segments(client, monkeypatch):
    monkeypatch.delitem(app.dependency_overrides, get_current_user)
    claims = {"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(minutes=1)}
    valid_token = jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {valid_token}"}).status_code == 200
    _, payload, signature = valid_token.split(".")
    none_header = base64url_encode(b'{"alg":"none","typ":"JWT"}').decode()
    invalid_tokens = (
        f"{none_header}.{payload}.",
        jwt.encode(claims, settings.SECRET_KEY, algorithm="HS384"),
        f"not-json.{payload}.{signature}",
        jws.sign(b"not JSON", settings.SECRET_KEY, algorithm=settings.ALGORITHM),
    )
    invalid_headers = [f"Bearer {token}" for token in invalid_tokens]
    invalid_headers.extend((f"Basic {valid_token}", "Bearer"))
    for authorization in invalid_headers:
        response = client.get("/api/v1/auth/me", headers={"Authorization": authorization})
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "expiration",
    [{}, {"exp": None}, {"exp": float("inf")}],
    ids=["missing", "null", "overflow"],
)
def test_rejects_jwt_without_valid_expiration(client, monkeypatch, expiration):
    monkeypatch.delitem(app.dependency_overrides, get_current_user)
    token = jwt.encode(
        {"sub": "1", **expiration}, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    headers = {"Authorization": f"Bearer {token}"}
    for path in ("/api/v1/auth/me", "/api/v1/cases/"):
        response = client.get(path, headers=headers)
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("generate", [token_hex, token_urlsafe], ids=["hex", "base64url"])
def test_settings_accept_generated_hs256_key_without_changing_it(generate):
    key = generate(32)
    configured = Settings(_env_file=None, SECRET_KEY=key, ALGORITHM="HS256")
    assert configured.SECRET_KEY == key
    assert configured.ACCESS_TOKEN_EXPIRE_MINUTES == 30


@pytest.mark.parametrize(
    "key",
    [
        "",
        "abcd",
        "your-secret-key-change-this-in-production",
        "change-me-" + "x" * 33,
        "00" * 32,
        bytes(range(32)).hex(),
        (bytes(range(0, 48, 3)) * 2).hex(),
        b"an encoded human-readable phrase".hex(),
        # DER SubjectPublicKeyInfo envelope containing a synthetic Ed25519 public key.
        "302a300506032b6570032100" + bytes(range(32)).hex(),
    ],
    ids=["empty", "short", "example", "placeholder", "zeros", "sequence", "repeated",
         "encoded-phrase", "der-public-key"],
)
def test_settings_reject_invalid_jwt_signing_secret(key):
    with pytest.raises(ValidationError, match="SECRET_KEY") as rejected:
        Settings(_env_file=None, SECRET_KEY=key)
    if key:
        assert key not in str(rejected.value)


def test_settings_require_jwt_signing_secret(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None)


@pytest.mark.parametrize("algorithm", ["HS384", "RS256", "none"])
def test_settings_reject_other_jwt_algorithms(algorithm):
    with pytest.raises(ValidationError, match="ALGORITHM"):
        Settings(_env_file=None, ALGORITHM=algorithm)


def test_settings_reject_nonstandard_jwt_lifetime():
    with pytest.raises(ValidationError, match="ACCESS_TOKEN_EXPIRE_MINUTES"):
        Settings(_env_file=None, ACCESS_TOKEN_EXPIRE_MINUTES="1440")
