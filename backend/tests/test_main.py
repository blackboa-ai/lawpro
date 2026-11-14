"""Tests for the main application."""

from fastapi.testclient import TestClient
from app.main import app


def test_health_check():
    """Test health check endpoint."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_register_endpoint_exists():
    """Test that register endpoint exists."""
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "password": "password123"},
    )
    # Will fail without DB, but endpoint should exist
    assert response.status_code != 404


def test_login_endpoint_exists():
    """Test that login endpoint exists."""
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "test@example.com", "password": "password123"},
    )
    # Will fail without valid credentials, but endpoint should exist
    assert response.status_code != 404