# LawPro

LawPro is a mobile-friendly web app for Indian lawyers to track cases and hearing dates.

[Open LawPro](https://lawpro-five.vercel.app) · [Live API documentation](https://lawpro-ba28.onrender.com/docs) · [API reference](docs/API.md)

## What you can do

- Register, sign in, and manage your own cases.
- Create cases with optional case numbers, courts, hearing dates, and notes. Edit or delete cases from the dashboard.
- Search by case title, number, or court, and filter by case status.
- Open **Upcoming hearings** to see **Today**, **Next 7 days**, or **All upcoming**. The seven-day view includes today.

## Version history

### v2.2.2 - Sign-in and registration refresh

- Refreshed sign-in and registration with a compact mobile layout and a two-column desktop layout.
- Added a password visibility toggle and an inline password-length hint on registration.

### v2.2 — Calendar and CSV exports

- Confirm the case and date before downloading its next hearing as an all-day calendar event (`.ics`). Import it into your calendar and set any reminders there. Download again if the hearing date changes.
- Export the visible case list as a UTF-8 CSV. Search and filters determine which cases are included.
- Updated case cards with a compact hearing date badge, color-coded status control, and actions that wrap on smaller screens.

### v2.1.1 — More details when creating a case

- Add a case number, court, and case notes when creating a case. These fields and the next hearing date are optional.
- Case notes entered during creation can be updated later in Edit case.

### v2.1 — Case editing and hearing history

- Edit a case's title, reference number, court, next hearing date, and case notes from the dashboard.
- Preserve the previous hearing date and optional hearing notes when a date is changed or cleared.
- Apply Alembic revision `20261115_hearing_history` to the target database before deploying the v2.1 backend.

The live v2 baseline was released as `v0.2.0`. Future updates in this series use the `v2.x` naming scheme.

### v0.2.0 — Mobile dashboard and hearing filters

- Added case search, status filters, matching results counts, and a clear-filters action.
- Added hearing filters for today, the next seven days, and all upcoming hearings.
- Added an optional hearing date to the New case form and case numbers to case cards when available.
- Redesigned the landing page, authentication screens, and dashboard with a compact layout and larger tap targets for phones.
- Centered the New case dialog, blurred the background, and made the form scroll when screen space is tight.
- Sent users directly to the dashboard after successful sign-in or registration.

### v0.1.0 — Initial web release

- Added account registration and sign-in, a case dashboard, and case creation, status updates, and deletion.
- Deployed the Next.js frontend on Vercel and the FastAPI backend on Render.
- Initialized the Neon PostgreSQL database using Alembic migrations.

Add a section under **Version history** for each release, newest first. Keep planned work in the roadmap until it ships.

## Local development

Use Node.js and npm for the frontend, Python 3.12 for the backend, and a disposable development database for any migration work.

### Backend (Windows PowerShell)

From the repository root:

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
$env:DATABASE_URL = 'sqlite:///./lawpro-dev.db'
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Check that any existing backend configuration is suitable for development. The explicit URL above targets a separate local SQLite file. The API defaults to port 8000 and exposes interactive docs at [localhost:8000/docs](http://localhost:8000/docs).

### Frontend (Windows PowerShell)

In a second terminal, from the repository root:

```powershell
npm ci
if (-not (Test-Path frontend/.env.local)) {
  Copy-Item frontend/.env.example frontend/.env.local
}
npm run dev
```

Open [localhost:3000](http://localhost:3000). For local testing, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` to `http://localhost:8000`. Run `npm run build` from the root to check the production build.

## Deployment

See [Restoring LawPro v2.2](docs/ROLLBACK.md) for the previous release and its recovery steps.

The web app uses Vercel for Next.js, Render for FastAPI, and Neon for PostgreSQL. Configure the public backend URL on Vercel with `NEXT_PUBLIC_API_URL`. In Render, set `FRONTEND_HOST` to the frontend origin and store `DATABASE_URL` and `SECRET_KEY` as environment variables. Keep credentials and local database files out of Git.

## Roadmap

- **v3.0** - Reserved for a larger feature.
