# Agency Instructions

## Architecture

- Cloudflare Worker monolith serving both API and Vue 3 SPA assets.
- Entry: `server/index.ts` — handles `fetch` (API + SPA fallback) and `scheduled` (cron).
- Frontend entry: `src/main.ts` → Vue 3 + Vue Router (`src/router/index.ts`).
- SPA routes: `/status`, `/status/:slug`, `/login`, `/admin`, `/admin/monitors/:id`.
- API routes: `/api/auth/*`, `/api/status/*`, `/api/announcements/*`, `/api/monitors/*`, `/api/checks`.

## Commands

```sh
npm run dev          # Vite dev server (uses @cloudflare/vite-plugin for Worker binding emulation)
npm run build        # type-check then vite build (order matters; sequential via run-p "build-only {@}" --)
npm run type-check   # vue-tsc --build (project references: tsconfig.app.json + tsconfig.node.json + tsconfig.worker.json)
npm run preview      # build then wrangler dev
npm run deploy       # build then wrangler deploy
npm run cf-typegen   # wrangler types → regenerates worker-configuration.d.ts
```

## Bindings & Environment

- `DB` (D1Database) — database named `uptime-db`. Schema auto-created on first request via `initDb()`.
- `ADMIN_TOKEN` — worker `vars`, default `"dev-token-change-me-in-production"`.
- Cron runs every minute (`* * * * *`), triggering `runChecks()`.
- Compatibility flag: `nodejs_compat`.

## TypeScript

- 3-project solution: `tsconfig.app.json` (Vue frontend), `tsconfig.node.json` (Vite/Wrangler config), `tsconfig.worker.json` (server code, extends tsconfig.node.json).
- Path alias `@/` → `src/` (only in `tsconfig.app.json`; server code must use relative imports).
- `worker-configuration.d.ts` is generated — run `npm run cf-typegen` after changing wrangler.jsonc bindings.
- `noUncheckedIndexedAccess: true` (only for app code).

## Auth Model

- PBKDF2 password hashing via Web Crypto runtime API.
- Bearer token sessions in `sessions` table.
- Registration is open only while `users` table is empty (first user becomes admin). After that, manual admin provisioning only.
- Admin-only guard: `requireAuth()` in `server/api/monitors.ts` checks role === `"admin"`.

## Database

- D1 (SQLite). Tables: `users`, `sessions`, `monitors`, `checks`, `announcements`.
- Migrations run in `initDb()` as `CREATE TABLE IF NOT EXISTS` — no migration framework.
- Checks older than each monitor's `retention_days` are purged by the cron job.

## No Test Suite

- No test framework or test files present. If adding tests, use Vitest since Vite config already references it.
