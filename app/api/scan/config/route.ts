import { NextResponse } from "next/server";
import { secretsPublicStatus, writeSecrets, type PraxisSecrets } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Broser-only · status for Del Pilar Nexus provider keys */
export async function GET() {
  const secrets = secretsPublicStatus();
  return NextResponse.json({
    ok: true,
    liveReady: secrets.liveScanReady,
    providers: {
      replicate: secrets.replicate,
      replicateHint: secrets.replicateHint,
      roboflow: secrets.roboflow,
      roboflowHint: secrets.roboflowHint,
      openai: secrets.openai,
      openaiHint: secrets.openaiHint,
    },
    where: {
      replicate: "https://replicate.com/account/api-tokens",
      roboflow: "https://app.roboflow.com/settings/api",
    },
  });
}

/** Gem Replicate/Roboflow (og valgfri OpenAI) i /data/secrets.json — ingen rebuild */
export async function POST(req: Request) {
  let body: {
    REPLICATE_API_TOKEN?: string;
    ROBOFLOW_API_KEY?: string;
    OPENAI_API_KEY?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: PraxisSecrets = {};
  if (typeof body.REPLICATE_API_TOKEN === "string") {
    patch.REPLICATE_API_TOKEN = body.REPLICATE_API_TOKEN;
  }
  if (typeof body.ROBOFLOW_API_KEY === "string") {
    patch.ROBOFLOW_API_KEY = body.ROBOFLOW_API_KEY;
  }
  if (typeof body.OPENAI_API_KEY === "string") {
    patch.OPENAI_API_KEY = body.OPENAI_API_KEY;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  try {
    writeSecrets(patch);
    const secrets = secretsPublicStatus();
    return NextResponse.json({
      ok: true,
      liveReady: secrets.liveScanReady,
      providers: {
        replicate: secrets.replicate,
        replicateHint: secrets.replicateHint,
        roboflow: secrets.roboflow,
        roboflowHint: secrets.roboflowHint,
        openai: secrets.openai,
        openaiHint: secrets.openaiHint,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "save_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
