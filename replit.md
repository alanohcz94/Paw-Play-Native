# PawPlay

## Overview

PawPlay is a gamified dog training mobile app for families. Built as a pnpm workspace monorepo using TypeScript.

## App Features

- **Welcome Screen** — demo mode (no login) + Replit Auth login
- **Demo Mode** — Quick Bites session with local state only, no API calls, uses calculateScore()
- **Replit Auth** — OIDC/PKCE mobile auth via expo-auth-session
- **Onboarding** — 4-step flow: dog info → commands → family invite → done
- **Multi-dog support** — families can have multiple dogs; DogPicker component on dashboard lets users switch active dog; all commands, scores, achievements scoped to the active dog; "Add Dog" screen accessible from dashboard and profile
- **Dashboard** — dog picker (when 2+ dogs), streak, weekly activity grid, leaderboard, calendar link
- **Games Hub** — Quick Bites, Training Mode, Obedience Challenge (locked til 7 reliable commands)
- **Quick Bites (challenge-active)** — HOLD button with 1-3s random hold countdown, timer continues past 0 as negative, reset button with 25% deduction per press, purple bonus bubbles during gameplay
- **Training Mode** — zero scoring, variable reward 49/51 schedule, "Release cue command" button, inter-trial wait timers, Train Again + Done end screen
- **Calendar** — monthly view with dot indicators (me/family/both)
- **Yearly Chart** — animated bar chart, best month, total hours
- **Profile** — command library with mastery colour system (Gray Added → Yellow Learning → Green Practising → Blue Reliable), achievement badges with descriptions + tap animations (bounce+glow for unlocked, shake+slide-up panel for locked), cue word fields (release cue, marker cue), dog photo upload via image picker
- **Settings** — notifications, family invite code, sign out

## Scoring Engine (`artifacts/pawplay/utils/scoring.ts`)

- Easy: 6s window, skip=0 pts, exceed=-1/sec, display floor max(0)
- Medium: 4s window, skip=0 pts, exceed=-1/sec, display floor max(0)
- Expert: 2s window, skip=-20 with overtime deduction, exceed=-1/sec, shows negatives in red
- Reset button: 25% deduction of maxPoints per press, tracked per command via resetCount
- Bonuses (capped at +50 total):
  - Perfect Round: all 5 within window, 0 skips → +20
  - Speed Demon: every command < half window → +5 per command
  - Combo Streak: 3+ consecutive within window → x1.5 multiplier on streak base pts
  - Clean Sweep: zero skips → +10
  - First Cue: zero resets → +3 per command (max +15)
  - Difficulty Bonus: Medium +10, Expert +25

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
- `dogs` — dog profiles per family (name, breed, age, level, xp, release_cue, marker_cue, avatar_url); multiple dogs per family supported
- `commands` — command library per dog (with level tracking)
- `sessions_record` — training session history with scoring
- `achievements` — dog/user achievement records
- `push_tokens` — Expo push notification tokens

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## EAS Build & Submit (iOS / Android)

PawPlay ships to the App Store and Google Play via Expo Application Services. The EAS CLI (`eas-cli`) and `expo-dev-client` are installed in the `pawplay` artifact, and `eas.json` defines `development`, `preview`, and `production` profiles. Bundle identifier: `com.quickmix.pawplay` (both platforms).

### One-time setup (do these once on your machine / Repl shell)
1. `cd artifacts/pawplay`
2. `./node_modules/.bin/eas login` — log in with your Expo account.
3. `./node_modules/.bin/eas init` — links this folder to an EAS project and writes `extra.eas.projectId` into `app.json`. Commit the change.

### Build commands (run from repo root)
- `pnpm --filter @workspace/pawplay run eas:build:ios` — production iOS build (.ipa)
- `pnpm --filter @workspace/pawplay run eas:build:android` — production Android build (.aab)
- `pnpm --filter @workspace/pawplay run eas:build:all` — both platforms in parallel

For an internal test build that installs on a device without going through the stores, run `eas build --profile preview -p ios` or `-p android` from `artifacts/pawplay`. For a dev client (lets you connect Metro to a custom build), use `--profile development`.

The first iOS build will prompt you to log in to your Apple Developer account so EAS can generate distribution certificates and provisioning profiles. The first Android build will generate an upload keystore. EAS stores both remotely (`credentialsSource: remote`).

### Submit commands
- `pnpm --filter @workspace/pawplay run eas:submit:ios` — upload latest iOS build to App Store Connect
- `pnpm --filter @workspace/pawplay run eas:submit:android` — upload latest Android build to Play Console (internal track)

Before the first submit you must provide credentials:

**iOS** — when you run `eas submit -p ios` it will interactively prompt for your Apple ID, App Store Connect app ID (ascAppId), and Apple Team ID. You can also pre-fill them under `submit.production.ios` in `eas.json`.

**Android** — drop a Google Play service account JSON file at `artifacts/pawplay/google-service-account.json` (the path referenced in `eas.json`). Generate it from Google Play Console → Setup → API access. The file is gitignore-worthy; do not commit it.
