# PawPlay

## Overview

PawPlay is a gamified dog training mobile app for families. Built as a pnpm workspace monorepo using TypeScript.

## App Features

- **Welcome Screen** — demo mode (no login) + Replit Auth login
- **Demo Mode** — Quick Bites session with local state only, no API calls
- **Replit Auth** — OIDC/PKCE mobile auth via expo-auth-session
- **Onboarding** — 4-step flow: dog info → commands → family invite → done
- **Dashboard** — streak, weekly activity grid, leaderboard, calendar link
- **Games Hub** — Quick Bites, Training Mode, Obedience Challenge (locked til 7 reliable commands)
- **Quick Bites (challenge-active)** — HOLD button timer via Reanimated 2 on native thread
- **Training Mode** — configure command, reward type, variable schedule, reps
- **Calendar** — monthly view with dot indicators (me/family/both)
- **Yearly Chart** — animated bar chart, best month, total hours
- **Profile** — command library with levels, achievement badges
- **Settings** — notifications, family invite code, sign out

## Color Palette
- Primary/Peach: #FF8B6A
- Mint: #3DB884
- Lavender: #8B68FF
- Lemon: #F5C400
- Background: #F7F3EF (warm cream)

## Fonts
- Headings: Fredoka One
- Body: Nunito (400, 700, 800, 900)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile**: Expo (React Native) — artifact: `pawplay`
- **API framework**: Express 5 — artifact: `api-server`
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec`)
- **Auth**: Replit Auth OIDC (session-based with mobile token exchange)
- **Build**: esbuild (CJS bundle)

## Database Tables
- `sessions` — auth sessions (Replit Auth)
- `users` — auth users (Replit Auth)
- `pawplay_users` — extended user profile (familyId, role, expoPushToken)
- `families` — family groups with 6-char invite code
- `dogs` — dog profiles (name, breed, age, level, xp)
- `commands` — command library per dog (with level tracking)
- `sessions_record` — training session history with scoring
- `achievements` — dog/user achievement records
- `push_tokens` — Expo push notification tokens

## Scoring Engine (`artifacts/pawplay/utils/scoring.ts`)
- Easy: 6s window, 0 floor on display
- Medium: 4s window, 0 floor on display
- Expert: 2s window, shows negatives in red
- Bonuses capped at +50: Perfect Round, Speed Demon, Combo Streak, Clean Sweep, Difficulty Bonus
- `evaluateCommandLevel()` runs server-side after every POST /api/sessions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
