# LawPro Frontend

A Next.js 15 frontend for the LawPro hearing date tracker, evolved from the CaseDiary mobile application.

## Architecture

The frontend is built with Next.js 15 using the App Router:

```
Browser
    │
    ▼
┌─────────────────────────────────┐
│  Next.js 15 (App Router)      │
│  - pages directory (legacy)   │
│  - app directory (new)        │
└─────────────────────────────────┘
    │
    ├── TypeScript (strict mode)
    ├── Tailwind CSS 4
    ├── Lucide React (icons)
    └── React Context (auth)
    │
    ▼
┌─────────────────────────────────┐
│  API Client (fetch)           │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  LawPro Backend API           │
│  (FastAPI)                    │
└─────────────────────────────────┘
```

## Node.js Requirements

- Node.js 18+
- npm 9+ (comes with Node 18+)

## Installing Dependencies

```bash
cd frontend

# Install dependencies
npm install

# Verify installation
npm run build
```

## Environment Configuration

Copy the example file and configure your settings:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Note**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Do not put secrets in `.env.local` files that will be committed.

## Development Server

```bash
# Start development server
npm run dev

# Open in browser
http://localhost:3000
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |

## Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

**Note**: For deployment to Vercel, the build command is `npm run build` and the output directory is `.next`.

## TypeScript and Lint Checks

```bash
# Type checking (no emit)
npx tsc --noEmit

# Run ESLint
npx eslint . --ext .ts,.tsx
```

## Project Structure

```
frontend/
├── app/                    # App Router pages
│   ├── api/              # API routes
│   ├── dashboard/        # Dashboard page
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── page.tsx          # Home page
│   └── layout.tsx        # Root layout
├── components/           # Shared components
├── context/             # React Context (auth)
├── lib/                 # Utility libraries
├── types/               # TypeScript type definitions
├── public/              # Static assets
├── styles/              # Global styles
├── .env.example         # Environment template
├── next.config.js       # Next.js configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies
```

## API Integration

The frontend communicates with the backend via the `NEXT_PUBLIC_API_URL` environment variable:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}
```

## Deployment

See the main [README.md](../README.md) and [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for complete deployment instructions.

### Vercel Deployment

The project is configured for Vercel deployment:

1. Import the GitHub repository
2. Set Framework Preset: Next.js
3. Root Directory: `frontend`
4. Build Command: `npm run build`
5. Output Directory: `.next`
6. Add Environment Variable `NEXT_PUBLIC_API_URL` pointing to your backend

## Key Pages

- `/login` - User login
- `/register` - User registration
- `/dashboard` - Case dashboard
- `/cases/[id]` - Case details

## Styling

- **Tailwind CSS 4** for utility-first styling
- **Lucide React** for icons
- **Responsive design** for mobile and desktop

## TypeScript Strict Mode

This project uses TypeScript strict mode. All code must pass type checking:

```bash
npx tsc --noEmit
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000` |

## Development Roadmap

- [ ] Case filtering and search
- [ ] Calendar integration
- [ ] Notification system
- [ ] Dark mode toggle

## Known Issues

- None currently reported

## Browser Support

- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+