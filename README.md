# PawPlay

PawPlay (also branded **QuickMix**) is a gamified dog-training mobile app
built as a pnpm-workspace monorepo: an Expo (React Native) client, an
Express 5 API server, a PostgreSQL database via Drizzle ORM, and a shared
OpenAPI contract.

---

## Read These Two Files First

Before you (or any AI coding assistant — Claude Code, Cursor, Replit
Agent, Aider, Copilot Workspace, etc.) make any change to this
repository, read these in order:

1. **[`docs/APP_FEATURES_AND_SYSTEM_OVERVIEW.md`](docs/APP_FEATURES_AND_SYSTEM_OVERVIEW.md)**
   — the single source of truth for what the app does, how it is
   structured, what rules govern its behaviour, and what is currently
   known to be broken.
2. **[`docs/AI_CODING_RULES.md`](docs/AI_CODING_RULES.md)** — project
   policy for how to make changes here, including the rule that **every
   meaningful code change must also update the overview file and add a
   Changelog entry**.

These two files are mandatory context. A change is not "done" until both
the code and `APP_FEATURES_AND_SYSTEM_OVERVIEW.md` reflect the new
state.

---

## Repository Layout

```
artifacts/
  api-server/        Express 5 backend (mounted at /api)
  pawplay/           Expo (React Native) mobile + web app
  mockup-sandbox/    Vite preview server for canvas mockups (design tooling)
lib/
  api-spec/          OpenAPI 3.1 spec — single source of truth for the API
  api-zod/           Zod schemas (generated from openapi.yaml)
  api-client-react/  React Query hooks (generated from openapi.yaml)
  db/                Drizzle ORM schemas + db client
scripts/             Repo-level utility scripts
docs/                Project documentation (read these first)
```

For deeper detail on monorepo conventions, TypeScript setup, and
artifact lifecycle, see the `pnpm-workspace` skill and the entries in
`docs/APP_FEATURES_AND_SYSTEM_OVERVIEW.md` → **Code Architecture**.

---

## Common Commands

- `pnpm run typecheck` — full typecheck across all packages.
- `pnpm run test` — run every package's test script.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks
  and Zod schemas from `lib/api-spec/openapi.yaml`.
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev
  only).
- `pnpm --filter @workspace/api-server test` — run server tests.

Apps run via Replit workflows (`artifacts/pawplay: expo`,
`artifacts/api-server: API Server`, `artifacts/mockup-sandbox: Component
Preview Server`), not via root-level `pnpm dev`.

---

## License

Proprietary. All rights reserved.
