# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Part of Rugby Education Platform** - See `../CLAUDE.md` for mission context, shared conventions, and available agents.
> **Status**: Active | **Lifecycle**: Validated (has real users)

## Overview

**The Oaks Performance Portal** - A Progressive Web App for pre-season strength & conditioning tracking for the Danville Oaks high school rugby team. Features athlete workout logging with video guides and a coach dashboard with team analytics.

## Build Commands

```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server (localhost:5173)
npm run build            # TypeScript + Vite build (output: dist/)
npm run preview          # Preview production build locally
npm run deploy           # Build + Firebase deploy to oaks-snc project
```

## Tech Stack

- **Framework**: React 18 + TypeScript 5.2
- **Build**: Vite 5.1
- **Styling**: Tailwind CSS (via CDN with custom theme)
- **Backend**: Firebase (Auth, Firestore) with LocalStorage fallback
- **Charts**: Recharts
- **Icons**: lucide-react

## Architecture

### Application Views (AppView type)
- `LOGIN` → `LANDING` → Role-based routing
- **Athletes**: `ATHLETE_SELECT` → `ATHLETE_DASHBOARD` → `WORKOUT_SESSION`
- **Coaches**: `COACH` dashboard with analytics

### Key Directories
- `components/` - React components (App.tsx is central router)
- `services/` - Backend abstraction
  - `db.ts` - Firebase/LocalStorage dual-mode database
  - `auth.ts` - OAuth providers (Google, Microsoft, Email)
  - `programData.ts` - Hardcoded 4-day workout program
- `utils/weekUtils.ts` - ISO 8601 week calculations
- `types.ts` - Core TypeScript interfaces

### Data Models
```typescript
Player: { id, name, role, position?, userId?, email? }
WorkoutLog: { playerId, dayId, timestamp, weekYear, week, data{}, completed }
WorkoutDay: { id, title, focus, exercises[] }
```

### Database Pattern
- Firestore collections: `roster` (players), `logs` (workout data)
- LocalStorage fallback keys: `oaks_roster_v1`, `oaks_logs_v1`
- Auto-linking of authenticated users to player profiles

## Environment Variables

All use `VITE_` prefix (Vite requirement):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

App works with LocalStorage if Firebase not configured.

## Code Conventions

- **Components**: Functional with hooks, props interfaces above component
- **Event handlers**: Named `handle{Action}` (e.g., `handleLoginSuccess`)
- **Navigation**: Props-based (`onNavigate` callbacks from App.tsx)
- **Styling**: Tailwind utilities only, dark theme (neutral-950 bg, gold accents)
- **Console logs**: Prefix with `[ComponentName]` for filtering
- **Error handling**: Try-catch with context strings, 15-second timeouts

## Week Handling (Critical)

All workout logs use ISO 8601 weeks:
- Week starts Monday, uses `weekYear` + `week` fields
- Fallback to timestamp-based calculation if fields missing
- Use `utils/weekUtils.ts` for all week operations

## Key Files to Modify

- `services/programData.ts` - Add/modify workout exercises
- `services/db.ts` - Change data model or storage logic
- `types.ts` - Core data structures (changes propagate throughout)
- `components/CoachDashboard.tsx` - Coach analytics (1490 lines, most complex)
- `components/WorkoutSession.tsx` - Workout logging form
