# LawPro Deployment Guide

## Free Tier Architecture

```
┌─────────────────┐
│  Vercel Hobby   │  -- Frontend (Next.js)
│  https://...    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  GitHub Actions │  -- CI/CD
│  Deploy Pipeline│
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Render Free    │  -- Backend (FastAPI)
│  https://...    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Neon Serverless│  -- PostgreSQL Database
│  Free Plan      │
└─────────────────┘
```

## Prerequisites

1. GitHub account
2. Vercel account (free)
3. Render account (free)
4. Neon account (free)

## Step-by-Step Deployment

### 1. GitHub Repository
```bash
# Create repository
git init
git add .
git commit -m "Initial commit: Phase 1 project setup"
# Then create repository on GitHub UI and add remote
git remote add origin https://github.com/your-username/lawpro.git
git push -u origin main
```

### 2. Database Setup (Neon)
1. Sign up at https://console.neon.tech/signup
2. Create a new project
3. Create a branch (default is "main")
4. Copy the connection string from "Connection Details"

### 3. Backend Deployment (Render)
1. Sign up at https://render.com
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Select the `backend` directory
5. Build Command: `pip install -r requirements.txt && alembic upgrade head`
6. Start Command: `gunicorn app.main:app`
7. Set environment variables (see `.env.example`)

### 4. Frontend Deployment (Vercel)
1. Sign up at https://vercel.com
2. Click "New Project"
3. Import GitHub repository
4. Select `frontend` directory
5. Configure build settings (Next.js auto-detected)

### 5. Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Backend (Render) | Neon connection string |
| `SECRET_KEY` | Backend | JWT signing secret (use `openssl rand -hex 32`) |
| `ALCHEMY_KEY` | Frontend | (if using) |

## Free Tier Limits

| Service | Limit | Sleep Behavior |
|---------|-------|----------------|
| Vercel | 100 GB bandwidth | Functions sleep after 5-15s |
| Render | 750 hours/month | Sleeps after 15 min idle |
| Neon | 100 CU-hours/month | Computes suspend after 20 min |

## Local Development

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Database
```bash
# Using local PostgreSQL or Docker
docker run -p 5432:5432 -e POSTGRES_PASSWORD=password postgres
alembic upgrade head
```

## Monitoring

- Vercel: Dashboard → Logs → Analytics
- Render: Dashboard → Metrics → Logs
- Neon: Console → Metrics → Query History

## Troubleshooting

### Backend not responding
- Check if Render service is awake (first request after sleep takes 10-30s)
- Verify environment variables are set

### Database connection issues
- Verify `DATABASE_URL` in Render environment
- Check Neon project status in console

### Frontend build errors
- Check Vercel build logs
- Ensure `package.json` has correct build scripts