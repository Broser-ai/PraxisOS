import { NextResponse } from "next/server";
import { writeSecrets, secretsPublicStatus, type PraxisSecrets } from "@/lib/secrets";
import { getBirdPublicStatus, resolveBirdSmsChannelId } from "@/lib/bird";
import { isLlmConfigured } from "@/lib/agents/llm";
import { auditLogWithContext } from "@/lib/audit";
import {
  jsonAuthFail,
  requireRole,
  resolveRequestAuth,
  type AuthOk,
} from "@/lib/request-auth";

export const runtime = "nodejs";

/** Public readiness — booleans only (F33 · no key hints on public GET). */
export async function GET() {
  const secrets = secretsPublicStatus();
  const bird = getBirdPublicStatus();
  // Drop keyHint from public bird status (partial key material).
  const { keyHint: _drop, ...birdPublic } = bird as typeof bird & {
    keyHint?: string | null;
  };
  return NextResponse.json({
    bird: birdPublic,
    llm: { configured: isLlmConfigured() },
    secrets: {
      birdKey: secrets.birdKey,
      birdChannel: secrets.birdChannel,
      openai: secrets.openai,
      liveScanReady: secrets.liveScanReady,
      dataDir: secrets.dataDir,
    },
  });
}

/** Gem Bird/OpenAI-nøgler i /data/secrets.json (volume) — ingen rebuild nødvendig */
export async function POST(req: Request) {
  // Secret write — owner/support only (was unauthenticated).
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, ["owner", "support"]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);

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
    // Persist first so resolve can see newly pasted API key / workspace.
    writeSecrets(patch);

    auditLogWithContext(req, "secrets.updated", {
      actor_user_id: (auth as AuthOk).accountId,
      target_ref: "config/bird",
      auth_mode: (auth as AuthOk).mode,
      meta: { fields: Object.keys(patch) },
    });

    const preferredChannel =
      typeof body.BIRD_SMS_CHANNEL_ID === "string" ? body.BIRD_SMS_CHANNEL_ID.trim() : undefined;
    const shouldResolve =
      Boolean(preferredChannel) ||
      typeof body.BIRD_API_KEY === "string" ||
      typeof body.BIRD_WORKSPACE_ID === "string";

    let channelNote: string | undefined;
    if (shouldResolve) {
      const resolved = await resolveBirdSmsChannelId(preferredChannel);
      if (resolved.channelId && resolved.channelId !== preferredChannel) {
        writeSecrets({ BIRD_SMS_CHANNEL_ID: resolved.channelId });
        channelNote =
          resolved.resolvedFrom === "connector"
            ? "URL-UUID var connector-ID — gemte den rigtige SMS-channel automatisk"
            : "Fandt aktiv bypilar SMS-channel automatisk";
      } else if (!resolved.channelId && preferredChannel) {
        channelNote = resolved.error || "Channel ikke fundet";
      }
    }

    return NextResponse.json({
      ok: true,
      bird: getBirdPublicStatus(),
      llm: { configured: isLlmConfigured() },
      secrets: secretsPublicStatus(),
      channelNote,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "save_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
