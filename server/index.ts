import { initDb } from "./db";
import { handleMonitors, handleChecks } from "./api/monitors";
import { handleStatus } from "./api/status";
import { handleAuth } from "./api/auth";
import { handleAnnouncements } from "./api/announcements";
import { runChecks } from "./cron";

let dbInit: Promise<void> | null = null;

function ensureDb(env: Env): Promise<void> {
  if (!dbInit) {
    dbInit = initDb(env.DB).catch((e) => { dbInit = null; throw e; });
  }
  return dbInit;
}

export default {
  async fetch(request, env) {
    await ensureDb(env);
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth")) {
      return handleAuth(request, env);
    }

    if (url.pathname.startsWith("/api/status")) {
      return handleStatus(request, env);
    }

    if (url.pathname.startsWith("/api/announcements")) {
      return handleAnnouncements(request, env);
    }

    if (url.pathname.startsWith("/api/monitors")) {
      return handleMonitors(request, env);
    }

    if (url.pathname === "/api/checks") {
      return handleChecks(request, env);
    }

    return new Response(null, { status: 404 });
  },

  async scheduled(_controller, env, ctx) {
    await ensureDb(env);
    ctx.waitUntil(runChecks(env));
  },
} satisfies ExportedHandler<Env>;
