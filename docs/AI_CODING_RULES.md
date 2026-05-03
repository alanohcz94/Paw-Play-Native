# AI Coding Rules — PawPlay

> **Mandatory reading for any AI coding assistant** (Claude Code, Cursor,
> Replit Agent, Aider, Cody, GitHub Copilot Workspace, etc.) operating on
> this repository, as well as any human developer using one of those tools.
>
> These rules are project policy. Following them is part of the definition
> of "done" for every change. A change is **not complete** until the
> feature overview has been updated **after** the code is done — see
> **Order of work** below.

---

## Order of work (mandatory)

1. **Read this file first** — `docs/AI_CODING_RULES.md` (this file). **Do not**
   skip this step before writing or editing code.
2. **Read** [`docs/APP_FEATURES_AND_SYSTEM_OVERVIEW.md`](./APP_FEATURES_AND_SYSTEM_OVERVIEW.md)
   for product context, the feature you are touching, data model, and business
   rules (see Rule 1).
3. **Implement and test** — make code changes, run the relevant tests and
   checks, and confirm behaviour is correct.
4. **Only then** — **update** `docs/APP_FEATURES_AND_SYSTEM_OVERVIEW.md` and add
   a Changelog entry for any change that affects features, flows, data,
   business logic, or known issues. The overview is updated **last**, not in
   parallel with unverified code.

---

## The Two Core Docs

| File | What it is | When to touch it |
|---|---|---|
| `docs/AI_CODING_RULES.md` (this file) | Process, gate rules, and project policy. | **Read first** before any code change. Update only when project policy changes. |
| [`docs/APP_FEATURES_AND_SYSTEM_OVERVIEW.md`](./APP_FEATURES_AND_SYSTEM_OVERVIEW.md) | The single source of truth for what the app does, how it is structured, and what rules govern its behaviour. | **Read** after this file, before you edit code. **Update only after** implementation is done, tested, and confirmed working. |

---

## The Seven Rules

### 1. Read `AI_CODING_RULES.md`, then `APP_FEATURES_AND_SYSTEM_OVERVIEW.md`, before making changes

**First** read this file (`docs/AI_CODING_RULES.md`).

**Then**, before writing or editing any code, open
`docs/APP_FEATURES_AND_SYSTEM_OVERVIEW.md` and read at minimum:

- **App Overview** — to understand product positioning.
- The relevant **Feature Inventory** entry for the area you are editing.
- The relevant **User Flow** entry.
- The **Database / Data Model Overview** entries for any table you touch.
- The **Business Logic Rules** entries for any rule you might change.
- The **Known Bugs / Risk Areas** entries — so you don't accidentally
  re-introduce a documented bug.

If the area you are editing is not covered by the doc, that is itself a
finding: add a stub entry as part of your change (Rule 6).

### 2. Understand the existing feature, business logic, database structure, and user flow before editing

Do not start editing on the basis of the doc alone. Confirm by reading:

- The actual screen / component file(s) under
  `artifacts/pawplay/app/`, `artifacts/pawplay/components/`, or
  `artifacts/pawplay/hooks/`.
- The actual route handler under `artifacts/api-server/src/routes/`.
- The actual schema under `lib/db/src/schema/`.
- The OpenAPI spec at `lib/api-spec/openapi.yaml`.

If the doc and the code disagree, **the code is the ground truth**. Fix
the doc as part of your change.

### 3. Update `APP_FEATURES_AND_SYSTEM_OVERVIEW.md` only after code is done, tested, and confirmed

Do **not** update the feature overview as a first step, or “in advance” of
untested code. A change is **not done** until the doc reflects it **and** the
code has been implemented and verified (tests, manual checks, or both, as
appropriate for the change). Specifically, when you update the overview:

- New feature → add a new **Feature Inventory** entry using the same
  subheadings as the existing entries (What / Why / User interaction /
  Tech / API / Status).
- Changed behaviour → update the existing Feature Inventory entry, the
  affected **User Flow** entry, and the affected **Business Logic Rules**
  entry.
- New / removed file or component → update **Code Architecture**.
- Schema change → update **Database / Data Model Overview** with the new
  column(s), type(s), and meaning(s).
- API contract change → update the relevant route entry and re-run
  `pnpm --filter @workspace/api-spec run codegen`.
- Bug fix → move the entry from **Known Bugs / Risk Areas** to the
  **Changelog** with a one-line note about the fix.
- Bug discovered → add it to **Known Bugs / Risk Areas**.

### 4. Add a changelog entry for every meaningful change

At the bottom of `APP_FEATURES_AND_SYSTEM_OVERVIEW.md` is a `## Changelog`
section. For every change that is non-trivial (anything beyond a typo or
a comment edit), add an entry under today's date heading
(`### YYYY-MM-DD`) describing:

- **What changed** in plain language.
- **Why** it changed.
- **Which files / tables / endpoints** were affected.
- **Any known bug it fixes** (cross-reference and remove the bug entry).

If a heading for today's date already exists, append your bullets under
it; do not create a duplicate heading.

### 5. Never make assumptions about features without checking the related files

If you don't know how a feature works, **read the code, not your
prior**. Concrete checks before guessing:

