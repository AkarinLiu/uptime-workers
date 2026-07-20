import { verifySession } from "../auth";
import { hashPassword } from "../auth";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function handleUsers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const db = env.DB;

  const session = await verifySession(request, db);
  if (!session || session.role !== "admin") return json({ error: "Unauthorized" }, 401);

  const match = url.pathname.match(/^\/api\/users(?:\/(\d+))?$/);
  if (!match) return json({ error: "Not found" }, 404);
  const id = match[1] ? parseInt(match[1]) : null;

  if (request.method === "GET" && !id) {
    const users = await db.prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at").all();
    return json(users.results);
  }

  if (request.method === "POST" && !id) {
    const body = await request.json<{ username: string; password: string; role?: string }>();
    if (!body.username || !body.password) return json({ error: "username and password required" }, 400);
    if (body.username.length < 3) return json({ error: "username must be at least 3 characters" }, 400);
    if (body.password.length < 6) return json({ error: "password must be at least 6 characters" }, 400);

    const existing = await db.prepare("SELECT id FROM users WHERE username = ?").bind(body.username).first();
    if (existing) return json({ error: "username already exists" }, 409);

    const hash = await hashPassword(body.password);
    await db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
      .bind(body.username, hash, body.role ?? "user").run();
    return json({ ok: true }, 201);
  }

  if (request.method === "DELETE" && id) {
    if (id === session.userId) return json({ error: "cannot delete yourself" }, 400);
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
    await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
