# Paw Play Native — Project Documentation

## Overview

**Paw Play** is a gamified dog training app built for families. It combines evidence-based operant conditioning methods with game mechanics (points, streaks, achievements, leaderboards) to make dog training measurable, consistent, and fun. The app supports multiple dogs within a family unit, enabling collaborative training with real-time progress sharing.

---

## Tech Stack

### Frontend (React Native / Expo)
| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 + Expo 54 |
| Navigation | Expo Router (file-based, Next.js-style) |
| Language | TypeScript 5.9 |
| State | React Context + AsyncStorage |
| Server State | TanStack React Query |
| Animations | React Native Reanimated 4.1 |
| Auth | Expo Auth Session (OIDC) |
| Secure Storage | Expo Secure Store |
| Fonts | FredokaOne, Nunito |

### Backend (Node.js / Express)
| Layer | Technology |
|---|---|
| Server | Express.js 5.x |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Auth | Replit OIDC |
| Logging | Pino |

### Monorepo Packages
- `@workspace/api-client-react` — Typed React API client
- `@workspace/db` — Database schema and queries
- `@workspace/api-zod` — Zod validation schemas
- `@workspace/api-spec` — OpenAPI specification

---

## Application Screens

| Screen | File | Purpose |
|---|---|---|
| Welcome | `index.tsx` | Landing page, sign-in, demo CTA |
| Demo | `demo.tsx` | Interactive demo without login |
| Onboarding | `onboarding.tsx` | Multi-step new user setup |
| Dashboard | `(tabs)/index.tsx` | Home — streak, stats, activity, leaderboard |
| Games | `(tabs)/games.tsx` | Mode selection (Quick Bites / Training) |
| Profile | `(tabs)/profile.tsx` | Command library, mastery levels, achievements |
| Settings | `(tabs)/settings.tsx` | Sound, reminders, family invite code, logout |
| Challenge Setup | `challenge-setup.tsx` | Quick Bites difficulty + sequence config |
| Challenge Active | `challenge-active.tsx` | Live Quick Bites session |
| Challenge End | `challenge-end.tsx` | Score, bonuses, achievements |
| Training Config | `training-config.tsx` | Traditional training session setup |
| Training Active | `training-active.tsx` | Rep-by-rep guided training |
| Calendar | `calendar.tsx` | Monthly training history |
| Yearly Chart | `yearly-chart.tsx` | Annual activity bar chart |
| Achievements | `achievements.tsx` | Achievement gallery |
| Add Dog | `add-dog.tsx` | Register a new dog |

---

## Navigation Flow

```
Welcome (index)
├── Demo (no auth required)
├── OIDC Login → Auth callback
└── Onboarding (new user)
    ├── Step 1: Register dog
    ├── Step 2: Select initial commands
    ├── Step 3: Join or create family
    └── Step 4: Complete → Main Tabs

Main Tabs (requires auth + onboarding)
├── Dashboard
│   ├── → Calendar (training history)
│   └── → Challenge Setup (Quick Bites)
├── Games
│   ├── → Challenge Setup (Quick Bites)
│   └── → Training Config (Traditional)
├── Profile (commands + achievements)
└── Settings
    ├── → Yearly Chart
    └── Logout

Challenge Flow:
  Challenge Setup → Challenge Active → Challenge End → Dashboard

Training Flow:
  Training Config → Training Active → Dashboard

Dog Management:
  Any Tab (+) → Add Dog → Dashboard
```

---

## Feature Workflows

### 1. Authentication Workflow

**Process:**
1. User opens app → Welcome screen renders
2. User taps **Sign In** → `expo-auth-session` initiates OIDC flow (Replit OIDC provider)
3. Browser opens → User authenticates with Replit credentials
4. Auth code returned to app via redirect URI
5. App POSTs code to `/api/mobile-auth/token-exchange`
6. Backend exchanges code, returns session token
7. Token stored in `expo-secure-store` (encrypted, key: `AUTH_TOKEN_KEY`)
8. App GETs `/api/auth/user` to fetch user profile
9. **Branch:** User has `familyId` → navigate to `(tabs)`; User is new → navigate to `onboarding`

