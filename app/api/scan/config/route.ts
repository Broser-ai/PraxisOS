import { NextResponse } from "next/server";
import { secretsPublicStatus, writeSecrets, type PraxisSecrets } from "@/lib/secrets";
import { auditLogWithContext } from "@/lib/audit";
import {
  jsonAuthFail,
  requireRole,
  resolveRequestAuth,
  type AuthOk,
} from "@/lib/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readinessPayload(
  secrets: ReturnType<typeof secretsPublicStatus>,
  opts: { includeHints: boolean },
) {
  const blockers: string[] = [];
  if (!secrets.replicate) {
    blockers.push("REPLICATE_API_TOKEN mangler — kræves til live 3D-mesh (liveReady)");
  }
  if (!secrets.roboflow) {
    blockers.push("ROBOFLOW_API_KEY mangler — kræves til segmentering/pathology (liveReady)");
  }
  const notes: string[] = [];
  if (!secrets.openai) {
    notes.push(
      "OPENAI_API_KEY mangler — valgfri; live fod-scan virker uden. Nødvendig for rigtige LLM-agentsvar.",
    );
  }
  const providers: Record<string, unknown> = {
    replicate: secrets.replicate,
    roboflow: secrets.roboflow,
    openai: secrets.openai,
  };
  // F33 · hints only for authenticated secret writers (POST response)
  if (opts.includeHints) {
    providers.replicateHint = secrets.replicateHint;
    providers.roboflowHint = secrets.roboflowHint;
    providers.openaiHint = secrets.openaiHint;
  }
  return {
    ok: true as const,
    liveReady: secrets.liveScanReady,
    llmReady: secrets.openai,
    blockers,
    notes,
    providers,
    where: {
      replicate: "https://replicate.com/account/api-tokens",
      roboflow: "https://app.roboflow.com/settings/api",
      openai: "https://platform.openai.com/api-keys",
    },
  };
}

/** Public readiness — booleans only (F33 · no key hints on public GET). */
export async function GET() {
  return NextResponse.json(
    readinessPayload(secretsPublicStatus(), { includeHints: false }),
  );
}

/** Gem Replicate/Roboflow (og valgfri OpenAI) i /data/secrets.json — ingen rebuild */
export async function POST(req: Request) {
  // Secret write — owner/support only (was unauthenticated).
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, ["owner", "support"]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);

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
    auditLogWithContext(req, "secrets.updated", {
      actor_user_id: (auth as AuthOk).accountId,
      target_ref: "config/scan",
      auth_mode: (auth as AuthOk).mode,
      meta: { fields: Object.keys(patch) },
    });
    return NextResponse.json(
      readinessPayload(secretsPublicStatus(), { includeHints: true }),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "save_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