- For a route: `rg -n "router\.(get|post|patch|delete)\(\"<path>" artifacts/api-server/src/routes/`.
- For a schema field: `rg -n "<field_name>" lib/db/src/schema/`.
- For a screen: open the file under `artifacts/pawplay/app/`.
- For an API client call: search for the generated hook name in
  `lib/api-client-react/src/`, then trace it back to `openapi.yaml`.
- For a business rule: search `utils/scoring.ts`, `routes/sessions.ts`,
  `hooks/useAchievements.ts`, and the relevant route.

If after reading you are still unsure, write **"Needs verification"** in
the doc — do **not** invent behaviour to fill the gap.

### 6. Clearly document any new files, components, database fields, API changes, or business logic

When you introduce something new:

| You added… | Document it in… |
|---|---|
| A new screen / route file under `app/` | Feature Inventory + User Flows + Code Architecture |
| A new shared component / hook | Code Architecture (and Feature Inventory if it is feature-visible) |
| A new column / table | Database / Data Model Overview |
| A new endpoint | Code Architecture (route map) + the relevant Feature Inventory entry + `lib/api-spec/openapi.yaml` |
| A new bonus / score rule / achievement / level threshold | Business Logic Rules |
| A new permission / privacy guard | Business Logic Rules → "Permissions / Ownership" subsection |
| A new dependency that changes a workflow | Code Architecture |

Names, types, defaults, units, and edge cases all matter. Vague entries
("we added a thing") are not acceptable.

### 7. Keep documentation synchronized with the codebase

The doc and the code must always agree at the time of every commit /
checkpoint. The **order** is: implement and verify code first, then update
`APP_FEATURES_AND_SYSTEM_OVERVIEW.md` (see **Order of work** above).

- If you find drift, fix it as part of whatever change you are making —
  do not leave it for "later".
- If your change is purely documentation, that is fine — commit it.
- If your change is purely code and the doc didn't need updating,
  briefly justify that in the commit message ("no doc change: refactor
  with no behaviour change").
- Never delete a doc entry unless the underlying code or feature was
  actually removed in the same change.

---

## Project-Specific Hard Rules

These come from prior tasks and code review. They are non-negotiable on
this project:

1. **Do not reintroduce the "family" model.** Friendships are mutual,
   per-user, and bidirectional. Dogs are owned by exactly one user. If
   you find yourself adding a `familyId`, stop.
2. **API contract is OpenAPI-first.** Edit `lib/api-spec/openapi.yaml`
   first, then run `pnpm --filter @workspace/api-spec run codegen`.
   Never hand-edit `lib/api-zod/src` or `lib/api-client-react/src`.
3. **Server logging.** Never use `console.log` in server code. Use
   `req.log` in route handlers and the singleton `logger` for
   non-request code.
4. **Ownership and privacy guards.**
   - Dog-scoped reads/writes must call `assertDogOwned(dogId, callerId)`.
   - Cross-user dog access must return **404** ("Dog not found"), never
     403 — no enumeration.
   - `GET /api/users/:userId` returns the full row only for self, the
     minimal projection `{id, displayName, inviteCode}` for direct
     friends, and **403 Forbidden** for anyone else (also no
     enumeration).
   - `GET /api/sessions` must always be force-scoped to `req.user.id` —
     ignore any `userId=` query parameter.
   - Never include `email`, `replit_id`, or `expo_push_token` in any
     response other than the caller's own `pawplay_users` row.
5. **Don't run `pnpm dev` at the repo root.** Use `restart_workflow`
   for the relevant workflow (`artifacts/pawplay: expo`,
   `artifacts/api-server: API Server`, `artifacts/mockup-sandbox:
   Component Preview Server`).
6. **Tests live with the code they test.** Add `*.test.ts` next to the
   route file under `artifacts/api-server/src/routes/` and run with
   `pnpm --filter @workspace/api-server test`.

---

## Quick Workflow Checklist

Use this as a final gate before declaring a change done:

- [ ] I read `docs/AI_CODING_RULES.md` **first** (this file).
- [ ] I read the relevant sections of
      `docs/APP_FEATURES_AND_SYSTEM_OVERVIEW.md` before editing code.
- [ ] I confirmed behaviour by reading the actual code, not just the
      doc.
- [ ] My code change is **implemented, tested, and confirmed working**
      where applicable.
- [ ] **Then** I updated every affected section of
      `APP_FEATURES_AND_SYSTEM_OVERVIEW.md` (Feature Inventory, User
      Flows, Database, Code Architecture, Business Logic, Known Bugs).
- [ ] I added a Changelog entry under today's date describing what,
      why, and which files / tables / endpoints were touched.
- [ ] If I fixed a documented bug, I removed its entry from Known Bugs
      and noted the fix in the Changelog.
- [ ] If I introduced new risk or a known limitation, I added it to
      Known Bugs.
- [ ] If I touched the API contract, I edited
      `lib/api-spec/openapi.yaml` and re-ran codegen.
- [ ] None of the project-specific hard rules above were violated.

---

## Why This Matters

Every AI coding tool that touches this codebase loads context from
scratch. The two docs in `docs/` are how that context survives between
sessions and tools. Letting them drift out of sync with the code makes
every subsequent change slower, less correct, and more likely to
re-introduce bugs that were previously fixed. Treat documentation as a
first-class deliverable, not as paperwork.
