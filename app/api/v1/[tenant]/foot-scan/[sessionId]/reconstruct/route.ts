// POST /api/v1/[tenant]/foot-scan/[sessionId]/reconstruct
// Body: { engine?, voxelSizeMm?, maxPoints?, fillHoles? }
//
// Trigger 3D-rekonstruktion (COLMAP + Open3D / NeuralMeshing / Gaussian Splat).

import { NextRequest, NextResponse } from "next/server";
import * as fs from "@/lib/foot-scanner";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string; sessionId: string }> },
) {
  const { sessionId } = await params;
  const body = await req.json().catch(() => ({}));
  const online = await fs.isEngineOnline();
  if (!online) {
    return NextResponse.json({
      session_id: sessionId,
      engine: body.engine ?? "colmap+open3d",
      duration_ms: 84321,
      mesh_uri: `file:///stub/${sessionId}/mesh.ply`,
      preview_uri: null,
      stats: {
        vertex_count: 312487, face_count: 618203, watertight: true,
        volume_ml: 486.2, surface_area_cm2: 442.0, bbox_mm: [102, 265, 78],
      },
      calibration: { mm_per_px: 0.412, marker_confidence: 0.92, method: "a4_contour" },
      warnings: ["engine offline — stub result"],
      _stub: true,
    });
  }
  try {
    const result = await fs.reconstruct({
      sessionId,
      engine: body.engine,
      voxelSizeMm: body.voxelSizeMm,
      maxPoints: body.maxPoints,
      fillHoles: body.fillHoles,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
