# Existing App Analysis: CaseDiary (Mobile)

## Application Overview

**Name:** CaseDiary  
**Platform:** React Native with Expo (SDK 58)  
**Target Audience:** Indian lawyers, solo practitioners and district-court advocates

## Core Purpose

A hearing date tracker that answers: **"What is listed where tomorrow?"**

## Features Inventory

### Case Management
- [x] SQLite local database (expo-sqlite)
- [x] Case list sorted by next hearing date
- [x] Add/Edit/Delete cases
- [x] Custom floating date picker
- [x] Per-case notes

### User Experience
- [x] Bottom Tab Navigation (Cases, Calculator, Laws)
- [x] Overdue/Urgent visual warnings
- [x] Day-before + morning-of local notifications
- [x] "Today" and "Tomorrow" quick labels

### Legal Tools
- [x] Nyaykosh Legal Reference (offline cached)
- [x] Limitation Period Calculator

## Data Model (SQLite)

```typescript
type Case = {
  id: number          // Auto-increment primary key
  title: string       // Case title/description
  caseNumber: string  // Court case number
  court: string       // Court name
  nextHearing: string // ISO date string
  notes: string       // Per-case notes
}
```

## Weaknesses Identified

1. **Device-local only** — No multi-user, no cross-device sync
2. **No backup** — Data risk if phone is lost/broken
3. **Mobile-only** — No web interface for desktop use
4. **No user accounts** — Cannot track usage or enforce privacy
5. **Single device** — Cannot share with clerks/colleagues

## Technical Debt

- Uses deprecated `SafeAreaView` from `react-native`
- Uses `expo-sqlite` (deprecated)
- No unit/integration tests visible
- No error handling for API failures

## File Structure (Original)

```
mobile-app-project-T1/
├── App.tsx                    # App entry
├── src/
│   ├── storage/cases.ts       # SQLite CRUD
│   ├── notifications.ts       # Local reminders
│   ├── nyaykosh.ts            # Govt API integration
│   └── limitation.ts          # Deadline calculations
├── assets/                    # Icons
├── app.json                   # Expo config
└── package.json
```

## Migration to Web

LawPro transforms this mobile-only app into:

### Web Architecture
```
┌─────────────────┐
│  Next.js 15     │  -- Frontend (React + TypeScript)
│  Tailwind CSS   │  -- Styling
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  FastAPI        │  -- Backend (Python)
│  JWT Auth       │  -- Authentication
│  Pydantic       │  -- Validation
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │  -- Database
│  SQLAlchemy     │  -- ORM
│  Alembic        │  -- Migrations
└─────────────────┘
```

### Key Improvements
- ✅ Multi-user authentication
- ✅ Cross-device sync
- ✅ Web interface for desktop
- ✅ Data backup to cloud
- ✅ Role-based access control
- ✅ API-first design