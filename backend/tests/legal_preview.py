"""Start an isolated fixture-backed LawPro API: python -m tests.legal_preview."""

import os
import secrets

# Override process variables before importing the application settings.
os.environ.update(
    DATABASE_URL="sqlite:///:memory:",
    SECRET_KEY=secrets.token_hex(32),
    ALGORITHM="HS256",
    ACCESS_TOKEN_EXPIRE_MINUTES="30",
    FRONTEND_HOST="http://localhost:3000,http://127.0.0.1:3000",
    LEGAL_AGGREGATOR_API_URL="https://fixture.example/api/v1",
)

from contextlib import asynccontextmanager

import httpx
import uvicorn
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app, lifespan
from app.models import Base
from tests.legal_source_fixture import LegalSourceFixture


@asynccontextmanager
async def preview_lifespan(application):
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)

    def session():
        with Session(engine) as db:
            yield db

    application.dependency_overrides[get_db] = session
    try:
        async with lifespan(application):
            application.state.legal_aggregator.transport = httpx.MockTransport(
                LegalSourceFixture(simulate_preview_retry=True)
            )
            yield
    finally:
        application.dependency_overrides.pop(get_db, None)
        engine.dispose()


if __name__ == "__main__":
    app.router.lifespan_context = preview_lifespan
    uvicorn.run(app, host="127.0.0.1", port=8000, access_log=False)
