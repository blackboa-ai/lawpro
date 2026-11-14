# LawPro

A web-based hearing date tracker for Indian lawyers, evolved from the CaseDiary mobile application.

## Status

MVP development in progress. Zero-budget deployment using free tiers.

## Quick Links

- [Project Overview](docs/PROJECT_OVERVIEW.md)
- [Existing App Analysis](docs/EXISTING_APP_ANALYSIS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)

## Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**

### Backend
- **FastAPI** (Python 3.12)
- **PostgreSQL** via SQLAlchemy 2.0
- **JWT Authentication**

### Infrastructure (Free Tiers)
- **Vercel** — Frontend hosting
- **Render** — Backend hosting
- **Neon** — PostgreSQL database
- **GitHub Actions** — CI/CD

## Development

```bash
# Clone and install
git clone <repo-url>
cd LawPro

# Frontend
cd frontend
npm install
npm run dev

# Backend
cd ../backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## License

Not yet chosen. All rights reserved by the author.

---
*This project follows Zero-Budget Rule — ₹0 spending allowed.*