# LawPro Documentation

## Available Documents

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide for Render/Vercel setup
- **[API.md](API.md)** - Full API documentation with endpoints and examples
- **[README.md](../README.md)** - Project overview

## Quick Start

### Local Development

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd ../frontend
npm install
npm run dev
```

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions to deploy:
1. Backend to Render
2. Database to Render PostgreSQL
3. Frontend to Vercel

### API Access

See [API.md](API.md) for:
- Authentication endpoints
- Case management endpoints
- Error responses
- Frontend integration examples

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LawPro Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Browser   │────▶│  Next.js    │────▶│  FastAPI    │   │
│  │             │     │  (Frontend) │     │  (Backend)  │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│                                   │                       │
│                                   ▼                       │
│                          ┌─────────────┐                  │
│                          │ PostgreSQL  │                  │
│                          │   (Database)│                  │
│                          └─────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS 4
- Axios (for API calls)

### Backend
- FastAPI 0.115
- Python 3.14
- SQLAlchemy 2.0
- PostgreSQL
- JWT Authentication
- bcrypt Password Hashing

### Deployment
- Vercel Hobby (Frontend)
- Render Free (Backend + Database)
- All services: ₹0 cost (no credit card required)