**Test Cases:**
- Valid OIDC login → user lands on dashboard
- New user (no familyId) → redirected to onboarding after login
- Invalid/expired token → app falls back to welcome screen
- Network error during token exchange → alert shown, stays on welcome
- User taps "Try Demo" → demo screen loads without auth

**Behaviours:**
- Token persists across app restarts via Secure Store
- On app launch, auth is restored silently if token is valid
- Logout clears token from Secure Store and calls `/api/mobile-auth/logout`

---

### 2. Onboarding Workflow

**Process:**
1. **Step 1 — Dog Setup:** User enters dog's name → POST `/api/dogs` → dog created
2. **Step 2 — Commands:** User selects from pre-defined command list → POST `/api/dogs/{dogId}/commands`
3. **Step 3 — Family:** User can join an existing family (enter invite code → POST `/api/family/join/{code}`) OR skip to create a new family (POST `/api/family`)
4. **Step 4 — Complete:** AppContext hydrated, navigate to `(tabs)`

**Test Cases:**
- Complete all 4 steps → user lands on dashboard with dog and commands ready
- Skip family step → new family auto-created
- Invalid invite code → error message shown, user can retry
- Dog name left empty → validation prevents progression
- Returning user who completed onboarding → onboarding skipped automatically

**Behaviours:**
- Onboarding state is persisted locally (`onboardingComplete: true`)
- Cannot re-enter onboarding once completed
- Dog creation must succeed before command selection step is shown

---

### 3. Quick Bites (Challenge) Workflow

**Process:**
1. **Setup:** User selects difficulty (Easy / Medium / Expert), random command sequence is generated
2. Each command in sequence is assigned a hold duration and comply window based on difficulty
3. **Active Session — per command:**
   - Command name displayed prominently
   - Countdown timer starts (window duration per difficulty)
   - User signals dog to perform command
   - User taps **Comply** when dog responds (stops timer, records time)
   - **Hold phase:** User holds **Hold** button while dog maintains position
   - Success recorded if comply within window; failure if window exceeded
4. Sequence continues until all commands completed
5. **End:** Score calculated, session POSTed to `/api/sessions`, achievements checked

**Difficulty Settings:**
| Difficulty | Comply Window | Commands | Bonus Points |
|---|---|---|---|
| Easy | 6 seconds | 5 | None |
| Medium | 4 seconds | 6–7 | +10 |
| Expert | 2 seconds | 6–8 | +25 |

**Scoring Calculation:**
```
Base: 20 pts per successful command
Penalty: -1 pt per second over window
Expert skip penalty: -20 pts per skip

Bonuses:
- Perfect Round (all within window, 5+ cmds): +20
- Speed Demon (all under half window): +5 × count
- Combo Streak (3+ consecutive success): +50% of streak base
- Clean Sweep (no skips): +10
- First Cue (no resets): +3 × count (max 15)
- Difficulty bonus: Medium +10, Expert +25

Total bonus capped at +50
Final = rawScore + min(totalBonus, 50)
```

**Test Cases:**
- Complete all commands within window → full score + Perfect Round bonus
- All commands under half window → Speed Demon bonus awarded
- Skip a command on Expert → -20 pts penalty applied
- Session saved correctly with commandsUsed array
- Achievement unlocked on first session → banner animation shown
- Replay button → returns to challenge-setup with same difficulty pre-selected

**Behaviours:**
- Haptic feedback on Comply and Hold button taps
- Timer bar animates smoothly (Reanimated)
- Window exceeded triggers visual warning (colour change)
- Sound plays on success/failure if sound is enabled
- Achievement banners animate on unlock (spring animation)

---

### 4. Traditional Training Workflow

