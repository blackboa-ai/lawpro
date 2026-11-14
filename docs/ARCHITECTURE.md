# LawPro Architecture

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel CDN    │     │   Render API    │     │    Neon DB      │
│   (Frontend)    │◄───►│   (Backend)     │◄───►│  (PostgreSQL)   │
│  Next.js 15     │     │   FastAPI       │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         ▲                        ▲                       ▲
         │ GitHub Actions         │ GitHub Actions       │
         │      CI/CD             │      CI/CD            │
         ▼                        ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Repository                             │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Choices

### Frontend
- **Next.js 15** — React Server Components, App Router
- **TypeScript** — Static typing for reliability
- **Tailwind CSS** — Utility-first CSS framework

### Backend
- **FastAPI** — High-performance Python API framework
- **Pydantic v2** — Data validation and serialization
- **SQLAlchemy 2.0** — Async ORM

### Database
- **PostgreSQL** — Relational database with JSON support
- **Alembic** — Database migrations

### Authentication
- **JWT** — Token-based authentication
- **bcrypt** — Password hashing

## API Design

### Authentication Endpoints
```
POST /api/auth/register — Register new user
POST /api/auth/login   — Login, receive JWT
GET  /api/auth/me       — Get current user
```

### Case Endpoints
```
GET    /api/cases       — List cases (paginated, sorted by hearing date)
POST   /api/cases       — Create new case
GET    /api/cases/{id}  — Get case details
PUT    /api/cases/{id}  — Update case
DELETE /api/cases/{id}  — Delete case
```

## Security Considerations

1. **Password Storage** — bcrypt with work factor 12
2. **JWT** — HS256 algorithm with secure secret
3. **CORS** — Configured for Vercel domain
4. **Input Validation** — Pydantic models validate all inputs
5. **Error Handling** — Centralized exception handlers

## Performance Optimization

- Database connection pooling (asyncpg)
- Index on `next_hearing` and `user_id` for sorting/querying
- Caching for Nyaykosh API responses
- Pagination for case listing

## Deployment Architecture

```
┌────────────────────────────────────────────┐
│  GitHub Repo                               │
│  - main branch (production)              │
│  - develop branch (staging)              │
└────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────┐
│  GitHub Actions Pipeline                   │
│  - PR checks (tests + lint)              │
│  - Push to deploy                        │
└────────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────┐       ┌─────────┐
│Vercel   │       │Render   │
│(frontend)│       │(backend)│
└─────────┘       └─────────┘
                     │
                     ▼
               ┌─────────────┐
               │Neon Postgres│
               │(database)   │
               └─────────────┘
```