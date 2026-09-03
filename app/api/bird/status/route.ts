import { NextResponse } from "next/server";
import { getBirdPublicStatus } from "@/lib/bird";

export const runtime = "nodejs";

/** Public Bird readiness — F36 · no keyHint on public status. */
export async function GET() {
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
