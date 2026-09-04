import { NextResponse } from "next/server";
import { getBirdPublicStatus } from "@/lib/bird";
import { checkIpRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Public Bird readiness — F36 · no keyHint on public status. */
export async function GET(req: Request) {
  // F44 · public GET rate-limit
  const limit = checkIpRateLimit(clientIp(req), {
    key: "bird-status-get",
    limit: 60,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }

  const status = getBirdPublicStatus();
  const { keyHint: _drop, ...birdPublic } = status as typeof status & {
    keyHint?: string | null;
  };
  return NextResponse.json({
    provider: "bird",
    ...birdPublic,
    hint: "Sæt BIRD_API_KEY + BIRD_SMS_FROM i server-env. Nøglen skal være bk_eu1_… eller bk_us1_… fra app.bird.com → Developers → API keys.",
  });
}
