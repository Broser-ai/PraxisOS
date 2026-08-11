import { NextResponse } from "next/server";
import { ariaOrchestrator } from "@/agents/ARIA-orchestrator";
import { ensureNexusBooted } from "@/lib/nexus/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  imageUrl?: string;
  imageBase64?: string;
  tenantId?: string;
  patientId?: string;
};

/** Trigger S-Agent alpha scan inside PraxisOS (ARIA orchestrator) */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const tenantId = body.tenantId ?? "bypilar";
  await ensureNexusBooted(tenantId);

  const imageUrl =
    body.imageUrl?.trim() ||
    process.env.SCAN_DEMO_IMAGE_URL?.trim() ||
    "https://placehold.co/512x512/png?text=Foot+Scan";

  const result = await ariaOrchestrator.dispatch({
    type: "scan",
    imageUrl,
    imageBase64: body.imageBase64,
    tenantId,
    patientId: body.patientId ?? "demo-patient",
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || result.summary },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    summary: result.summary,
    specialist: result.specialist,
    scan: result.data,
  });
}

export async function GET() {
  const boot = await ensureNexusBooted("bypilar");
  const status = await ariaOrchestrator.dispatch({ type: "status" });
  return NextResponse.json({ ...status, nexus: boot });
}
