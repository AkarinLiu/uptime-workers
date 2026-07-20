import { verifySession } from "../auth";

interface Monitor {
  id: number;
  slug: string;
  name: string;
  url: string;
  interval_seconds: number;
  retention_days: number;
  enabled: number;
  last_status_code: number | null;
  last_response_time_ms: number | null;
  last_error: string | null;
  last_checked_at: string | null;
  created_at: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function requireAuth(request: Request, db: D1Database): Promise<Response | null> {
  const session = await verifySession(request, db);
  if (!session) return json({ error: "Unauthorized" }, 401);
  if (session.role !== "admin") return json({ error: "Admin access required" }, 403);
  return null;
}

async function getSlugByNameAndId(
  db: D1Database,
  name: string,
  id?: number
): Promise<{ slug: string; ok: boolean }> {
  let slug = slugify(name);
  const result = await db
    .prepare("SELECT id FROM monitors WHERE slug = ? AND id != ?")
    .bind(slug, id ?? -1)
    .first<{ id: number }>();
  if (result) {
    slug = `${slug}-${Date.now()}`;
  }
  return { slug, ok: true };
}

export async function handleMonitors(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const db = env.DB;

  const authErr = await requireAuth(request, db);
  if (authErr) return authErr;

  const match = url.pathname.match(/^\/api\/monitors(?:\/(\d+))?$/);
  if (!match) return json({ error: "Not found" }, 404);

  const id = match[1] ? parseInt(match[1]) : null;

  if (request.method === "GET") {
    if (id) {
      const monitor = await db
        .prepare("SELECT * FROM monitors WHERE id = ?")
        .bind(id)
        .first<Monitor>();
      if (!monitor) return json({ error: "Not found" }, 404);
      return json(monitor);
    }
    const monitors = await db
      .prepare("SELECT * FROM monitors ORDER BY created_at DESC")
      .all<Monitor>();
    return json(monitors.results);
  }

  if (request.method === "POST" && !id) {
    const body = await request.json<{
      name: string;
      url: string;
      interval_seconds?: number;
      retention_days?: number;
    }>();
    if (!body.name || !body.url) {
      return json({ error: "name and url are required" }, 400);
    }
    const { slug } = await getSlugByNameAndId(db, body.name);
    const result = await db
      .prepare(
        "INSERT INTO monitors (slug, name, url, interval_seconds, retention_days) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(
        slug,
        body.name,
        body.url,
        body.interval_seconds ?? 60,
        body.retention_days ?? 30
      )
      .run();
    const monitor = await db
      .prepare("SELECT * FROM monitors WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first<Monitor>();
    return json(monitor, 201);
  }

  if (request.method === "PUT" && id) {
    const existing = await db
      .prepare("SELECT * FROM monitors WHERE id = ?")
      .bind(id)
      .first<Monitor>();
    if (!existing) return json({ error: "Not found" }, 404);

    const body = await request.json<{
      name?: string;
      url?: string;
      interval_seconds?: number;
      retention_days?: number;
      enabled?: number;
    }>();

    const name = body.name ?? existing.name;
    let slug = existing.slug;
    if (body.name && body.name !== existing.name) {
      const s = await getSlugByNameAndId(db, body.name, id);
      slug = s.slug;
    }

    await db
      .prepare(
        `UPDATE monitors SET slug=?, name=?, url=?, interval_seconds=?, retention_days=?, enabled=? WHERE id=?`
      )
      .bind(
        slug,
        name,
        body.url ?? existing.url,
        body.interval_seconds ?? existing.interval_seconds,
        body.retention_days ?? existing.retention_days,
        body.enabled ?? existing.enabled,
        id
      )
      .run();

    const monitor = await db
      .prepare("SELECT * FROM monitors WHERE id = ?")
      .bind(id)
      .first<Monitor>();
    return json(monitor);
  }

  if (request.method === "DELETE" && id) {
    await db.prepare("DELETE FROM checks WHERE monitor_id = ?").bind(id).run();
    await db.prepare("DELETE FROM monitors WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}

export async function handleChecks(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const db = env.DB;

  const authErr = await requireAuth(request, db);
  if (authErr) return authErr;

  const monitorId = url.searchParams.get("monitor_id");
  if (!monitorId) return json({ error: "monitor_id required" }, 400);

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);

  const checks = await db.prepare(
    "SELECT * FROM checks WHERE monitor_id = ? ORDER BY created_at DESC LIMIT ?"
  )
    .bind(parseInt(monitorId), limit)
    .all();

  const uptime = await db.prepare(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN error IS NULL AND status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) as up
    FROM checks WHERE monitor_id = ?`
  )
    .bind(parseInt(monitorId))
    .first<{ total: number; up: number }>();

  return json({
    checks: checks.results,
    uptime_pct: uptime && uptime.total > 0 ? Math.round((uptime.up / uptime.total) * 10000) / 100 : null,
  });
}
