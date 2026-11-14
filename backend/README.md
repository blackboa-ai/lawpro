# LawPro Backend API

A FastAPI backend for the LawPro hearing date tracker, evolved from the CaseDiary mobile application.

## Architecture

The backend provides a RESTful API with JWT authentication, following these design principles:

- **Synchronous Session**: Uses synchronous SQLAlchemy sessions (psycopg2 for PostgreSQL)
- **Snake Case Convention**: All database columns and Pydantic models use snake_case
- **Database Agnostic**: Supports both PostgreSQL and SQLite for development

```
┌─────────────────┐
│  HTTP Client    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  FastAPI        │
│  (uvicorn)      │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  SQLAlchemy     │
│  Session (sync) │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  or SQLite     │
└─────────────────┘
```

## Python Setup

### Prerequisites

- Python 3.10+
- PostgreSQL (for production use)

### Installing Dependencies

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
# Windows:
# venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# For testing (optional)
pip install pytest pytest-asyncio httpx2
```

## Environment Configuration

Copy the example file and configure your settings:

```bash
cp .env.example .env
```

### Required Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `sqlite:///./lawpro.db` |
| `SECRET_KEY` | JWT signing secret (generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`) | - |
| `FRONTEND_HOST` | Frontend URL for CORS | `http://localhost:3000` |

### PostgreSQL Configuration

For production, use a PostgreSQL URL:

```
DATABASE_URL=postgresql://username:password@host:5432/database_name?sslmode=require
```

**Note**: Neon, Render PostgreSQL, and other cloud providers require `sslmode=require`.

## Database Configuration

### Supported URL Formats

The backend automatically converts these URLs to use the synchronous psycopg2 driver:

| Input | Output |
|-------|--------|
| `postgresql://user:pass@host/db` | `postgresql+psycopg2://user:pass@host/db` |
| `postgresql+psycopg2://...` | (unchanged) |
| `postgresql+asyncpg://...` | `postgresql+psycopg2://...` | |

### Running Migrations

```bash
# Set DATABASE_URL environment variable
# Then run:
alembic upgrade head

# Verify migration status
alembic current
```

**Important**: Never use `Base.metadata.create_all()` for deployment. Always use Alembic migrations.

## Running the API

### Development Server

```bash
# With virtual environment activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Server

```bash
# Using gunicorn with Uvicorn worker
gunicorn -w 2 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:${PORT:-8000}
```

## Running Backend Tests

```bash
# With virtual environment activated
pytest tests/ -v

# Run specific test file
pytest tests/test_auth.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

## Available Tests

- `test_auth.py` - User registration, login, token validation (11 tests)
- `test_cases.py` - Case CRUD operations (12 tests)
- `test_main.py` - API health check (1 test)
- `test_postgres_url.py` - PostgreSQL URL conversion (3 tests)
- `test_postgresql_integration.py` - Full integration tests (15 tests)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login and get token |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/cases` | Create case |
| GET | `/api/v1/cases` | List user's cases |
| GET | `/api/v1/cases/dashboard` | Get dashboard stats |
| GET | `/api/v1/cases/{id}` | Get single case |
| PUT | `/api/v1/cases/{id}` | Update case |
| DELETE | `/api/v1/cases/{id}` | Delete case |
| GET | `/health` | Health check |

## CORS Configuration

CORS is configured to allow requests from `FRONTEND_HOST`. For production deployment:

1. Set `FRONTEND_HOST` environment variable to your frontend URL
2. The allowed origins are parsed from comma-separated list if needed

## Deployment

See the main [README.md](../README.md) and [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for complete deployment instructions.

## Security Notes

- Passwords are hashed using bcrypt before storage
- JWT tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30 minutes)
- User data is isolated by `user_id` in all queries
- No sensitive data is stored in the codebase