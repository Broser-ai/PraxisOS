import { NextResponse } from "next/server";
import { writeSecrets, secretsPublicStatus, type PraxisSecrets } from "@/lib/secrets";
import { getBirdPublicStatus } from "@/lib/bird";
import { isLlmConfigured } from "@/lib/agents/llm";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    bird: getBirdPublicStatus(),
    llm: { configured: isLlmConfigured() },
    secrets: secretsPublicStatus(),
  });
}

/** Gem Bird/OpenAI-nøgler i /data/secrets.json (volume) — ingen rebuild nødvendig */
export async function POST(req: Request) {
  let body: {
    BIRD_API_KEY?: string;
    BIRD_SMS_CHANNEL_ID?: string;
    BIRD_SMS_FROM?: string;
    BIRD_WORKSPACE_ID?: string;
    OPENAI_API_KEY?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: PraxisSecrets = {};
  if (typeof body.BIRD_API_KEY === "string") patch.BIRD_API_KEY = body.BIRD_API_KEY;
  if (typeof body.BIRD_SMS_CHANNEL_ID === "string") patch.BIRD_SMS_CHANNEL_ID = body.BIRD_SMS_CHANNEL_ID;
  if (typeof body.BIRD_SMS_FROM === "string") patch.BIRD_SMS_FROM = body.BIRD_SMS_FROM;
  if (typeof body.BIRD_WORKSPACE_ID === "string") patch.BIRD_WORKSPACE_ID = body.BIRD_WORKSPACE_ID;
  if (typeof body.OPENAI_API_KEY === "string") patch.OPENAI_API_KEY = body.OPENAI_API_KEY;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  try {
    writeSecrets(patch);
    return NextResponse.json({
      ok: true,
      bird: getBirdPublicStatus(),
      llm: { configured: isLlmConfigured() },
      secrets: secretsPublicStatus(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "save_failed" }, { status: 500 });
  }
}
