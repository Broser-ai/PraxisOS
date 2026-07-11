// POST /api/v1/[tenant]/foot-scan/[sessionId]/orthotic
// Body: OrthoticSpec (uden session_id; udledes fra URL)
//
// Kræver at tenant har FEATURE_CAD_EXPORT aktiveret. Vi gør det simpelt:
// tjek et tenant-flag via lib/tenants; for prototype tillader vi altid.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "@/lib/foot-scanner";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string; sessionId: string }> },
) {
  const { sessionId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const art = await fs.orthotic({
      session_id: sessionId,
      material: body.material,
      arch_support_mm: body.archSupportMm ?? body.arch_support_mm,
      heel_cup_mm: body.heelCupMm ?? body.heel_cup_mm,
      metatarsal_pad: body.metatarsalPad ?? body.metatarsal_pad,
      metatarsal_pad_thickness_mm: body.metatarsalPadThicknessMm ?? body.metatarsal_pad_thickness_mm,
      heel_wedge_deg: body.heelWedgeDeg ?? body.heel_wedge_deg,
      forefoot_wedge_deg: body.forefootWedgeDeg ?? body.forefoot_wedge_deg,
      top_cover: body.topCover ?? body.top_cover,
      print_style: body.printStyle ?? body.print_style,
    });
    return NextResponse.json(art);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
