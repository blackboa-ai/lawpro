# LawPro

A web-based hearing date tracker for Indian lawyers, evolved from the CaseDiary mobile application.

[![License](https://img.shields.io/badge/license-Unlicense-blue.svg)](https://unlicense.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-bluegreen?logo=fastapi)](https://fastapi.tiangolo.com)

## Version

**v0.1.0** - Phase 1: Project Setup Complete

## Status

✅ **Phase 1 Complete** - Project structure and documentation ready

**Phase 2 In Progress** - Authentication & Database setup

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