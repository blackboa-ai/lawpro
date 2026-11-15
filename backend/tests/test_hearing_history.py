"""Verify hearing history through the authenticated case API."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import Base


def test_rescheduling_preserves_history_and_case_ownership():
    engine = create_engine(
        "sqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)

    def test_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = test_db
    try:
        with TestClient(app) as client:
            def auth(email):
                credentials = {"email": email, "password": "TestPassword123"}
                assert client.post("/api/v1/auth/register", json=credentials).status_code == 201
                login = client.post("/api/v1/auth/login", data={
                    "username": email, "password": credentials["password"],
                })
                assert login.status_code == 200
                return {"Authorization": f"Bearer {login.json()['access_token']}"}

            owner = auth("owner@example.com")
            outsider = auth("outsider@example.com")
            created = client.post("/api/v1/cases/", headers=owner, json={
                "case_title": "Sample property case", "next_hearing_date": "2026-12-10",
            })
            assert created.status_code == 201
            case_url = f"/api/v1/cases/{created.json()['id']}"
            history_url = f"{case_url}/hearing-history"

            assert client.put(case_url, headers=outsider, json={"next_hearing_date": None}).status_code == 404
            assert client.get(history_url, headers=outsider).status_code == 404
            rejected = client.put(case_url, headers=owner, json={
                "case_title": "Unsaved edit", "hearing_notes": "No date change",
            })
            assert rejected.status_code == 422
            assert client.get(case_url, headers=owner).json()["case_title"] == "Sample property case"

            updated = client.put(case_url, headers=owner, json={
                "case_number": "C-12", "court_name": "District Court", "description": "Case note",
                "next_hearing_date": "2026-12-14", "hearing_notes": "Adjourned",
            })
            assert updated.status_code == 200
            assert updated.json()["case_number"] == "C-12"
            assert client.put(case_url, headers=owner, json={"status": "ongoing"}).status_code == 200
            assert len(client.get(history_url, headers=owner).json()) == 1
            stale = client.put(case_url, headers=owner, json={
                "next_hearing_date": "2026-12-18", "expected_hearing_date": "2026-12-10",
                "hearing_notes": "This note belongs to the earlier hearing.",
            })
            assert stale.status_code == 409
            assert client.get(case_url, headers=owner).json()["next_hearing_date"] == "2026-12-14"

            cleared = client.put(case_url, headers=owner, json={"next_hearing_date": None, "description": None})
            assert cleared.status_code == 200
            assert cleared.json()["next_hearing_date"] is None
            assert cleared.json()["description"] is None
            history = client.get(history_url, headers=owner).json()
            assert [(entry["hearing_date"], entry["next_hearing_date"], entry["notes"]) for entry in history] == [
                ("2026-12-14", None, None),
                ("2026-12-10", "2026-12-14", "Adjourned"),
            ]
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()
