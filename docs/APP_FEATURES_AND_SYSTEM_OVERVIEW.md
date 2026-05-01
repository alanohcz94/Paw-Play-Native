# PawPlay — App Features & System Overview

> Authoritative reference for AI coding tools (Claude Code, Cursor, Replit Agent, etc.).
> Read this file **before** making any change. Update it **after** any change. See
> [Rules for Future AI Code Changes](#rules-for-future-ai-code-changes) at the bottom.

---

## Table of Contents

1. [App Overview](#app-overview)
2. [Feature Inventory](#feature-inventory)
3. [User Flows](#user-flows)
4. [Database / Data Model Overview](#database--data-model-overview)
5. [Code Architecture](#code-architecture)
6. [Business Logic Rules](#business-logic-rules)
7. [Known Bugs / Risk Areas](#known-bugs--risk-areas)
8. [Rules for Future AI Code Changes](#rules-for-future-ai-code-changes)
9. [Changelog](#changelog)

---

## App Overview

**Name:** PawPlay (also referred to in user-facing strings as **QuickMix**).
**Bundle id:** `com.quickmix.pawplay` (iOS + Android).

**What it is.** PawPlay is a gamified dog-training mobile app. Owners run short
timed reps with their dog, the app scores each rep, and progress (XP, levels,
streaks, achievements) accrues per dog and per owner.

**Who it is for.** Dog owners — primarily pet parents — who want a structured,
fun way to practise basic obedience commands (Sit, Down, Stay, Come, Heel,
Place, Leave it) on a phone, alone or alongside friends.

**What problem it solves.** Casual dog training tends to be unstructured and
hard to keep up. PawPlay turns reps into short, scored mini-games with a
visible streak and a friend-based leaderboard, which makes consistency easier
and gives owners feedback on which commands are reliable vs. still being
learned.

**Main objective of the app.** Get the user to train their dog a little bit
every day, then surface that progress (commands mastered, streak days,
leaderboard rank vs. friends).

**Current product positioning.** A solo-or-with-friends dog-training game.
Each user owns their own dogs, has a personal 6-character invite code, and can
add friends mutually so both appear on each other's leaderboard / calendar /
yearly chart immediately. There is no shared "family" account anymore — the
old family model has been removed (see Changelog).

---

## Feature Inventory

Each feature lists what it does, why it exists, how the user touches it, how
it works in code, and any known gaps.

### Welcome / Home Landing (`app/home.tsx`)

- **What.** First screen the unauthenticated user lands on. Offers two
  entry points: **Try Demo** (no login) and **Continue with Replit** (full
  login + sync to backend).
- **Why.** Lets people taste the gameplay before signing up while still
  pushing real users into the synced experience.
- **User interaction.** Tap **Try Demo** → goes to `app/demo.tsx`. Tap
  **Continue with Replit** → triggers `useAuth().login()` (Replit OIDC).
- **Tech.** Uses `useAuth` from `lib/auth.tsx`. After successful login the
  AuthGuard in `app/_layout.tsx` routes the user into the tab bar.
- **Data.** Calls `GET /api/users/me` after login to lazy-create the
  `pawplay_users` row (with invite code), then `GET /api/users/{id}/dogs` and
  `GET /api/dogs/{dogId}/commands` to populate `AppContext`.
- **Status.** Complete.

### Demo Mode (`app/demo.tsx`)

- **What.** A self-contained Quick Bites mini-session with hard-coded
  commands and no API calls. Uses `calculateScore()` from `utils/scoring.ts`
  for a real score breakdown.
- **Why.** Removes signup friction so a curious user can experience the core
  loop in seconds.
- **Status.** Complete; never persists to DB.

### Authentication — Replit OIDC

- **What.** OpenID Connect login through Replit, with two flows:
  1. **Server-bridged flow** (standalone iOS/Android builds): the app opens
     the system browser, Replit redirects back to a custom scheme
     (`pawplay://auth-callback`), and the app posts the code to
     `POST /api/mobile-auth/token-exchange` to receive an opaque
     `auth_session_token`.
  2. **Direct PKCE flow** (Expo Go / web): uses `expo-auth-session` directly.
- **Why.** Lets the same backend session model work for browser and mobile
  clients without storing OIDC tokens client-side.
- **Tech.**
  - Client: `artifacts/pawplay/lib/auth.tsx` (`AuthProvider`, `useAuth`).
  - Token storage: `expo-secure-store` under key `auth_session_token`.
  - Authed requests: `artifacts/pawplay/lib/authedFetch.ts` wraps every API
    call and attaches `Authorization: Bearer <sid>`.
  - Server: `artifacts/api-server/src/routes/auth.ts` plus session middleware
    in `artifacts/api-server/src/middlewares/`.
- **Data.** Server-side sessions live in the `sessions` table (mandatory for
  Replit Auth). Auth users live in `users`. PawPlay-specific profile lives in
  `pawplay_users`.
- **Status.** Complete. 401 from any authed request triggers a
  session-expired handler in `AuthProvider` which clears stored tokens.

### Onboarding (`app/onboarding.tsx`)

- **What.** Multi-step flow that runs once after first login: create your
  first dog (name, breed, age) and pick which starting commands the dog
  already knows.
- **Why.** Bootstraps the per-dog data model so the rest of the UI has
  something to show.
- **User interaction.** Linear stepper. The "family invite" step from the
  pre-friends version of the app **no longer exists**.
- **Tech.** Calls `GET /api/users/me`, `PATCH /api/users/{id}` (display
  name), `POST /api/dogs`, then `POST /api/dogs/{dogId}/commands` for each
  selected command.
- **Status.** Complete.

### Multi-Dog Support

- **What.** Each user can own multiple dogs. The dashboard renders a
  `DogPicker` when the user has 2+ dogs; tapping a dog makes it the active
  dog for all subsequent screens (commands, scores, achievements, calendar).
- **Why.** Many households train more than one dog and progress should not
  bleed across them.
- **User interaction.** `DogPicker` is a horizontal scroll on the dashboard;
  the **Add Dog** button opens `app/add-dog.tsx`.
- **Tech.** Active dog id lives in `AppContext` (`activeDogId`). When it
  changes, `loadCommandsForDog(dogId)` is called.
- **API.** `GET /api/users/{userId}/dogs`, `POST /api/dogs`, `PATCH
  /api/dogs/{dogId}` (used by the profile screen for cues / avatar),
  `DELETE /api/dogs/{dogId}`.
- **Status.** Complete.

### Dashboard (`app/(tabs)/index.tsx`)

- **What.** Home tab. Shows the active dog, today's streak, weekly activity
  grid, the friends leaderboard, and a link into the calendar.
- **User interaction.** Tap a dog in the picker to switch dogs. Tap a
  leaderboard row to confirm-and-remove a friend (`Alert` /
  `window.confirm`). Tap **Calendar** to open the monthly view.
- **API.** `GET /api/sessions?dogId=<active>` (recent activity), `GET
  /api/leaderboard`, `DELETE /api/friends/{friendId}` on confirmed remove.
- **Status.** Complete.

### Games Hub (`app/(tabs)/games.tsx`)

- **What.** Picker for game modes: **Quick Bites**, **Training Mode**, and
  **Blitz**. Modes that require a minimum number of reliable commands are
  visibly locked until that bar is met.
- **Why.** Single entry point for everything that scores.
- **Status.** Complete.

### Quick Bites — `challenge-setup.tsx` → `challenge-active.tsx` → `challenge-end.tsx`

- **What.** Scored mini-game. The user selects difficulty (easy / medium /
  expert) and the app then runs 5 commands in sequence. For each command,
  the user gives the cue, holds a HOLD button while the dog performs, and
  releases when the dog completes. The timer continues past the difficulty
  window as a negative penalty. There is also a Reset button (counted as a
  25%-of-max-points deduction per press).
- **Tech.** Scoring via `calculateScore(inputs, difficulty)` in
  `utils/scoring.ts` (see [Business Logic Rules](#business-logic-rules)).
- **Persistence.** `challenge-end.tsx` posts `POST /api/sessions` with
  `mode: "quickbites"`, then re-fetches `GET /api/dogs/{dogId}/commands`.
- **Status.** Complete.

### Training Mode — `training-config.tsx` → `training-active.tsx`

- **What.** Zero-scoring repetition mode focused on a single command, using
  a variable reward schedule (49/51) and explicit marker / release cues
  between reps.
- **Why.** Practice loop that doesn't pressure the user with score; helps a
  command climb its level threshold (5 training sessions → Level 2).
- **Persistence.** `POST /api/sessions` with `mode: "training"`.
- **Status.** Complete.

### Blitz — `blitz-setup.tsx` → `blitz-active.tsx` → `blitz-end.tsx`

- **What.** High-intensity mode where commands flash one after another.
  Tracks Personal Best per dog by reading historical sessions.
- **Persistence.** `POST /api/sessions` with `mode: "blitz"`. PB derived
  from `GET /api/sessions`.
- **Status.** Complete (note: `blitz-active.tsx` has pre-existing TS
  errors — see Known Bugs).

### Calendar (`app/calendar.tsx`)

- **What.** Monthly calendar coloured by who trained that day:
  * dot for **trained-by-me**,
  * dot for **trained-by-friends**,
  * combined badge when both happened.
  Tapping a day drills down to the sessions for that date.
- **API.** `GET /api/calendar?month=&year=` returns
  `{ days[], totalSessions, totalHours, avgScore }`. Drill-down uses
  `GET /api/sessions?dogId=&date=YYYY-MM-DD` (server clips to UTC day).
- **Status.** Complete.

### Yearly Chart (`app/yearly-chart.tsx`)

- **What.** Animated bar chart of training hours per month for the current
  year, plus best month and total hours.
- **API.** `GET /api/yearly-chart?year=`.
- **Status.** Complete.

### Achievements (`app/achievements.tsx`, `hooks/useAchievements.ts`, `components/AchievementBanner.tsx`)

- **What.** Library of 8 achievements (Starter, 7-Day Streak, 30-Day
  Streak, Amazing Student, Distinction Student, Family Champ, Reliable
  Handler, Month Pawfect). Locked badges show a shake + a slide-up info
  panel; unlocked badges bounce + glow. A banner pops down at the top of
  the screen when one is newly unlocked.
- **Where evaluated.** `hooks/useAchievements.ts` derives `unlocked` from
  the active dog's commands and the user streak (no server call).
- **Status.** Partially complete. There is **no `achievements` DB write
  path** in the current routes — the table exists but nothing inserts into
  it. The route `GET /api/dogs/{dogId}/achievements` exists in OpenAPI but
  is **not wired up** in `routes/index.ts` (see Known Bugs).

### Profile Tab (`app/(tabs)/profile.tsx`)

- **What.** Shows the active dog's photo, breed, age; lets the owner edit
  the release cue and marker cue and upload an avatar; lists the command
  library with the mastery colour system (Gray Added → Yellow Learning →
  Green Practising → Blue Reliable). Also embeds the friends leaderboard.
- **API.** `GET /api/dogs/{dogId}/commands`, `PATCH /api/dogs/{dogId}`,
  `POST /api/dogs/{dogId}/commands`, `GET /api/leaderboard`, `DELETE
  /api/friends/{friendId}` (tap-to-remove on leaderboard row).
- **Status.** Complete.

### Settings Tab (`app/(tabs)/settings.tsx`)

- **What.** One screen, three blocks:
  1. **Account** — display name, sign out, **Delete account** (irreversible).
  2. **Preferences** — push reminder time, sound on/off.
  3. **Friends** — your 6-character invite code with **Copy** + **Share**;
     an **Add a Friend** input that takes a 6-character code; and a
     **Your Friends (N)** list with tap-to-remove.
- **Why.** Friend code is the only way to add a friend; copy/share makes it
  trivial to send to someone outside the app.
- **API.** `GET /api/users/me`, `GET /api/friends`, `POST /api/friends`,
  `DELETE /api/friends/{id}`, `DELETE /api/users/{id}` (full account
  delete).
- **Tech.** Uses `expo-clipboard.setStringAsync` for Copy and
  `react-native` `Share` for Share.
- **Status.** Complete.

### Friends — Mutual Friendship Model

- **What.** Each user has a personal 6-character `invite_code` (unique).
  Adding a friend by their code creates a **bidirectional pair** of rows in
  `friendships` (`(me, them)` and `(them, me)`) so both users see each other
  on the leaderboard immediately, with no accept/decline step. Removing a
  friend deletes both directions.
- **Why.** Replaces the old "family" group model. Simpler mental model and
  no shared ownership of dogs.
- **API.** `GET /api/friends`, `POST /api/friends` (body `{code}`),
  `DELETE /api/friends/{friendId}`.
- **Validation.** Code must be exactly 6 chars after upper-casing; can't add
  yourself; duplicate add returns 409.
- **Status.** Complete.

### Leaderboard

- **What.** Ranks the caller and all friends by `participationPoints`
  summed across `sessions_record`.
- **API.** `GET /api/leaderboard` → `{ entries: [{userId, displayName,
  totalPoints, sessionCount, profileImageUrl}] }`.
- **Privacy.** Only returns the caller and the caller's direct friends —
  never strangers. `profileImageUrl` is currently always `null` (see Known
  Bugs).
- **Status.** Complete (with the caveats above).

### Push Notifications (skeleton)

- **What.** `pawplay_users.expoPushToken` and the `push_tokens` table
  exist; `PATCH /api/users/{userId}/push-token` upserts the token.
- **Status.** Token plumbing complete; **no server actually sends pushes
  yet**. Nothing in the codebase fans out reminders or alerts.

---

## User Flows

### 1. First-Time Onboarding

1. App opens → `app/index.tsx` → redirects to `app/home.tsx`.
2. User taps **Continue with Replit** → OIDC flow → returns with a session
   token, stored in `expo-secure-store`.
3. AuthGuard in `app/_layout.tsx` notices the user has no dogs yet (or no
   `pawplay_users` row), and routes them to `app/onboarding.tsx`.
4. Onboarding posts:
   - `GET /api/users/me` → lazy-creates `pawplay_users` with a unique 6-char
     `invite_code`.
   - `PATCH /api/users/{id}` to set `displayName`.
   - `POST /api/dogs` for the first dog.
   - `POST /api/dogs/{dogId}/commands` for each starter command.
5. Sets `onboardingComplete: true` in `AppContext` (persisted to
   AsyncStorage), then navigates to `(tabs)/index.tsx`.

**Validation rules.** Dog `name` is required. Display name is optional but
defaults to "User" server-side.

**Edge cases.** If `POST /api/users/me` returns concurrently for the same
user, `ensurePawplayUser` retries on unique-collision and returns the
already-existing row.

### 2. Login Flow (Returning User)

1. `app/home.tsx` → tap **Continue with Replit** → OIDC.
2. On success, `AppContext` calls `loadDogsFromApi(userId)` and
   `loadCommandsForDog(activeDogId)`. AuthGuard then routes to `(tabs)`.

### 3. Daily Training (Quick Bites)

1. Dashboard → **Games** tab → **Quick Bites**.
2. `challenge-setup.tsx`: pick difficulty.
3. `challenge-active.tsx`: 5 prompts, HOLD-and-release per command.
4. `challenge-end.tsx`: shows the breakdown, calls `POST /api/sessions` with
   `mode: "quickbites"`. Server inserts the session and updates each
   referenced command's counters and `level` (see Business Logic Rules).
5. Newly unlocked achievements (computed client-side via
   `useAchievements`) are displayed via `AchievementBanner`.

### 4. Training Mode

Same shape as Quick Bites but `mode: "training"` and zero scoring; success
counts increment `trainingSessionsCount` instead of `qbSuccessesCount`.

### 5. Blitz

Same shape as Quick Bites but `mode: "blitz"` and successes accumulate into
`blitzSuccessesCount`. PB is derived client-side from
`GET /api/sessions?dogId=`.

### 6. Friends Flow (replaces former "family" flow)

1. **Get your code.** Settings → Friends card shows your `invite_code`.
   Buttons: **Copy** (`expo-clipboard.setStringAsync`) and **Share**
   (system share sheet).
2. **Add a friend.** Settings → enter their 6-character code → tap Add.
   `POST /api/friends` validates the code, blocks self-add, blocks
   duplicates, then inserts both `(me, them)` and `(them, me)` rows.
3. **See them on the leaderboard.** `GET /api/leaderboard` immediately
   includes the new friend; ranking is by lifetime `participationPoints`.
4. **Remove a friend.** Tap their row on the dashboard or profile
   leaderboard → confirm in `Alert` / `window.confirm` → `DELETE
   /api/friends/{friendId}` removes both directions.

**Validation.**
- Code is normalised: `trim().toUpperCase()`.
- Length must be exactly 6 → 400 otherwise.
- Self-add → 400.
- Already friends → 409.
- Code not found → 404.

### 7. Calendar Flow

1. Dashboard → Calendar.
2. `GET /api/calendar?month=&year=` returns one entry per day with
   `trainedByMe`, `trainedByFriends`, `sessionCount`.
3. Tap a day → drill-down via
   `GET /api/sessions?dogId=<active>&date=YYYY-MM-DD`.

### 8. Pet Profile Flow

1. Profile tab → see active dog photo / breed / age.
2. Edit avatar via `expo-image-picker`, edit cues inline. Each save calls
   `PATCH /api/dogs/{dogId}` with the changed field.

### 9. Settings / Account Deletion Flow

1. Settings → **Delete account** → confirm.
2. `DELETE /api/users/{id}` performs a transactional delete across
   `commands`, `sessions_record`, `achievements`, `dogs`, `friendships`,
   `push_tokens`, `pawplay_users`, `users`, and the auth `sessions` row.
3. Client clears `expo-secure-store` and routes back to `home.tsx`.

### Subscriptions / Payments

**None.** There is no payment, subscription, or feature-gating logic in the
codebase as of this writing.

### Admin / Internal Flows

**None.** There is no admin UI or admin route.

---

## Database / Data Model Overview

PostgreSQL via Drizzle ORM. Schemas live in `lib/db/src/schema/`.

### `sessions` (auth) — `lib/db/src/schema/auth.ts`

Mandatory for Replit Auth. **Do not drop.**

| Column | Type | Meaning |
|---|---|---|
| `sid` | `varchar` PK | Opaque session id (the "Bearer" token / cookie value). |
| `sess` | `jsonb` | Serialised session payload (OIDC tokens, user id, etc.). |
| `expire` | `timestamp` | Expiry; indexed (`IDX_session_expire`). |

**Used by:** `middlewares/authMiddleware.ts` to look up the session and
hydrate `req.user`. TTL is 7 days.

### `users` (auth) — `lib/db/src/schema/auth.ts`

Mandatory for Replit Auth. **Do not drop.**

| Column | Type | Meaning |
|---|---|---|
| `id` | `varchar` PK (`gen_random_uuid()`) | Auth user id; also FK target everywhere else. |
| `email` | `varchar` UNIQUE | Email from OIDC. |
| `firstName` | `varchar` | OIDC profile. |
| `lastName` | `varchar` | OIDC profile. |
| `profileImageUrl` | `varchar` | OIDC profile. |
| `createdAt` / `updatedAt` | `timestamp` | Audit. |

**Used by:** `auth.ts` (upsert on login). Referenced by `pawplay_users.id`.

### `pawplay_users` — `lib/db/src/schema/pawplay.ts`

Per-user PawPlay profile. Lazy-created on first `GET /api/users/me`.

| Column | Type | Meaning |
|---|---|---|
| `id` | `varchar` PK | Same as `users.id`. |
| `replit_id` | `varchar` | Optional Replit id. |
| `display_name` | `varchar` | Friendly name shown in leaderboard / profile. |
| `email` | `varchar` | Cached email. |
| `invite_code` | `varchar(6)` NOT NULL UNIQUE | Personal friend code. Generated as 3 random bytes hex-uppercased. |
| `expo_push_token` | `varchar` | Latest device token. |
| `created_at` | `timestamp` | Created when the row is lazy-inserted. |

**Privacy.** Email, replit id, and push token are **only** returned for the
caller's own row. Friend lookups return `{id, displayName, inviteCode}`
only. Strangers get `403 Forbidden` from `GET /api/users/:userId`.

### `dogs` — `lib/db/src/schema/pawplay.ts`

Each dog is owned by exactly one user. There is no shared ownership.

| Column | Type | Meaning |
|---|---|---|
| `id` | `varchar` PK (`gen_random_uuid()`) | Dog id. |
| `user_id` | `varchar` NOT NULL | Owner; references `pawplay_users.id` (logical FK, not enforced at DB level). |
| `name` | `varchar` NOT NULL | Dog name. |
| `age` | `real` | Years (decimal allowed). |
| `breed` | `varchar` | Free text. |
| `avatar_url` | `varchar` | Photo URL. |
| `release_cue` | `varchar` default `Free` | Word the handler uses to release the dog. |
| `marker_cue` | `varchar` default `Yes` | Marker word ("yes", "good", clicker substitute). |
| `level` | `integer` NOT NULL default `1` | Dog-level XP tier (currently not actively incremented). |
| `xp` | `integer` NOT NULL default `0` | Dog-level XP (currently not actively incremented). |
| `created_at` | `timestamp` | Audit. |

**Used by:** every command/session route asserts ownership via
`assertDogOwned(dogId, callerId)` before reading or writing.

### `commands` — `lib/db/src/schema/pawplay.ts`

Per-dog command library. Each row tracks how often the dog has trained that
command and what mastery level it sits at.

| Column | Type | Meaning |
|---|---|---|
| `id` | `varchar` PK | UUID. |
| `dog_id` | `varchar` NOT NULL | Owning dog. |
| `name` | `varchar` NOT NULL | "Sit", "Down", etc. (free text but standard set is `ALL_COMMANDS` in `utils/scoring.ts`). |
| `level` | `integer` NOT NULL default `1` | Mastery level: 1 = Learning, 2 = Practising, 3 = Reliable. Recomputed server-side on every successful session. |
| `training_sessions_count` | `integer` default `0` | Reps in **Training Mode**. |
| `qb_successes_count` | `integer` default `0` | Successful reps in **Quick Bites**. |
| `qb_sessions_with_success` | `integer` default `0` | Number of QB sessions where this command had at least one success. |
| `blitz_successes_count` | `integer` default `0` | Successful reps in **Blitz**. |
| `last_used_at` | `timestamp` | Updated whenever the command appears in a saved session. |
| `added_at` | `timestamp` | When the command was added to the library. |

**Level rules** (server, `evaluateCommandLevel` in `routes/sessions.ts`):
- `qb_successes_count ≥ 10 AND qb_sessions_with_success ≥ 3` → level **3**
  (note: the qb count compared here actually includes blitz successes — see
  Known Bugs).
- Else `training_sessions_count ≥ 5` → level **2**.
- Else level **1**.

### `sessions_record` — `lib/db/src/schema/pawplay.ts`

History of every saved training session.

| Column | Type | Meaning |
|---|---|---|
| `id` | `varchar` PK | UUID. |
| `dog_id` | `varchar` NOT NULL | Dog the session was for. |
| `user_id` | `varchar` NOT NULL | Handler (always the caller). |
| `mode` | `varchar` NOT NULL | `"quickbites"`, `"training"`, or `"blitz"`. |
| `difficulty` | `varchar` NULL | `"easy" | "medium" | "expert"` for QB; null for Training. |
| `raw_score` | `integer` NOT NULL default `0` | Score after bonuses. |
| `participation_points` | `integer` NOT NULL default `0` | What feeds the leaderboard. Currently equal to `raw_score`. |
| `bonuses` | `jsonb` default `[]` | Bonus breakdown items returned by `calculateScore`. |
| `commands_used` | `jsonb` default `[]` | Per-command result entries used to drive command-level updates. |
| `duration_seconds` | `integer` NULL | Session duration. Used by calendar / yearly-chart for hours. |
| `completed` | `boolean` default `false` | Whether the user finished the session. Only completed sessions update command counters. |
| `created_at` | `timestamp` | Used for date filtering (calendar / yearly-chart / dashboard activity). |

### `achievements` — `lib/db/src/schema/pawplay.ts`

Schema exists but is currently **dormant**: no route inserts into it,
client-side achievements are derived purely from commands + streak.

| Column | Type | Meaning |
|---|---|---|
| `id` | `varchar` PK | UUID. |
| `dog_id` | `varchar` NOT NULL | Dog the achievement is for. |
| `user_id` | `varchar` NULL | Handler (optional). |
| `type` | `varchar` NOT NULL | E.g. `streak_7`, `reliable_handler`. |
| `metadata` | `jsonb` default `{}` | Free-form. |
| `earned_at` | `timestamp` | When unlocked. |

### `push_tokens` — `lib/db/src/schema/pawplay.ts`

Latest Expo push token per user. Upserted by `PATCH
/api/users/{userId}/push-token`.

| Column | Type | Meaning |
|---|---|---|
| `user_id` | `varchar` PK | Owner. |
| `expo_push_token` | `text` NOT NULL | Token string. |
| `platform` | `varchar` NULL | `"ios"` or `"android"`. |
| `updated_at` | `timestamp` | Audit. |

### `friendships` — `lib/db/src/schema/pawplay.ts`

Mutual friendships, stored bidirectionally.

| Column | Type | Meaning |
|---|---|---|
| `user_id` | `varchar` NOT NULL | Side A. |
| `friend_id` | `varchar` NOT NULL | Side B. |
| `created_at` | `timestamp` | When the row was inserted. |

PK = `(user_id, friend_id)`. Adding a friend inserts both `(me, them)` and
`(them, me)` so a single `WHERE user_id = me` query is enough to enumerate
my friends. Removing deletes both directions.

**Privacy.** `GET /api/users/{userId}` checks that
`(caller, target) ∈ friendships` before returning the minimal projection;
otherwise responds 403 (no enumeration distinction with "doesn't exist").

---

## Code Architecture

### Monorepo Layout (pnpm workspaces)

```
artifacts/
  api-server/        Express 5 backend (artifact id 3B4_FFSkEVBkAeYMFRJ2e)
  pawplay/           Expo (React Native) mobile + web app
  mockup-sandbox/    Vite preview server for canvas mockups (design tooling, not user-facing)
lib/
  api-spec/          OpenAPI 3.1 spec — single source of truth (lib/api-spec/openapi.yaml)
  api-zod/           Zod schemas generated from openapi.yaml
  api-client-react/  React Query hooks generated from openapi.yaml
  db/                Drizzle ORM schemas + db client
scripts/             Repo-level utility scripts (e.g. post-merge.sh)
docs/                This file.
pnpm-workspace.yaml
package.json
```

### Backend (`artifacts/api-server`)

- **Framework:** Express 5, TypeScript, esbuild bundle.
- **Entrypoint:** `src/index.ts` → `src/app.ts` (mounts middleware + routes).
- **Routes** (`src/routes/`):
  - `health.ts` — `/healthz`.
  - `auth.ts` — Replit OIDC browser + mobile flows; session create/delete.
  - `users.ts` — `PATCH /users/:id`, `DELETE /users/:id`, `PATCH
    /users/:id/push-token`, `GET /users/:id` (self-or-friend, minimal
    projection for friends, 403 otherwise).
  - `friends.ts` — `GET /users/me`, `GET/POST /friends`, `DELETE
    /friends/:friendId`, `GET /leaderboard`, `GET /calendar`, `GET
    /yearly-chart`. (Yes — `/users/me`, `/leaderboard`, `/calendar`, and
    `/yearly-chart` live in this file even though their tags differ.)
  - `dogs.ts` — `POST /dogs`, `GET/PATCH/DELETE /dogs/:dogId`, `GET
    /users/:userId/dogs`. All checks are owner-only via `assertDogOwned`.
  - `commands.ts` — `GET/POST /dogs/:dogId/commands`, `PATCH
    /commands/:dogId/:name`, `DELETE /commands/:dogId/:name`. Owner-only.
  - `sessions.ts` — `POST /sessions`, `GET /sessions`. Owner-only; `GET`
    is always force-scoped to `req.user.id`.
- **Middleware** (`src/middlewares/`):
  - Session middleware looks up `Authorization: Bearer <sid>` or `sid`
    cookie, hydrates `req.user`, and refreshes the OIDC access token from
    the refresh token if expired.
  - Standard logging (`req.log`) — never use `console.log` server-side.
- **DB client:** `lib/db/src/index.ts` exports a Drizzle `db` instance
  bound to `DATABASE_URL`.
- **Validation:** Zod schemas from `@workspace/api-zod` (generated). Routes
  may also do ad-hoc validation; preferred long-term is to use the Zod
  schemas.

### Mobile / Web App (`artifacts/pawplay`)

- **Framework:** Expo SDK with `expo-router` (file-based routing).
- **Routes are folders/files under `app/`:**
  - `app/_layout.tsx` — root stack, providers, AuthGuard.
  - `app/index.tsx` — `<Redirect href="/home" />`.
  - `app/home.tsx`, `app/demo.tsx`, `app/onboarding.tsx`, `app/add-dog.tsx`,
    `app/calendar.tsx`, `app/yearly-chart.tsx`, `app/achievements.tsx`,
    `app/challenge-{setup,active,end}.tsx`,
    `app/training-{config,active}.tsx`,
    `app/blitz-{setup,active,end}.tsx`.
  - `app/(tabs)/{index,games,profile,settings}.tsx` — bottom tab bar.
- **Components (`components/`):**
  - `FamilyLeaderboard.tsx` — leaderboard list (tap-to-remove). Name is
    historical; it is the *friends* leaderboard.
  - `DogPicker.tsx` — dog switcher.
  - `AchievementBanner.tsx` — slide-down banner.
  - `ErrorBoundary.tsx` + `ErrorFallback.tsx` — top-level error capture.
  - `KeyboardAwareScrollViewCompat.tsx` — RN keyboard-avoiding wrapper.
- **Hooks (`hooks/`):**
  - `useAchievements.ts` — derives unlocked achievements from `commands`
    and `streak`.
  - `useColors.ts` — theme tokens; switches by system colour scheme.
  - `useSound.ts` — `expo-av` UI sounds (`ding`, `success`, `achievement`).
- **State management:** `context/AppContext.tsx` is the single React
  context. Holds `dogs`, `activeDogId`, `commands` (for active dog),
  `inviteCode`, `streak`, `lastTrainedDate`, `seenAchievements`,
  `reminderTime`, `soundEnabled`, `onboardingComplete`. Persisted to
  `AsyncStorage` under key `pawplay_app_state`.
- **Routing:** `expo-router` Stack at the root, Tabs under `(tabs)`.
  AuthGuard redirects unauthenticated users away from `(tabs)`.
- **Auth:** `lib/auth.tsx` (`AuthProvider`, `useAuth`). Token in
  `expo-secure-store`. All API calls go through `lib/authedFetch.ts`,
  which attaches the bearer token and surfaces 401s to a global
  session-expired handler.
- **API client:** Generated React Query hooks in `@workspace/api-client-react`
  and Zod validators in `@workspace/api-zod`. Both are produced by
  `pnpm --filter @workspace/api-spec run codegen` from
  `lib/api-spec/openapi.yaml`. **Do not hand-edit generated files** in
  `lib/api-zod/src` or `lib/api-client-react/src` — edit the spec and
  regenerate.
- **Error handling:** `ErrorBoundary` for render errors; `authedFetch`
  rejects with structured errors that screens turn into inline text or
  `Alert`s. No global toast system.
- **Logging:** Client uses `console.*`; server **must** use `req.log` /
  the singleton `logger` (see `pnpm-workspace` skill).

### Codegen Pipeline

1. Edit `lib/api-spec/openapi.yaml`.
2. Run `pnpm --filter @workspace/api-spec run codegen`.
3. Use the generated hooks (`@workspace/api-client-react`) on the client and
   the Zod schemas (`@workspace/api-zod`) on the server.
4. Do not change `info.title` in the spec — it controls generated filenames.

### Backend / API Conventions

- All artifacts live behind a shared reverse proxy on `localhost:80`. The
  API server is exposed under `/api` (`paths = ["/api"]` in
  `.replit-artifact/artifact.toml`).
- For ad-hoc curl: `curl localhost:80/api/healthz` (never hit the API
  server's port directly).
- All authed routes return 401 when `req.isAuthenticated()` is false.
- All cross-resource checks (dog ownership, friend access) return 404 by
  preference (no enumeration distinction with "doesn't exist").

---

## Business Logic Rules

### Scoring (`artifacts/pawplay/utils/scoring.ts`)

Per command:

| Difficulty | Window | Skip penalty | Exceeded-window penalty |
|---|---|---|---|
| Easy | 6 s | 0 | `−1 / extra second` (display floor at 0) |
| Medium | 4 s | 0 | `−1 / extra second` (display floor at 0) |
| Expert | 2 s | `−20 − overtimeSeconds` | `−1 / extra second` (negatives shown in red) |

- Base reward per successful command: `maxPoints` (default `20`). Reset
  button is tracked per command (`resetCount`); the client surfaces a
  25%-of-`maxPoints` deduction per press in the UI.
- Bonuses (server stores them, client computes them):
  - **Combo Streak** — 3+ consecutive commands within window → bonus =
    `floor(0.5 × sum of those base points)`.
  - **Clean Sweep** — zero skipped commands → `+10`.
  - **First Cue** — zero resets across all commands → `min(3 × N, 15)` where
    `N` is the number of commands.
  - **Difficulty Bonus** — Medium `+10`, Expert `+25`.
- Bonuses are summed and capped at `+50` total before adding to `rawScore`.
- `participationPoints` returned to the leaderboard equals the final
  `rawScore` (raw + capped bonuses).

> "Perfect Round" and "Speed Demon" are documented in older versions of the
> repo but were removed alongside Obedience Challenge.

### Streaks

- **Per-dog streak.** Stored in `AppContext` as
  `dogStreaks[dogId] = { streak, lastTrainedDate }`. Persists to
  AsyncStorage. Increments by 1 if the previous trained date was
  yesterday; resets to 0 otherwise. There is **no server-side streak**.
- **User-level streak.** Mirrors the active dog's streak in the current
  implementation (`AppContext` exposes `streak`). Used by
  `useAchievements` for `streak_7` and `streak_30`.

### Command Mastery (server, `routes/sessions.ts`)

On every completed session that includes a `commandsUsed[]` array, the
server groups by command name and updates each command's counters:

- **Quick Bites** — increments `qb_successes_count` by total reps with at
  least one success and `qb_sessions_with_success` by 1 (per session, not
  per rep).
- **Training Mode** — increments `training_sessions_count` by total reps.
- **Blitz** — increments `blitz_successes_count` by total successful reps.

Then recomputes `level`:

```
qbSuccessesCount  = qb_successes_count + blitz_successes_count   // see Known Bugs
qbSessionsWithSuccess  = qb_sessions_with_success
trainingSessionsCount  = training_sessions_count

level = 3  if (qbSuccessesCount ≥ 10 AND qbSessionsWithSuccess ≥ 3)
      = 2  else if trainingSessionsCount ≥ 5
      = 1  otherwise
```

Mastery colour mapping (UI):

- Gray = "Added", Yellow = "Learning", Green = "Practising" (level 2),
  Blue = "Reliable" (level 3).

### Achievements (`hooks/useAchievements.ts`)

| Type | Unlocked when |
|---|---|
| `first_session` | Any command has `trainingSessionsCount > 0` or `qbSuccessesCount > 0`. |
| `streak_7` | `streak ≥ 7`. |
| `streak_30` | `streak ≥ 30`. |
| `reliable_handler` | At least 1 command at level ≥ 3 (or with `qbSuccessesCount ≥ 10 && qbSessionsWithSuccess ≥ 3`). |
| `amazing_student` | Some command has `trainingSessionsCount + qbSuccessesCount ≥ 100`. |
| `distinction_student` | All 7 basic commands at `trainingSessionsCount + qbSuccessesCount ≥ 100`. |
| `family_champion` | **Defined but never set.** No code path unlocks this. |
| `month_pawfect` | **Defined but never set.** No code path unlocks this. |

Achievements are evaluated client-side from `AppContext`; the
`achievements` DB table is currently unused.

### Friendship Rules

- Adding by code: code is normalised (`trim().toUpperCase()`), must be
  exactly 6 chars, can't be your own, can't already be friends.
- Friendships are stored in **both directions** so leaderboard / calendar /
  yearly-chart can use a single `WHERE user_id = me` query.
- Removing deletes both directions in one statement.

### Permissions / Ownership

- A user can only see / write their own dogs, commands, and sessions.
- `assertDogOwned(dogId, callerId)` is the canonical guard. On failure the
  response is **404 "Dog not found"** (never 403) to avoid leaking that the
  dog exists.
- `GET /api/users/:userId`:
  - self → full row,
  - friend → minimal projection `{id, displayName, inviteCode}`,
  - stranger or unknown id → **403 Forbidden** (no enumeration).
- `GET /api/sessions` is always force-scoped to `req.user.id`. Any
  `userId=` query parameter is ignored.
- `GET /api/leaderboard`, `GET /api/calendar`, `GET /api/yearly-chart` only
  include data for the caller and the caller's direct friends.

### Account Deletion

`DELETE /api/users/:userId` performs a transactional delete in this order:
`commands` → `sessions_record` → `achievements` → `dogs` → `friendships` →
`push_tokens` → `pawplay_users` → auth `sessions` → `users`. Self-only.

### Subscription / Feature Gating

There is currently **no subscription, payment, or feature-gating logic**
anywhere in the codebase. All features are free.

---

## Known Bugs / Risk Areas

> When you fix any of these, move the entry to the [Changelog](#changelog).

1. **`achievements` table is dormant.** No server code inserts into it, and
   `GET /api/dogs/:dogId/achievements` is declared in OpenAPI but **not
   wired into `routes/index.ts`** (no router registers the handler). All
   achievement evaluation is client-only. Risk: achievements are not
   shareable across friends or surfaced on the leaderboard.
2. **`family_champion` and `month_pawfect` achievements** are listed in
   `ACHIEVEMENT_DEFS` but no code path unlocks them — they will never
   appear unlocked.
3. **Leaderboard `profileImageUrl` is hard-coded `null`.** `routes/friends.ts`
   `/leaderboard` returns `profileImageUrl: null` for every entry even
   though `users.profile_image_url` exists.
4. **Mastery level miscount.** In `routes/sessions.ts` `evaluateCommandLevel`
   is called with `qbSuccessesCount: newQbSuccesses + newBlitzSuccesses`,
   which combines two distinct counts. This is consistent with the
   client-side achievement check but is misleading — the column in the DB
   is named `qb_successes_count`, not "qb+blitz successes".
5. **Per-dog vs. per-user streak ambiguity.** `AppContext` tracks per-dog
   streaks but exposes a single `streak` value. There is no server source
   of truth for streaks, so a fresh install loses streak history.
6. **No DB-level FKs.** Schema files declare logical relationships
   (`user_id`, `dog_id`) but no Postgres FOREIGN KEY constraints. Cleanup
   on deletion relies entirely on the application-level cascade in
   `DELETE /api/users/:userId`. Risk: an orphaned row is possible if a
   future code path forgets the cascade.
7. **`pawplay_users.invite_code` allocation retries on collision** (6
   attempts, hex-uppercase 3-byte → ~16.7M space). Adequate today, but
   could become hot under heavy concurrent signups.
8. **`commands` table has no UNIQUE on `(dog_id, name)`.** `POST
   /api/dogs/:dogId/commands` could insert duplicates. Updates use
   `WHERE dog_id = ? AND name = ?` which would silently update one of
   them.
9. **Pre-existing TS errors (untouched).** `app/blitz-active.tsx`,
   `components/DogPicker.tsx`, and `lib/auth.tsx` have residual TypeScript
   errors carried over from prior tasks. They do not block runtime but
   make the editor noisy.
10. **Push notifications are stubbed.** `push_tokens` and `expoPushToken`
    plumbing exist but **no server code actually sends a push**. Reminder
    time in Settings is local-only.
11. **Calendar / yearly-chart pull all sessions for caller + friends into
    memory** and filter in JS. Fine at current scale; will need a
    `GROUP BY date` SQL roll-up when a user has many friends with long
    histories.
12. **`FamilyLeaderboard.tsx` name is historical.** It is the *friends*
    leaderboard. Renaming the file is purely cosmetic but will reduce
    future confusion.

---

## Rules for Future AI Code Changes

1. **Read this file first.** Before any code change, scan the relevant
   sections (Feature Inventory, Database, Business Logic) so you don't
   re-derive existing behaviour.
2. **Update this file after every change.** A change isn't done until the
   doc reflects it.
3. **New feature → add a Feature Inventory entry.** Include all the
   subheadings used by the existing entries.
4. **Existing feature changed → update its purpose, behaviour, files,
   APIs, and data model details.** Don't leave stale prose.
5. **DB schema change → update Database / Data Model Overview.** Include
   every new column with type and meaning. Update `lib/db/src/schema/`
   and run `pnpm --filter @workspace/db push-force` (dev) /
   migrations as appropriate.
6. **Business logic change → update Business Logic Rules.** Especially
   scoring constants, bonus rules, level thresholds, ownership rules, and
   privacy rules.
7. **Bug fix → move the entry from Known Bugs into the Changelog.**
8. **Don't delete documentation** unless the underlying code or feature
   was actually removed.
9. **Stay factual.** Document only what the code does, not what you wish
   it did.
10. **If unsure, write "Needs verification".** Do not invent behaviour.
11. **API contract is OpenAPI-first.** Edit `lib/api-spec/openapi.yaml`,
    then run `pnpm --filter @workspace/api-spec run codegen`. Never
    hand-edit `lib/api-zod/src` or `lib/api-client-react/src`.
12. **Server logging.** Never use `console.log` in server code — use
    `req.log` in handlers and the singleton `logger` for non-request code.
13. **Ownership and privacy guards are non-negotiable.** Any new route
    that touches `dogs`, `commands`, `sessions_record`, `friendships`, or
    `pawplay_users` must:
    - call `assertDogOwned` (or equivalent) for dog-scoped data,
    - return **404** (not 403) for missing-or-not-owned dogs,
    - return **403** for cross-user `users/:id` access (no enumeration),
    - never leak `email`, `replit_id`, or `expo_push_token` outside the
      caller's own row.
14. **Don't reintroduce the "family" model.** Friendships are mutual,
    per-user, and bidirectional. Dogs are owned by exactly one user.

---

## Changelog

### 2026-05-01

- Initial documentation generated from the current codebase.
- Captured the post–family-removal architecture: per-user dogs, mutual
  `friendships` table, personal 6-character `invite_code` per user,
  leaderboard / calendar / yearly-chart scoped to caller + friends.
- Documented privacy posture finalized in tasks #14 and #16:
  `GET /api/sessions` always force-scoped to caller; cross-user dog
  access returns 404; `GET /api/users/:userId` returns full row only for
  self, minimal projection for direct friends, 403 otherwise.
- Documented current scoring (Combo Streak, Clean Sweep, First Cue,
  Difficulty Bonus; cap +50) and command-mastery thresholds as
  implemented in `routes/sessions.ts` and `utils/scoring.ts`.
- Flagged 12 known risk areas, including the dormant `achievements`
  table, never-unlocked `family_champion` / `month_pawfect`, missing
  `(dog_id, name)` uniqueness on `commands`, and absence of DB-level
  foreign keys.
