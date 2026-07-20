async function checkUrl(
  url: string,
  timeoutMs: number
): Promise<{
  status_code?: number;
  response_time_ms: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Uptime-Workers/1.0" },
    });
    clearTimeout(timer);
    return { status_code: res.status, response_time_ms: Date.now() - start };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { response_time_ms: Date.now() - start, error: msg };
  }
}

async function cleanupOldChecks(env: Env, monitorId: number, retentionDays: number) {
  await env.DB.prepare(
    "DELETE FROM checks WHERE monitor_id = ? AND created_at < datetime('now', ?)"
  )
    .bind(monitorId, `-${retentionDays} days`)
    .run();
}

export async function runChecks(env: Env): Promise<void> {
  const monitors = await env.DB.prepare(
    `SELECT * FROM monitors WHERE enabled = 1
     AND (last_checked_at IS NULL
       OR (unixepoch('now') - unixepoch(last_checked_at)) >= interval_seconds)`
  ).all();

  for (const m of monitors.results as Array<Record<string, unknown>>) {
    const monitorId = m.id as number;
    const url = m.url as string;
    const retentionDays = m.retention_days as number;

    const result = await checkUrl(url, 15000);

    await env.DB.prepare(
      "INSERT INTO checks (monitor_id, status_code, response_time_ms, error) VALUES (?, ?, ?, ?)"
    )
      .bind(monitorId, result.status_code ?? null, result.response_time_ms, result.error ?? null)
      .run();

    await env.DB.prepare(
      `UPDATE monitors SET
        last_status_code = ?,
        last_response_time_ms = ?,
        last_error = ?,
        last_checked_at = datetime('now')
      WHERE id = ?`
    )
      .bind(result.status_code ?? null, result.response_time_ms, result.error ?? null, monitorId)
      .run();

    await cleanupOldChecks(env, monitorId, retentionDays);
  }
}
