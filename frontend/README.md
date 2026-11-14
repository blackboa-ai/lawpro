# LawPro Frontend

Next.js application with Tailwind CSS.

## Setup

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` — Start dev server (http://localhost:3000)
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm run test` — Run tests

## Project Structure

```
frontend/src/
├── app/           # App Router pages
├── components/    # Reusable UI components
├── features/      # Feature modules (cases, auth, etc.)
├── hooks/         # Custom React hooks
├── lib/           # Utility functions and APIs
├── services/      # API service layer
├── types/         # TypeScript type definitions
└── styles/        # Global styles
```