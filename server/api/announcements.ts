import { verifySession } from "../auth";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function handleAnnouncements(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const db = env.DB;
  const match = url.pathname.match(/^\/api\/announcements(?:\/(\d+))?$/);
  if (!match) return json({ error: "Not found" }, 404);
  const id = match[1] ? parseInt(match[1]) : null;

  if (request.method === "GET" && !id) {
    const list = await db.prepare("SELECT * FROM announcements ORDER BY created_at DESC").all();
    return json(list.results);
  }

  const session = await verifySession(request, db);
  if (!session || session.role !== "admin") return json({ error: "Unauthorized" }, 401);

  if (request.method === "POST" && !id) {
    const body = await request.json<{ title: string; content?: string }>();
    if (!body.title) return json({ error: "title required" }, 400);
    await db.prepare("INSERT INTO announcements (title, content) VALUES (?, ?)").bind(body.title, body.content ?? "").run();
    return json({ ok: true }, 201);
  }

  if (request.method === "PUT" && id) {
    const body = await request.json<{ title?: string; content?: string; active?: number }>();
    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.title !== undefined) { fields.push("title = ?"); values.push(body.title); }
    if (body.content !== undefined) { fields.push("content = ?"); values.push(body.content); }
    if (body.active !== undefined) { fields.push("active = ?"); values.push(body.active); }
    if (fields.length === 0) return json({ error: "no fields" }, 400);
    await db.prepare(`UPDATE announcements SET ${fields.join(", ")} WHERE id = ?`).bind(...values, id).run();
    return json({ ok: true });
  }

  if (request.method === "DELETE" && id) {
    await db.prepare("DELETE FROM announcements WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}

export async function handlePublicAnnouncements(env: Env): Promise<Response> {
  const list = await env.DB.prepare("SELECT id, title, content, created_at FROM announcements WHERE active = 1 ORDER BY created_at DESC").all();
  return json(list.results);
}
