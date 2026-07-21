export async function initDb(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'http',
      url TEXT NOT NULL,
      interval_seconds INTEGER NOT NULL DEFAULT 60,
      retention_days INTEGER NOT NULL DEFAULT 30,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_status_code INTEGER,
      last_response_time_ms INTEGER,
      last_error TEXT,
      last_checked_at TEXT,
      webhook_url TEXT,
      notify_enabled INTEGER NOT NULL DEFAULT 0,
      notify_on_4xx INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (monitor_id) REFERENCES monitors(id)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_checks_monitor_id ON checks(monitor_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_checks_created_at ON checks(created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`),
  ]);

  await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('interval_seconds', '60')").run();
  await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('retention_days', '30')").run();
  await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('webhook_url', '')").run();

  try { await db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'").run(); } catch {}
  try { await db.prepare("ALTER TABLE monitors ADD COLUMN type TEXT NOT NULL DEFAULT 'http'").run(); } catch {}
  try { await db.prepare("ALTER TABLE monitors ADD COLUMN webhook_url TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE monitors ADD COLUMN notify_enabled INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE monitors ADD COLUMN notify_on_4xx INTEGER NOT NULL DEFAULT 0").run(); } catch {}
}
