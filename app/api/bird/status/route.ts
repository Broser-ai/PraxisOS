import { NextResponse } from "next/server";
import { getBirdPublicStatus } from "@/lib/bird";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    provider: "bird",
    ...getBirdPublicStatus(),
    hint: "Sæt BIRD_API_KEY + BIRD_SMS_FROM i server-env. Nøglen skal være bk_eu1_… eller bk_us1_… fra app.bird.com → Developers → API keys.",
  });
}
