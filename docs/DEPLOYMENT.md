# LawPro Deployment Guide

## Architecture Overview

LawPro uses a free-tier deployment stack:
- **Frontend**: Vercel Hobby (Next.js)
- **Backend**: Render Free (FastAPI)
- **Database**: Render PostgreSQL Free Tier

## Prerequisites

1. GitHub account (for Vercel deployment)
2. Render account (for backend and database)
3. Node.js 18+ installed locally
4. Python 3.10+ installed locally

## Deployment Steps

### Step 1: Prepare GitHub Repository

1. Create a new GitHub repository (or use existing one)
2. Push your code:
   ```bash
   cd "D:\experiments ai\LawPro"
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/lawpro.git
   git push -u origin main
   ```

### Step 2: Deploy Backend to Render

#### Option A: Using Render Dashboard (Recommended)

1. Go to [render.com](https://render.com) and sign up (no credit card required)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: lawpro-backend
   - **Region**: Choose closest
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 2 -k uvicorn.workers.UvicornWorker app.main:app`
5. Add Environment Variables:
   - `DATABASE_URL` - (Set after database creation)
   - `SECRET_KEY` - Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
   - `ALGORITHM` - `HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES` - `1440` (24 hours)
   - `BACKEND_HOST` - `https://lawpro-backend.onrender.com`
   - `FRONTEND_HOST` - `https://lawpro.vercel.app` (will be set after frontend deployment)

#### Option B: Using render.yaml

Run:
```bash
# Install Render CLI (if desired)
npm install -g @render-examples/cli

# Or manually create via Dashboard
```

### Step 3: Deploy Database to Render

1. In Render Dashboard, click "New" → "Database"
2. **Database Name**: lawpro-db
3. **Plan**: Free (no credit card required)
4. **Database User**: lawpro
5. **Database Name**: lawpro
6. Copy the connection string from the database dashboard:
   ```
   postgresql://lawpro:password@host:port/lawpro?sslmode=require
   ```

### Step 4: Run Database Migrations

SSH into your Render backend or use the Render console:

```bash
# Set DATABASE_URL to your PostgreSQL connection string
# Then run migrations:
cd backend
source venv/bin/activate  # if using virtualenv
alembic upgrade head
```

**Note**: Render allows running commands via the "Shell" tab in your service dashboard.

### Step 5: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (no credit card required for Hobby plan)
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL` - `https://lawpro-backend.onrender.com`

### Step 6: Configure CORS

CORS is automatically configured in `backend/app/core/config.py`. The `FRONTEND_HOST` environment variable is required and is already set in Step 2.

Ensure you have set `FRONTEND_HOST` to your Vercel domain:
```
FRONTEND_HOST=https://lawpro.vercel.app
```

### Step 7: Add .env.example Files (Already Done)

Ensure `.env.example` files exist in both directories:
- `backend/.env.example`
- `frontend/.env.example`

These files are NOT meant to be committed with secrets.

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testing

### Backend Tests
```bash
cd backend
source venv/bin/activate
pytest tests/
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Free Tier Limitations

### Render Free Plan
- 512 MB RAM
- 1 CPU
- Sleeps after 15 minutes of inactivity (cold starts)
- No custom domains
- No SSL certificates (uses render.com subdomain)

### Vercel Hobby Plan
- 100 GB bandwidth/month
- 125,000 serverless function executions/day
- Sleeps after 15 minutes of inactivity
- Custom domains available

### Render PostgreSQL Free
- 50 MB storage
- Sleeps after 15 minutes
- SSL required for connections

## Health Check Endpoints

- Backend: `GET /health`
- Returns: `{"status": "healthy", "service": "lawpro-backend"}`

## API Documentation

Once deployed, access Swagger UI:
- `https://lawpro-backend.onrender.com/docs`

## Troubleshooting

### CORS Issues
If you see CORS errors, ensure `FRONTEND_HOST` is set correctly in Render environment variables.

### Database Connection
Ensure your database URL includes `?sslmode=require` for Render PostgreSQL.

### Cold Starts
The free tiers sleep after inactivity. The first request after sleep may take 5-10 seconds.

### Migration Failures
If migrations fail, check:
1. Database URL is correct
2. Database user has permissions
3. All migrations are sequential without gaps

## Security Notes

- Never commit `.env` files with real secrets
- Use strong `SECRET_KEY` values
- Enable password hashing with bcrypt
- JWT tokens expire after configured time
- User data is isolated by `user_id` in all queries