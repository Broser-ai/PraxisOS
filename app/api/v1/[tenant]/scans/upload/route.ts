// POST /api/v1/[tenant]/scans/upload
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §7
//
// Modtager scan-metadata (frames-count, calibration, klient-ref) og starter
// pipeline (Level 2 + 3). Selve frame-upload er chunked og går til Supabase
// Storage direkte fra klient — vi modtager kun MANIFEST'et her.

import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/scanner/pipeline";
import { createDefaultLifter } from "@/lib/scanner/gpu-adapter";
import { createDefaultVlmCaller } from "@/lib/scanner/vlm-caller";
import { redactPII } from "@/lib/redact";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  // INV-CS-12: samtykke er påkrævet
  if (!body.consent_given) {
    return NextResponse.json(
      { error: "CONSENT_REQUIRED", message: "Klient-samtykke skal være givet før upload" },
      { status: 403 },
    );
  }

  const scanId = body.scan_id ?? `scan_${Date.now().toString(36)}`;
  const framesCount = body.frames_count ?? 0;
  const framesUrl = body.frames_url ?? `stub://frames/${scanId}/`;

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
    },
  );

  const httpStatus = result.status === "done" ? 200 : 500;
  return NextResponse.json({ scan_id: scanId, ...result }, { status: httpStatus });
}
