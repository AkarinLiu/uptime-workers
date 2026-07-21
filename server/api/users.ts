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

  if (url.pathname === "/api/users" && request.method === "GET") {
    const users = await db.prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at").all();
    return json(users.results);
  }

  if (url.pathname === "/api/users" && request.method === "POST") {
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

  const idMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
  const passMatch = url.pathname.match(/^\/api\/users\/(\d+)\/password$/);

  if (idMatch && request.method === "DELETE") {
    const id = parseInt(idMatch[1]);
    if (id === session.userId) return json({ error: "cannot delete yourself" }, 400);
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
    await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  if (passMatch && request.method === "PUT") {
    const id = parseInt(passMatch[1]);
    const body = await request.json<{ password: string }>();
    if (!body.password || body.password.length < 6) return json({ error: "password must be at least 6 characters" }, 400);

    const hash = await hashPassword(body.password);
    await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hash, id).run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
