import { hashPassword, verifyPassword, createSession, verifySession, deleteSession } from "../auth";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function handleAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const db = env.DB;

  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    const body = await request.json<{ username: string; password: string }>();
    if (!body.username || !body.password) return json({ error: "username and password required" }, 400);
    if (body.username.length < 3) return json({ error: "username must be at least 3 characters" }, 400);
    if (body.password.length < 6) return json({ error: "password must be at least 6 characters" }, 400);

    const userCount = await db.prepare("SELECT COUNT(*) as c FROM users").first<{ c: number }>();
    if (userCount && userCount.c > 0) return json({ error: "registration closed" }, 403);

    const existing = await db.prepare("SELECT id FROM users WHERE username = ?").bind(body.username).first();
    if (existing) return json({ error: "username already exists" }, 409);

    const hash = await hashPassword(body.password);
    await db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").bind(body.username, hash).run();
    return json({ ok: true }, 201);
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await request.json<{ username: string; password: string }>();
    if (!body.username || !body.password) return json({ error: "username and password required" }, 400);

    const user = await db.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").bind(body.username).first<{ id: number; username: string; password_hash: string }>();
    if (!user) return json({ error: "invalid credentials" }, 401);

    const valid = await verifyPassword(body.password, user.password_hash);
    if (!valid) return json({ error: "invalid credentials" }, 401);

    const token = await createSession(db, user.id);
    const fullUser = await db.prepare("SELECT role FROM users WHERE id = ?").bind(user.id).first<{ role: string }>();
    return json({ token, username: user.username, role: fullUser?.role });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const auth = request.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      await deleteSession(db, auth.slice(7));
    }
    return json({ ok: true });
  }

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    const session = await verifySession(request, db);
    if (!session) return json({ error: "Unauthorized" }, 401);
    const user = await db.prepare("SELECT id, username, role FROM users WHERE id = ?").bind(session.userId).first<{ id: number; username: string; role: string }>();
    return json(user);
  }

  return json({ error: "Not found" }, 404);
}
