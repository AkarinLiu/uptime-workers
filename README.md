# uptime-workers

Uptime monitoring service running on Cloudflare Workers + D1.

## Setup

```sh
npm install
npx wrangler d1 create uptime-db           # create D1 database
npx wrangler d1 execute uptime-db --local  # or --remote for production
```

Update `database_id` in `wrangler.jsonc` after creating the D1 database.

## Commands

```sh
npm run dev        # Vite dev server with local Worker binding emulation
npm run build      # type-check then production build
npm run type-check # vue-tsc --build (no emit)
npm run preview    # build + wrangler dev (local Worker runtime)
npm run deploy     # build + wrangler deploy
```

## Architecture

Single Cloudflare Worker serving a Vue 3 SPA and JSON API. Cron trigger every minute runs uptime checks against all enabled monitors and stores results in D1.

## Environment

- `DB` — D1 database binding (`uptime-db`)
- `ADMIN_TOKEN` — worker variable (change in production)
