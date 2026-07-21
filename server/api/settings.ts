import { verifySession } from "../auth";

export interface AppSettings {
  interval_seconds: number;
  retention_days: number;
  webhook_url: string;
}

export async function getSettings(db: D1Database): Promise<AppSettings> {
  const rows = await db.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const settings: Record<string, string> = {};
  for (const r of rows.results) settings[r.key] = r.value;
  return {
    interval_seconds: parseInt(settings["interval_seconds"] ?? "60", 10) || 60,
    retention_days: parseInt(settings["retention_days"] ?? "30", 10) || 30,
    webhook_url: settings["webhook_url"] ?? "",
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleSettings(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  const session = await verifySession(request, db);
  if (!session || session.role !== "admin") return json({ error: "Unauthorized" }, 401);

  if (request.method === "GET") {
    const settings = await getSettings(db);
    return json(settings);
  }

  if (request.method === "PUT") {
    const body = await request.json<{ interval_seconds?: number; retention_days?: number; webhook_url?: string }>();
    if (body.interval_seconds !== undefined) {
      await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('interval_seconds', ?)").bind(String(body.interval_seconds)).run();
    }
    if (body.retention_days !== undefined) {
      await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('retention_days', ?)").bind(String(body.retention_days)).run();
    }
    if (body.webhook_url !== undefined) {
      await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('webhook_url', ?)").bind(body.webhook_url).run();
    }
    const settings = await getSettings(db);
    return json(settings);
  }

  return json({ error: "Method not allowed" }, 405);
}
