// POST /api/v1/[tenant]/scans/upload
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §7
// Sprint 6 Batch 2: audit-wiring · emit scan.upload.consent + scan.created (R§).
//
// Modtager scan-metadata (frames-count, calibration, klient-ref) og starter
// pipeline (Level 2 + 3). Selve frame-upload er chunked og går til Supabase
// Storage direkte fra klient — vi modtager kun MANIFEST'et her.

import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/scanner/pipeline";
import { createDefaultLifter } from "@/lib/scanner/gpu-adapter";
import { createDefaultVlmCaller } from "@/lib/scanner/vlm-caller";
import { redactPII } from "@/lib/redact";
import { auditLog, auditError } from "@/lib/audit";

export function isScannerV2Enabled(): boolean {
  return process.env.AGENT_SCANNER_V2_ENABLED === "true";
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string }> },
) {
  if (!isScannerV2Enabled()) {
    return NextResponse.json({ error: "AGENT_SCANNER_V2_DISABLED" }, { status: 503 });
  }

  const { tenant } = await ctx.params;
  if (!tenant) return NextResponse.json({ error: "TENANT_REQUIRED" }, { status: 400 });

  let body: {
    scan_id?: string;
    client_id?: string;
    frames_url?: string;
    frames_count?: number;
    calibration_mode?: "aruco" | "monocular";
    client_context?: {
      age_band?: string;
      sex?: "M" | "F" | "other";
      known_diagnoses?: string[];
    };
    consent_given?: boolean;
    actor_user_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const scanIdPlanned = body.scan_id ?? `scan_${Date.now().toString(36)}`;
  const actorUserId = typeof body.actor_user_id === "string" ? body.actor_user_id : undefined;

  // INV-CS-12: samtykke er påkrævet
  if (!body.consent_given) {
    // Sprint 6 B2: R§ audit — consent-nægtelse (GDPR Art. 30 · Corti 4-lags samtykke).
    auditError(
      "scan.upload.consent.denied",
      new Error("CONSENT_REQUIRED"),
      {
        tenant_id: tenant,
        actor_user_id: actorUserId,
        target_ref: `scan/${scanIdPlanned}`,
        reason_code: "INV-CS-12",
      },
    );
    return NextResponse.json(
      { error: "CONSENT_REQUIRED", message: "Klient-samtykke skal være givet før upload" },
      { status: 403 },
    );
  }

  // Sprint 6 B2: R§ audit — samtykke registreret (append-only evidenskilde).
  auditLog("scan.upload.consent", {
    tenant_id: tenant,
    actor_user_id: actorUserId,
    target_ref: `scan/${scanIdPlanned}`,
    client_ref: body.client_id ? `client/${body.client_id}` : undefined,
    consent_given: true,
  });

  const scanId = scanIdPlanned;
  const framesCount = body.frames_count ?? 0;
  const framesUrl = body.frames_url ?? `stub://frames/${scanId}/`;

  // Sprint 6 B2: R§ audit — scan-record oprettet (før pipeline starter).
  auditLog("scan.created", {
    tenant_id: tenant,
    actor_user_id: actorUserId,
    target_ref: `scan/${scanId}`,
    client_ref: body.client_id ? `client/${body.client_id}` : undefined,
    frames_count: framesCount,
    calibration_mode: body.calibration_mode ?? "monocular",
  });

  const result = await runPipeline(
    {
      lifter: createDefaultLifter(),
      vlm: createDefaultVlmCaller(),
    },
    {
      scanId,
      tenantId: tenant,
      clientId: body.client_id,
      framesUrl,
      framesCount,
      calibrationMode: body.calibration_mode ?? "monocular",
      clientContext: redactPII(body.client_context ?? {}),
      actorUserId,
    },
  );

  const httpStatus = result.status === "done" ? 200 : 500;
  return NextResponse.json({ scan_id: scanId, ...result }, { status: httpStatus });
}
