import { parseRange } from "../range";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleStatus(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.pathname.replace(/^\/api\/status\/?/, "");

  if (!slug) {
    const [monitors, announcements] = await Promise.all([
      env.DB.prepare(
        "SELECT id, slug, name, type, url, last_status_code, last_response_time_ms, last_error, last_checked_at FROM monitors WHERE enabled = 1 ORDER BY name"
      ).all(),
      env.DB.prepare("SELECT id, title, content, created_at FROM announcements WHERE active = 1 ORDER BY created_at DESC").all(),
    ]);
    return json({ monitors: monitors.results, announcements: announcements.results });
  }

  const monitor = await env.DB.prepare(
    "SELECT * FROM monitors WHERE slug = ? AND enabled = 1"
  )
    .bind(slug)
    .first();

  if (!monitor) return json({ error: "Not found" }, 404);

  const range = parseRange(url.searchParams.get("range"));

  // ponytail: uptime is derived from the chart query itself — one range scan per poll, not two
  let recentChecks;
  let total = 0;
  let up = 0;
  if (range && range.bucket != null) {
    const b = range.bucket;
    recentChecks = await env.DB.prepare(
      `SELECT
        datetime((strftime('%s', created_at) / ?) * ?, 'unixepoch') AS created_at,
        ROUND(AVG(response_time_ms)) AS response_time_ms,
        ROUND(AVG(status_code)) AS status_code,
        CASE WHEN COUNT(status_code) = 0 AND COUNT(error) > 0 THEN 'down' ELSE NULL END AS error,
        COUNT(*) AS n,
        SUM(CASE WHEN error IS NULL AND status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) AS up
      FROM checks
      WHERE monitor_id = ? AND created_at >= datetime('now', ?)
      GROUP BY (strftime('%s', created_at) / ?)
      ORDER BY (strftime('%s', created_at) / ?)`
    )
      .bind(b, b, monitor.id as number, range.modifier, b, b)
      .all();
    for (const c of recentChecks.results as Array<{ n: number; up: number }>) {
      total += c.n;
      up += c.up;
    }
  } else {
    const timeFilter = range ? ` AND created_at >= datetime('now', ?)` : "";
    const order = range ? "ASC" : "DESC";
    const limit = range ? 2000 : 50;
    const rangeBind = range
      ? [monitor.id as number, range.modifier]
      : [monitor.id as number];
    recentChecks = await env.DB.prepare(
      `SELECT status_code, response_time_ms, error, created_at FROM checks WHERE monitor_id = ?${timeFilter} ORDER BY created_at ${order} LIMIT ${limit}`
    )
      .bind(...rangeBind)
      .all();
    const rows = recentChecks.results as Array<{ status_code: number | null; error: string | null }>;
    total = rows.length;
    up = rows.filter((c) => c.error == null && c.status_code != null && c.status_code >= 200 && c.status_code < 400).length;
  }

  const result = {
    ...monitor,
    recent_checks: recentChecks.results,
    uptime_pct: total > 0 ? Math.round((up / total) * 10000) / 100 : null,
  } as Record<string, unknown>;
  delete result.webhook_url;
  return json(result);
}
