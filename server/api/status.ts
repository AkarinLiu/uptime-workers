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
        "SELECT id, slug, name, url, last_status_code, last_response_time_ms, last_error, last_checked_at FROM monitors WHERE enabled = 1 ORDER BY name"
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

  const recentChecks = await env.DB.prepare(
    "SELECT status_code, response_time_ms, error, created_at FROM checks WHERE monitor_id = ? ORDER BY created_at DESC LIMIT 50"
  )
    .bind(monitor.id as number)
    .all();

  const uptime = await env.DB.prepare(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN error IS NULL AND status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) as up
    FROM checks WHERE monitor_id = ? AND created_at >= datetime('now', '-7 days')`
  )
    .bind(monitor.id as number)
    .first<{ total: number; up: number }>();

  return json({
    ...monitor,
    recent_checks: recentChecks.results,
    uptime_7d_pct:
      uptime && uptime.total > 0
        ? Math.round((uptime.up / uptime.total) * 10000) / 100
        : null,
  });
}
