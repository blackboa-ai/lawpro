# LawPro Backend

FastAPI backend with PostgreSQL database.

## Setup

```bash
pip install -r requirements.txt

# Set environment variables (see .env.example)
export $(cat .env.example | xargs)

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

## Available Commands

- `uvicorn app.main:app --reload` — Start dev server (http://localhost:8000)
- `pytest` — Run tests
- `alembic upgrade head` — Run migrations

## Project Structure

```
backend/app/
├── main.py        # FastAPI app entry point
├── api/           # API routers
├── core/          # Core configuration
├── models/        # SQLAlchemy models
├── schemas/       # Pydantic schemas
├── services/      # Business logic
├── repositories/  # Database access layer
└── dependencies/  # FastAPI dependencies
```

## API Documentation

Once running, visit http://localhost:8000/docs for interactive Swagger UI.