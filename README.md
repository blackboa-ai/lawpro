# LawPro

A web-based hearing date tracker for Indian lawyers, evolved from the CaseDiary mobile application.

[![License](https://img.shields.io/badge/license-Unlicense-blue.svg)](https://unlicense.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.14-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-bluegreen?logo=fastapi)](https://fastapi.tiangolo.com)

## Version

**v0.1.0** - Phase 1: Case Management V1 Complete

## Status

✅ **Backend Complete** - Authentication & Case Management API ready
✅ **Frontend Complete** - Login, Register, Dashboard, Case CRUD ready
✅ **Tests Ready** - Comprehensive test suites for auth and cases
✅ **Deployment Ready** - Configuration files prepared

## Quick Links

- [Deployment Guide](docs/DEPLOYMENT.md) - Step-by-step deployment instructions
- [API Documentation](docs/API.md) - Full API reference with examples

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Browser     │────▶│  Next.js        │────▶│  FastAPI        │
│                 │     │  (Frontend)     │     │  (Backend)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │  PostgreSQL     │
                                             │  (Database)     │
                                             └─────────────────┘
```

## Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS 4**
- **Lucide React** (Icons)

### Backend
- **FastAPI 0.115**
- **Python 3.14**
- **SQLAlchemy 2.0**
- **PostgreSQL**
- **JWT Authentication**
- **bcrypt Password Hashing**

### Infrastructure (Free Tiers)
- **Vercel Hobby** — Frontend hosting (no credit card)
- **Render Free** — Backend hosting (no credit card)
- **Render PostgreSQL Free** — Database (no credit card)

## Features

### Authentication
- ✅ User Registration
- ✅ JWT Login
- ✅ Password Hashing (bcrypt)
- ✅ Token Validation
- ✅ Inactive User Handling

### Case Management
- ✅ Create Cases
- ✅ Read Cases (List, Single)
- ✅ Update Cases
- ✅ Delete Cases
- ✅ User Ownership Isolation
- ✅ Dashboard Statistics

## Development

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL (for production use)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local if needed

# Start development server
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend
source venv/bin/activate
pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete deployment instructions.

### Quick Deployment Commands

```bash
# 1. Push to GitHub
git push origin main

# 2. Create Render PostgreSQL database (via dashboard)
# 3. Create Render Web Service (backend)
# 4. Create Vercel Project (frontend)

# 5. Run migrations on Render
# In Render "Shell" tab:
alembic upgrade head
```

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

## Environment Variables

### Backend (.env)
```
DATABASE_URL=sqlite:///./lawpro.db
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
BACKEND_HOST=http://localhost:8000
FRONTEND_HOST=http://localhost:3000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Security

- Passwords hashed with bcrypt
- JWT tokens with configurable expiration
- User data isolated by user_id
- CORS properly configured
- No sensitive data in code

## License

Not yet chosen. All rights reserved by the author.

---
*This project follows Zero-Budget Rule — ₹0 spending allowed.*