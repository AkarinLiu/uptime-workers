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

function parseHostPort(input: string): { host: string; port: number } | null {
  const ipv6 = input.match(/^\[(.+)\]:(\d+)$/);
  if (ipv6) return { host: ipv6[1]!, port: parseInt(ipv6[2]!) };
  const lastColon = input.lastIndexOf(":");
  if (lastColon === -1) return null;
  const host = input.substring(0, lastColon);
  const port = parseInt(input.substring(lastColon + 1));
  if (!host || isNaN(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

async function tcpCheck(
  host: string,
  port: number,
  timeoutMs: number
): Promise<{
  status_code?: number;
  response_time_ms: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    // ponytail: cloudflare:sockets is the Workers-native TCP API
    const { connect } = await import("cloudflare:sockets");
    const socket = connect({ hostname: host, port });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out")), timeoutMs)
    );

    const connected = socket.writable.getWriter().close();
    // ponytail: re-close and request an immediate GC

    await Promise.race([connected, timeout]);

    try { socket.close(); } catch {}

    return { status_code: 200, response_time_ms: Date.now() - start };
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
    const type = (m.type as string) ?? "http";
    const url = m.url as string;
    const retentionDays = m.retention_days as number;

    let result: { status_code?: number; response_time_ms: number; error?: string };

    if (type === "tcp") {
      const parsed = parseHostPort(url);
      if (!parsed) {
        result = { response_time_ms: 0, error: `Invalid host:port: ${url}` };
      } else {
        result = await tcpCheck(parsed.host, parsed.port, 15000);
      }
    } else {
      result = await checkUrl(url, 15000);
    }

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
