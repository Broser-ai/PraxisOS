// POST /api/v1/[tenant]/scans/[scan_id]/stl
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §5, §7
// Sprint 6 Batch 2: audit-wiring · emit mill.submit ved STL-eksport (R§).

import { NextRequest, NextResponse } from "next/server";
import { exportStl } from "@/lib/scanner/stl-export";
import type { MeshLike } from "@/lib/scanner/watertight";
import { auditLog, auditError } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string; scan_id: string }> },
) {
  const { tenant, scan_id } = await ctx.params;
  if (!tenant || !scan_id) {
    return NextResponse.json({ error: "PARAMS_REQUIRED" }, { status: 400 });
  }

  let body: {
    mesh?: MeshLike;
    quality_score?: number;
    feature_cad_export?: boolean;
    actor_role?: "owner" | "practitioner" | "reception" | "support" | "system";
    practitioner_triggered?: boolean;
    cad_dpa_accepted?: boolean;
    actor_user_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body.mesh) {
    return NextResponse.json({ error: "MESH_REQUIRED" }, { status: 400 });
  }

  const actorUserId = typeof body.actor_user_id === "string" ? body.actor_user_id : undefined;

  const result = exportStl({
    scanId: scan_id,
    tenantId: tenant,
    mesh: body.mesh,
    qualityScore: body.quality_score ?? 0,
    featureCadExport: body.feature_cad_export ?? false,
    actorRole: body.actor_role ?? "practitioner",
    practitionerTriggered: body.practitioner_triggered ?? false,
    cadDpaAccepted: body.cad_dpa_accepted ?? false,
  });

  if (!result.ok) {
    // Sprint 6 B2: R§ audit — STL-eksport afvist (INV-CS-8 / kvalitet / DPA).
    auditError(
      "mill.submit.rejected",
      new Error(`${result.code}: ${result.message}`),
      {
        tenant_id: tenant,
        actor_user_id: actorUserId,
        target_ref: `scan/${scan_id}`,
        reason_code: result.code,
        actor_role: body.actor_role ?? "practitioner",
        practitioner_triggered: body.practitioner_triggered ?? false,
      },
    );
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: 409 },
    );
  }

  // Sprint 6 B2: R§ audit — STL-eksport lykkedes (klinisk-aktiv mutation
  // · udgør mill.submit-kandidatur · Sundhedsloven §42a-d + MDR Art. 83).
  auditLog("mill.submit", {
    tenant_id: tenant,
    actor_user_id: actorUserId,
    target_ref: `scan/${scan_id}`,
    stl_bytes: result.bytesLength,
    quality_score: body.quality_score ?? 0,
    actor_role: body.actor_role ?? "practitioner",
    practitioner_triggered: body.practitioner_triggered ?? false,
    cad_dpa_accepted: body.cad_dpa_accepted ?? false,
  });

  // INV-CS-2: kun release STL hvis post-verify passede (allerede indbygget i exportStl)
  return new NextResponse(new Uint8Array(result.stlBytes), {
    status: 200,
    headers: {
      "content-type": "model/stl",
      "content-length": String(result.bytesLength),
      "x-scan-id": scan_id,
    },
  });
}
