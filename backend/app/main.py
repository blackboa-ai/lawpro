"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import auth, cases, legal_intelligence
from app.core.config import settings
from app.db import get_db
from fastapi import Depends, HTTPException
from app.legal_intelligence import AggregatorError, LegalAggregator


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.legal_aggregator = LegalAggregator(
        settings.LEGAL_AGGREGATOR_API_URL,
        api_key_header=settings.LEGAL_AGGREGATOR_API_KEY_HEADER,
        api_key=settings.AUTHORIZED_API_KEY1,
    )
    yield


app = FastAPI(
    lifespan=lifespan,
    title="LawPro API",
    description="Hearing date tracker for Indian lawyers",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS - FRONTEND_HOST is required for production
# In development, FRONTEND_HOST can be comma-separated for multiple origins
origins = [url.strip() for url in settings.FRONTEND_HOST.split(',')] if settings.FRONTEND_HOST else []
if not origins:
    origins = ["http://localhost:3000", "http://localhost:8000"]  # Default development origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(cases.router, prefix="/api/v1/cases", tags=["cases"])


app.include_router(
    legal_intelligence.router, prefix="/api/v1/legal-intelligence", tags=["legal-intelligence"]
)


@app.exception_handler(AggregatorError)
async def legal_source_error(_request: Request, error: AggregatorError):
    return JSONResponse(
        status_code=error.status,
        content={"detail": error.message},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "lawpro-backend"}


@app.get("/ready")
def readiness_check(db: Session = Depends(get_db)):
    """Check PostgreSQL availability separately from the liveness endpoint."""
    try:
        db.execute(sql_text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ready", "service": "lawpro-backend"}
