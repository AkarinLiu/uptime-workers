# Agency Instructions

## Architecture

- Cloudflare Worker monolith serving the API; the Vue 3 SPA is served by the `assets` binding (`not_found_handling: "single-page-application"`), not by the Worker itself.
- Entry: `server/index.ts` — `fetch` dispatches `/api/*` by path prefix and returns 404 for anything else; `scheduled` (cron) runs `runChecks()`.
- Frontend entry: `src/main.ts` → Vue 3 + Vue Router (`src/router/index.ts`).
- SPA routes: `/status`, `/status/:slug`, `/login`, `/admin`, `/admin/monitors/:id` (`/admin*` guarded by `requiresAuth` + admin role).
- API routes: `/api/auth/*`, `/api/status/*`, `/api/announcements/*`, `/api/users/*`, `/api/settings/*`, `/api/monitors/*`, `/api/checks`, `/api/checks/stats`, `/api/checks/purge`.

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

- `DB` (D1Database) — database named `uptime-db`. Schema auto-created on first request via `initDb()`, memoized by a module-level promise in `server/index.ts`.
- `ADMIN_TOKEN` — declared in wrangler.jsonc but unused; auth is session-based. Safe to remove (then re-run `cf-typegen`).
- Cron runs every minute (`* * * * *`); `runChecks()` skips a monitor until it is due per the global `settings.interval_seconds`.
- Compatibility flag: `nodejs_compat`.

## TypeScript

- 3-project solution: `tsconfig.app.json` (Vue frontend), `tsconfig.node.json` (Vite/Wrangler config), `tsconfig.worker.json` (server code, extends tsconfig.node.json).
- Path alias `@/` → `src/` (only in `tsconfig.app.json`; server code must use relative imports).
- `worker-configuration.d.ts` is generated — run `npm run cf-typegen` after changing wrangler.jsonc bindings.
- `noUncheckedIndexedAccess: true` (only for app code).

## Auth Model

- PBKDF2 (100k iterations, SHA-256) password hashing via Web Crypto in `server/auth.ts`.
- Bearer token sessions in the `sessions` table.
- Registration (`POST /api/auth/register`) is open only while `users` is empty; the first user becomes admin. After that, admins provision users via `/api/users`.
- `users.role` is `"admin"` or `"user"`; admin-only guards check `role === "admin"` (`requireAuth()` in `server/api/monitors.ts`, inline in `settings.ts` / `users.ts`).
- Self-service password change: `PUT /api/auth/password`.

## Database

- D1 (SQLite). Tables: `users`, `sessions`, `monitors`, `checks`, `announcements`, `settings`.
- `initDb()` runs `CREATE TABLE IF NOT EXISTS` plus best-effort `ALTER TABLE ... ADD COLUMN` in try/catch — no migration framework.
- `monitors` supports `type` `"http"` | `"tcp"`; per-monitor `webhook_url` / `notify_enabled` / `notify_on_4xx` columns exist, but `cron.ts` currently reads the global `settings.webhook_url` for delivery.
- `settings` is a key/value table: `interval_seconds`, `retention_days`, `webhook_url` (global defaults), managed via `/api/settings`.
- Checks older than `retention_days` are purged per monitor by the cron job; `/api/checks/purge` forces it manually.

## Checks

- `http` monitors: `fetch` with a 15s timeout. `tcp` monitors: `cloudflare:sockets` connect to `host:port`.
- `GET /api/checks?range=1h|6h|24h|7d|30d` uses `server/range.ts` to bucket long ranges into hourly/daily averages; shorter ranges return raw checks (capped at 2000).

## No Test Suite

- No test framework or test files present. If adding tests, use Vitest since Vite config already references it.
