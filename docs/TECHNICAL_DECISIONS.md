# LawPro Technical Decisions

## Decision Log

### 1. Technology Stack
**Decision:** Next.js 15 + FastAPI + PostgreSQL

**Rationale:**
- Next.js provides excellent SEO, SSR, and App Router
- FastAPI is modern Python, auto-opens API docs
- PostgreSQL is robust, ACID-compliant relational DB

**Alternatives Considered:**
- Express.js (Node.js backend) — Would add JavaScript complexity
- Django — Would require separate frontend
- Supabase — Great but limited to 500MB free tier

### 2. Authentication
**Decision:** JWT tokens with bcrypt password hashing

**Rationale:**
- Stateless, works well with serverless deployment
- bcrypt is industry standard for password hashing
- FastAPI has official JWT support

### 3. Frontend Styling
**Decision:** Tailwind CSS

**Rationale:**
- Rapid UI development with utility classes
- Smaller bundle than Bootstrap
- Excellent mobile-first approach

### 4. Database ORM
**Decision:** SQLAlchemy 2.0 (Async)

**Rationale:**
- Native async support for FastAPI
- SQLAlchemy is mature with great documentation
- Alembic handles migrations well

### 5. Free Hosting Combination
**Decision:** Vercel + Render + Neon

**Rationale:**
- All three services are from different vendors (no vendor lock-in)
- No credit card required for any service
- Generous free tier limits verified

### 6. Project Structure
**Decision:** Separate frontend/backend directories

**Rationale:**
- Clear separation of concerns
- Independent development and deployment
- Easy to scale either layer independently

## Rejected Alternatives

| Feature | Alternative | Why Rejected |
|---------|-------------|--------------|
| Backend | Django | Would require single Python project, harder to separate frontend |
| Database | Supabase | 500MB limit too restrictive; Neon has better free tier |
| Hosting | Railway | Free tier is actually a 30-day trial |
| Auth | Auth0 | Not free beyond limited usage |
| CSS | Material-UI | Larger bundle, Tailwind is more flexible |

## Future Considerations

1. **Caching Layer** — May add Redis if Render DB gets congested
2. **File Storage** — May use Supabase Storage for document uploads
3. **Email Notifications** — May integrate with MailerLite (free tier)