import { verifySession } from "../auth";

interface Monitor {
  id: number;
  slug: string;
  name: string;
  type: string;
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
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) slug = `monitor-${Date.now()}`;
  return slug;
}

async function requireAuth(request: Request, db: D1Database): Promise<Response | null> {
  const session = await verifySession(request, db);
  if (!session) return json({ error: "Unauthorized" }, 401);
  if (session.role !== "admin") return json({ error: "Admin access required" }, 403);
  return null;
}

async function resolveSlug(db: D1Database, name: string, customSlug?: string, currentId?: number): Promise<string | null> {
  let slug = customSlug ?? slugify(name);
  if (!slug) return null;
  slug = slug.replace(/[^a-z0-9\u4e00-\u9fff-]/g, "-").replace(/^-|-$/g, "");
  if (!slug) return null;
  const existing = await db
    .prepare("SELECT id FROM monitors WHERE slug = ? AND id != ?")
    .bind(slug, currentId ?? -1)
    .first<{ id: number }>();
  if (existing) {
    if (customSlug) return null;
    slug = `${slug}-${Date.now()}`;
  }
  return slug;
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
      type?: string;
      slug?: string;
      interval_seconds?: number;
      retention_days?: number;
    }>();
    if (!body.name || !body.url) return json({ error: "name and url are required" }, 400);

    const type = body.type ?? "http";
    if (!["http", "tcp"].includes(type)) return json({ error: "type must be http or tcp" }, 400);

    if (type === "tcp") {
      const i = body.url.lastIndexOf(":");
      if (i === -1 || i === 0 || i === body.url.length - 1)
        return json({ error: "url must be host:port for tcp monitors" }, 400);
    }

    const slug = await resolveSlug(db, body.name, body.slug);
    if (!slug) return json({ error: "slug invalid or already taken" }, 400);

    const result = await db
      .prepare("INSERT INTO monitors (slug, name, type, url, interval_seconds, retention_days) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(slug, body.name, type, body.url, body.interval_seconds ?? 60, body.retention_days ?? 30)
      .run();
    const monitor = await db
      .prepare("SELECT * FROM monitors WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first<Monitor>();
    return json(monitor, 201);
  }

  if (request.method === "PUT" && id) {
    const existing = await db.prepare("SELECT * FROM monitors WHERE id = ?").bind(id).first<Monitor>();
    if (!existing) return json({ error: "Not found" }, 404);

    const body = await request.json<{
      name?: string; url?: string; type?: string; slug?: string;
      interval_seconds?: number; retention_days?: number;
      enabled?: number;
    }>();

    const name = body.name ?? existing.name;
    const type = body.type ?? existing.type;
    const urlVal = body.url ?? existing.url;

    if (type && !["http", "tcp"].includes(type)) return json({ error: "type must be http or tcp" }, 400);

    if (type === "tcp") {
      const i = urlVal.lastIndexOf(":");
      if (i === -1 || i === 0 || i === urlVal.length - 1)
        return json({ error: "url must be host:port for tcp monitors" }, 400);
    }
    let slug = existing.slug;
    if (body.slug !== undefined || (body.name && body.name !== existing.name)) {
      const resolved = await resolveSlug(db, name, body.slug, id);
      if (!resolved) return json({ error: "slug invalid or already taken" }, 400);
      slug = resolved;
    }

    await db
      .prepare("UPDATE monitors SET slug=?, name=?, type=?, url=?, interval_seconds=?, retention_days=?, enabled=? WHERE id=?")
      .bind(slug, name, type, urlVal, body.interval_seconds ?? existing.interval_seconds, body.retention_days ?? existing.retention_days, body.enabled ?? existing.enabled, id)
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

const RANGE_MAP: Record<string, string> = {
  "1h": "-1 hours",
  "6h": "-6 hours",
  "24h": "-24 hours",
  "7d": "-7 days",
  "30d": "-30 days",
};

function parseRange(range: string | null): string | null {
  if (!range) return null;
  return RANGE_MAP[range] ?? null;
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

  const range = parseRange(url.searchParams.get("range"));
  const timeFilter = range ? " AND created_at >= datetime('now', ?)" : "";
  const order = range ? "ASC" : "DESC";
  const limit = range ? 2000 : Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const bindVals: unknown[] = [parseInt(monitorId)];
  if (range) bindVals.push(range);
  if (!range) bindVals.push(limit);

  const query = range
    ? `SELECT * FROM checks WHERE monitor_id = ?${timeFilter} ORDER BY created_at ${order} LIMIT ${limit}`
    : `SELECT * FROM checks WHERE monitor_id = ? ORDER BY created_at ${order} LIMIT ?`;

  const checks = await db.prepare(query)
    .bind(...bindVals)
    .all();

  const uptimeTimeFilter = range ? " AND created_at >= datetime('now', ?)" : "";
  const uptimeBindVals: unknown[] = [parseInt(monitorId)];
  if (range) uptimeBindVals.push(range);

  const uptime = await db.prepare(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN error IS NULL AND status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) as up
    FROM checks WHERE monitor_id = ?${uptimeTimeFilter}`
  )
    .bind(...uptimeBindVals)
    .first<{ total: number; up: number }>();

  return json({
    checks: checks.results,
    uptime_pct: uptime && uptime.total > 0 ? Math.round((uptime.up / uptime.total) * 10000) / 100 : null,
  });
}

export async function handleCheckStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const db = env.DB;

  const session = await verifySession(request, db);
  if (!session || session.role !== "admin") return json({ error: "Unauthorized" }, 401);

  if (url.pathname === "/api/checks/stats" && request.method === "GET") {
    const stats = await db.prepare(`
      SELECT m.id, m.name, m.retention_days,
        COUNT(c.id) as log_count,
        MIN(c.created_at) as oldest_log
      FROM monitors m
      LEFT JOIN checks c ON c.monitor_id = m.id
      GROUP BY m.id
      ORDER BY m.name
    `).all();
    return json(stats.results);
  }

  if (url.pathname === "/api/checks/purge" && request.method === "POST") {
    const body = await request.json<{ monitor_id?: number }>();
    if (body.monitor_id) {
      const monitor = await db.prepare("SELECT retention_days FROM monitors WHERE id = ?").bind(body.monitor_id).first<{ retention_days: number }>();
      if (!monitor) return json({ error: "Not found" }, 404);
      const result = await db.prepare(
        "DELETE FROM checks WHERE monitor_id = ? AND created_at < datetime('now', ?)"
      ).bind(body.monitor_id, `-${monitor.retention_days} days`).run();
      return json({ deleted: result.meta.changes });
    }
    const monitors = await db.prepare("SELECT id, retention_days FROM monitors").all<{ id: number; retention_days: number }>();
    let total = 0;
    for (const m of monitors.results) {
      const result = await db.prepare(
        "DELETE FROM checks WHERE monitor_id = ? AND created_at < datetime('now', ?)"
      ).bind(m.id, `-${m.retention_days} days`).run();
      total += result.meta.changes;
    }
    return json({ deleted: total });
  }

  return json({ error: "Not found" }, 404);
}