**Process:**
1. **Config:** User selects command, reward type (Treats / Play / Praise), variable schedule toggle, rep count, marker cue, release cue
2. **Active Session — per rep:**
   - 3-2-1 countdown displayed
   - **Marker phase:** Marker cue shown (e.g., "Yes!")
   - **Reward decision:** If variable schedule ON → random determination whether treat is given
   - **Release phase:** Release cue shown (e.g., "Free!")
   - Inter-trial countdown before next rep
3. All reps complete → session saved (fixed 120s duration), navigate to dashboard

**Variable Reward Schedule:**
- Implements variable ratio reinforcement (behaviour science)
- Randomly withholds reward ~30% of reps when enabled
- Builds stronger, more durable trained behaviours

**Test Cases:**
- 5 reps completed → trainingSessionsCount incremented on command
- Variable schedule OFF → reward shown every rep
- Variable schedule ON → reward withheld on some reps (random)
- Custom marker cue (e.g., "Clicker") → displayed correctly
- Custom release cue (e.g., "Break") → displayed correctly
- Session save failure → error alert, user remains on results

**Behaviours:**
- Rep counter visible throughout session
- Randomised reward messages keep engagement high
- Each rep phase has distinct visual/audio cues
- Session duration is fixed at 120 seconds for scoring consistency

---

### 5. Command Mastery Workflow

**Process:**
- Commands progress through 3 levels based on usage metrics
- Levels updated server-side on each session save

**Mastery Levels:**
| Level | Label | Criteria |
|---|---|---|
| 1 | Added | Fewer than 5 training sessions |
| 2 | Learning | ≥5 training sessions |
| 3 | Reliable | ≥10 QB successes AND ≥3 QB sessions with at least one success |

**Test Cases:**
- New command starts at Level 1 (Added)
- After 5 training sessions → promotes to Level 2 (Learning)
- After 10 QB successes across 3+ QB sessions → promotes to Level 3 (Reliable)
- Level displayed correctly in Profile screen command list
- Obedience game mode unlocks when 7+ commands reach Level 3

**Behaviours:**
- Level promotion happens server-side on session save
- Frontend reflects updated level after AppContext refresh
- Level 3 commands contribute to `reliable_handler` and `full_pack` achievements

---

### 6. Achievement Workflow

**Process:**
1. Session completes (challenge or training)
2. Frontend evaluates all achievement conditions against current AppContext state
3. Newly unlocked achievements (not in `seenAchievements`) trigger banner animation
4. Achievements marked as seen, stored in AppContext (`seenAchievements` array)
5. Not shown again for the same dog

**Achievement Catalogue:**
| ID | Name | Unlock Condition |
|---|---|---|
| first_session | First Session | Any session logged |
| streak_7 | 7-Day Streak | 7 consecutive training days |
| streak_30 | Month of Training | 30 consecutive training days |
| reliable_handler | Reliable Handler | 1+ Level 3 command |
| full_pack | Full Pack | 7+ Level 3 commands |
| amazing_student | Amazing Student | 100+ reps on any command |
| distinction_student | Distinction Student | 100+ reps on all 7 basic commands |
| perfect_round | Perfect Round | Earn Perfect Round bonus in Quick Bites |
| speed_demon | Speed Demon | Earn Speed Demon bonus in Quick Bites |
| family_champion | Family Champion | Top of family leaderboard |
| month_pawfect | Month Pawfect | Train every day in a calendar month |

**Test Cases:**
- First session ever → `first_session` achievement unlocked and banner shown
- Achievement already unlocked → not shown again on next session
- Multiple achievements unlocked in same session → all banners shown in sequence
- `full_pack` not awarded until exactly 7 commands reach Level 3
- Achievement gallery shows locked/unlocked state for all achievements

**Behaviours:**
- Banner uses spring animation for entrance/exit
- Sound plays on achievement unlock (if sound enabled)
- `seenAchievements` persisted to AsyncStorage per dog

---

### 7. Streak Workflow

**Process:**
1. User completes any training session
2. AppContext checks `lastTrainedDate` against today's date
3. If trained yesterday → streak incremented
4. If trained today already → streak unchanged
5. If gap > 1 day → streak resets to 1
6. `lastTrainedDate` updated to today

