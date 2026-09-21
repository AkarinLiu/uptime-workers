import { getSettings } from "./api/settings";
import { runCheck, type CheckResult } from "./check";
import { isRegionId } from "./regions";

async function probe(env: Env, type: string, url: string, region: unknown): Promise<CheckResult> {
  if (typeof region === "string" && region && isRegionId(region)) {
    // ponytail: DO location hint is best-effort; region placement can shift under capacity pressure
    const stub = env.REGION_PROBE.get(env.REGION_PROBE.idFromName(region), { locationHint: region });
    const res = await stub.fetch("https://region-probe/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, url, timeoutMs: 15000 }),
    });
    return await res.json<CheckResult>();
  }
  return runCheck(type, url, 15000);
}

async function cleanupOldChecks(env: Env, monitorId: number, retentionDays: number) {
  await env.DB.prepare(
    "DELETE FROM checks WHERE monitor_id = ? AND created_at < datetime('now', ?)"
  )
    .bind(monitorId, `-${retentionDays} days`)
    .run();
}

export async function runChecks(env: Env): Promise<void> {
  const settings = await getSettings(env.DB);
  const intervalSec = settings.interval_seconds;
  const retentionDays = settings.retention_days;
  const webhookUrl = settings.webhook_url;

  const monitors = await env.DB.prepare(
    `SELECT * FROM monitors WHERE enabled = 1
     AND (last_checked_at IS NULL
       OR (unixepoch('now') - unixepoch(last_checked_at)) >= ?)`
  ).bind(intervalSec).all();

  for (const m of monitors.results as Array<Record<string, unknown>>) {
    const monitorId = m.id as number;
    const type = (m.type as string) ?? "http";
    const url = m.url as string;

    let result: CheckResult;

    try {
      result = await probe(env, type, url, m.region);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      result = { response_time_ms: 0, error: `Probe failed: ${msg}` };
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

    const notifyEnabled = (m.notify_enabled as number) ?? 0;
    const notifyOn4xx = (m.notify_on_4xx as number) ?? 0;

    if (webhookUrl && notifyEnabled) {
      const shouldNotify = !!result.error
        || (result.status_code != null && result.status_code >= 500)
        || (notifyOn4xx === 1 && result.status_code != null && result.status_code >= 400);
      if (shouldNotify) {
        try {
          const statusText = result.error
            ? `错误: ${result.error}`
            : `状态码: ${result.status_code ?? 'N/A'}`;
          const payload = JSON.stringify({
            msgtype: "markdown",
            markdown: {
              content: `**${m.name}** 监测异常\n> 地址: <font color="comment">${m.url}</font>\n> ${statusText}\n> 响应时间: ${result.response_time_ms}ms\n> 检测时间: ${new Date().toISOString()}`,
            },
          });
          // ponytail: fire-and-forget, best-effort delivery
          const webhookPromise = fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "Uptime-Workers/1.0" },
            body: payload,
          }).catch(() => {});
          // don't await — don't block the check loop for webhook delivery
        } catch { /* webhook delivery is best-effort */ }
      }
    }

    await cleanupOldChecks(env, monitorId, retentionDays);
  }
}
