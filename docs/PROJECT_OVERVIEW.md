# LawPro Project Overview

## Vision

Transform the CaseDiary mobile application into a modern, multi-user web application with genuine backend and persistent storage.

## Evolution from Mobile App

| Feature | Mobile App | LawPro Web |
|---------|------------|------------|
| Data Storage | Local SQLite | PostgreSQL (multi-user) |
| Users | Device-local | Authenticated accounts |
| Access | Mobile only | Desktop + Mobile web |
| Backup | None | Automatic with DB |
| Collaboration | No | Yes (shared cases) |

## Key Improvements

1. **Multi-user support** — Login/registration with JWT
2. **Database persistence** — PostgreSQL with backups
3. **Web-first design** — Responsive for all devices
4. **Professional UI** — Modern, accessible interface
5. **API-first** — RESTful endpoints with OpenAPI docs

## Zero-Budget Compliance

All infrastructure uses genuinely free tiers:
- Frontend: Vercel Hobby ($0)
- Backend: Render Free ($0)
- Database: Neon Free ($0)
- CI/CD: GitHub Actions (included)

## License

Not yet chosen. All rights reserved by the author.