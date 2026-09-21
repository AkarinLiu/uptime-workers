export interface CheckResult {
  status_code?: number;
  response_time_ms: number;
  error?: string;
}

async function checkUrl(url: string, timeoutMs: number): Promise<CheckResult> {
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

async function tcpCheck(host: string, port: number, timeoutMs: number): Promise<CheckResult> {
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

export async function runCheck(type: string, url: string, timeoutMs = 15000): Promise<CheckResult> {
  if (type === "tcp") {
    const parsed = parseHostPort(url);
    if (!parsed) return { response_time_ms: 0, error: `Invalid host:port: ${url}` };
    return tcpCheck(parsed.host, parsed.port, timeoutMs);
  }
  return checkUrl(url, timeoutMs);
}