**Test Cases:**
- Train on day 1, skip day 2, train day 3 → streak resets to 1
- Train consecutive days → streak increments correctly
- Multiple sessions in one day → streak counts only once
- Streak display updates immediately after session save

**Behaviours:**
- Streak is per-dog (each dog tracks independently)
- Streak displayed prominently on Dashboard
- Streak value feeds into `streak_7` and `streak_30` achievement checks

---

### 8. Family & Leaderboard Workflow

**Process:**
1. Family created during onboarding (or joined via invite code)
2. Each session's `participationPoints` accumulate to user's total
3. Dashboard fetches `/api/family/{familyId}/leaderboard` on load
4. Leaderboard ranks all family members by total participation points

**Invite Code Flow:**
1. Family invite code (6 chars) shown in Settings
2. User can copy to clipboard or share via system share sheet
3. New user enters code in onboarding → POST `/api/family/join/{code}` → added to family

**Test Cases:**
- Two users join same family → both appear on leaderboard
- User with most points ranked #1
- Sharing invite code → system share sheet opens with code
- Invalid invite code → error message shown
- Leaderboard refreshes after each session save

**Behaviours:**
- Family leaderboard visible on Dashboard without navigating away
- Crown badge displayed next to top-ranked member
- Points update reflected on next dashboard load

---

### 9. Calendar & History Workflow

**Process:**
1. User navigates to Calendar from Dashboard
2. Current month loaded → GET `/api/family/{familyId}/calendar?month={m}&year={y}`
3. Days with training highlighted (own sessions vs family sessions shown differently)
4. User taps a day → GET `/api/sessions?dogId={id}&date={YYYY-MM-DD}`
5. Session list shown for selected day (mode, score, commands used)
6. Previous/Next month navigation available

**Test Cases:**
- Day with sessions → highlighted on calendar
- Day without sessions → no highlight
- Tapping highlighted day → session list appears
- Navigating to previous month → calendar re-fetches for that month
- Stats (total sessions, hours, avg score) update to reflect selected month

**Behaviours:**
- Own training days and family training days shown with distinct indicators
- Month stats shown at top of calendar view
- Yearly chart accessible from Settings showing monthly training hours

---

### 10. Dog Management Workflow

**Process:**
1. User taps `+` in DogPicker (Dashboard or any tab)
2. Multi-step Add Dog wizard:
   - Enter dog name
   - Select commands to start with (populated from known commands)
3. POST `/api/dogs` → dog created
4. POST `/api/dogs/{dogId}/commands` → commands added
5. New dog appears in DogPicker; user can switch active dog

**Active Dog Switching:**
1. User taps different dog in DogPicker
2. `activeDogId` updated in AppContext
3. Commands, streak, achievements all reload for selected dog
4. All subsequent sessions logged against active dog

**Test Cases:**
- Add new dog → appears in DogPicker immediately
- Switch active dog → dashboard stats update to that dog's data
- Dog with no commands → empty Profile screen with add prompt
- Dog name validation → empty name prevented

**Behaviours:**
- Dog picker is a horizontal scroll of avatar circles
- Active dog highlighted with border or indicator
- Each dog's data is fully isolated (commands, sessions, achievements, streak)

---

## Data Models

### families
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| createdBy | string | userId of creator |
| inviteCode | string(6) | Unique invite code |
| memberIds | jsonb | Array of user IDs |
| createdAt | timestamp | |

### pawplay_users
| Field | Type | Notes |
|---|---|---|
| id | string | Auth user ID |
| replitId | string | Replit identity |
| displayName | string | |
| email | string | |
| familyId | uuid | FK → families (nullable) |
| role | string | Default: "adult" |
| expoPushToken | string | For push notifications |
| createdAt | timestamp | |

### dogs
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| familyId | uuid | FK → families |
| name | string | |
| age | real | Nullable |
| breed | string | Nullable |
| avatarUrl | string | Nullable |
| releaseCue | string | Default: "Free" |
| markerCue | string | Default: "Yes" |
| level | int | Default: 1 |
| xp | int | Default: 0 |
| createdAt | timestamp | |

