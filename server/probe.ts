import { runCheck } from "./check";

// Runs checks from a specific Cloudflare region via a Durable Object location
// hint. The DO owns no state; it only executes the probe and returns the result.
// ponytail: one DO per region; shard idFromName per monitor if a region's
// concurrency becomes a bottleneck.
export class RegionProbe {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const body = await request.json<{ type?: string; url?: string; timeoutMs?: number }>();
    if (!body.url) return Response.json({ error: "url required" }, { status: 400 });
    const result = await runCheck(body.type ?? "http", body.url, body.timeoutMs ?? 15000);
    return Response.json(result);
  }
}
