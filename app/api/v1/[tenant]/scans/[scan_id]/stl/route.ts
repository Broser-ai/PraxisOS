// POST /api/v1/[tenant]/scans/[scan_id]/stl
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §5, §7

import { NextRequest, NextResponse } from "next/server";
import { exportStl } from "@/lib/scanner/stl-export";
import type { MeshLike } from "@/lib/scanner/watertight";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body.mesh) {
    return NextResponse.json({ error: "MESH_REQUIRED" }, { status: 400 });
  }

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
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: 409 },
    );
  }

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