### commands
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| dogId | uuid | FK → dogs |
| name | string | |
| level | int | 1–3 mastery level |
| trainingSessionsCount | int | Total training sessions |
| qbSuccessesCount | int | Quick Bites successes |
| qbSessionsWithSuccess | int | QB sessions with ≥1 success |
| lastUsedAt | timestamp | Nullable |
| addedAt | timestamp | |

### sessions_record
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| dogId | uuid | FK → dogs |
| userId | string | FK → users |
| mode | enum | "quickbites" / "training" |
| difficulty | enum | "easy" / "medium" / "expert" (nullable) |
| rawScore | int | Score before bonuses |
| participationPoints | int | Points for leaderboard |
| bonuses | jsonb | Array of `{name, label, points}` |
| commandsUsed | jsonb | Array of command result objects |
| durationSeconds | int | Session duration |
| completed | boolean | Whether session was completed |
| createdAt | timestamp | |

### achievements
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| dogId | uuid | FK → dogs |
| userId | string | FK → users (nullable) |
| type | string | Achievement identifier |
| metadata | jsonb | Extra data |
| earnedAt | timestamp | |

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/auth/user` | Get current authenticated user |
| POST | `/api/mobile-auth/token-exchange` | Exchange OIDC code for session token |
| POST | `/api/mobile-auth/logout` | Logout, invalidate token |

### Dogs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/family/:familyId/dogs` | List all dogs in family |
| POST | `/api/dogs` | Create a new dog |
| PATCH | `/api/dogs/:dogId` | Update dog details |

### Commands
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dogs/:dogId/commands` | Get commands for a dog |
| POST | `/api/dogs/:dogId/commands` | Add commands to a dog |

### Sessions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sessions` | Log a training session |
| GET | `/api/sessions?dogId=X&limit=50` | Recent sessions |
| GET | `/api/sessions?dogId=X&date=YYYY-MM-DD` | Sessions for a specific day |

### Family
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/family` | Create a new family |
| POST | `/api/family/join/:code` | Join a family via invite code |
| GET | `/api/family/:familyId/leaderboard` | Family leaderboard |
| GET | `/api/family/:familyId/calendar` | Monthly calendar data |
| GET | `/api/family/:familyId/yearly-chart` | Yearly activity chart data |

---

## State Management

### AppContext (Persistent)
Stored to `AsyncStorage` under key `pawplay_app_state`. Hydrated on app launch.

Key state fields:
- `dogs` — all dogs for the user's family
- `activeDogId` — currently selected dog
- `commands` — commands for the active dog
- `familyId` / `inviteCode` — family membership
- `streak` / `lastTrainedDate` — per-dog streak tracking
- `seenAchievements` — which achievement banners have been shown
- `soundEnabled` / `reminderTime` — user preferences
- `onboardingComplete` — prevents re-entry to onboarding

### AuthContext (Session)
- `user` — authenticated user object
- `isAuthenticated` — boolean
- Token stored in `expo-secure-store` (not in AsyncStorage)

---

## External Integrations

| Service | Purpose |
|---|---|
| Replit OIDC | User authentication and identity |
| PostgreSQL | All persistent data storage |
| Expo Secure Store | Encrypted local token storage |
| AsyncStorage | Local app state persistence |
| Expo Push Notifications | Push token storage (infrastructure ready) |
| System Share Sheet | Share invite codes natively |

---

## Key Design Principles

1. **Science-backed training** — Variable reward schedules, marker training, and rep-based sessions follow operant conditioning principles
2. **Gamification** — Points, streaks, achievements and leaderboards sustain motivation
3. **Family-first** — All data is scoped to a family unit enabling shared progress
4. **Per-dog isolation** — Each dog has completely independent data, sessions, and progress
5. **Offline-first friendly** — Local state persists to AsyncStorage, reducing reliance on connectivity for reading data
6. **Progressive mastery** — Command levels provide a clear measurable progression path
