import { NextResponse } from "next/server";
import { ariaOrchestrator } from "@/agents/ARIA-orchestrator";
import { ensureNexusBooted } from "@/lib/nexus/runtime";
import { getBooking } from "@/lib/bookings";
import { ensureJournalForBooking, updateJournalEntry } from "@/lib/journal";
import type { AlphaScanResult } from "@/lib/scanner/alpha-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  imageUrl?: string;
  imageBase64?: string;
  tenantId?: string;
  patientId?: string;
  patientName?: string;
  bookingId?: string;
};

/** by Pilar clinical scan · S-Agent + ARIA inside PraxisOS */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const booking = body.bookingId ? getBooking(body.bookingId) : undefined;
  const tenantId = body.tenantId ?? booking?.tenant ?? "bypilar";
  const patientId = body.patientId ?? booking?.clientId ?? "demo-patient";

  await ensureNexusBooted(tenantId);

  const imageUrl =
    body.imageUrl?.trim() ||
    process.env.SCAN_DEMO_IMAGE_URL?.trim() ||
    "https://placehold.co/512x512/png?text=by+Pilar+fod";

  const result = await ariaOrchestrator.dispatch({
    type: "scan",
    imageUrl,
    imageBase64: body.imageBase64,
    tenantId,
    patientId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || result.summary },
      { status: 500 },
    );
  }

  const scan = result.data as AlphaScanResult;
  let journalId: string | undefined;

  if (booking) {
    try {
      const entry = await ensureJournalForBooking(booking.id);
      journalId = entry.id;
      const findingLine = scan.medicalFindings
        .map((f) => `${f.class} (${Math.round(f.confidence * 100)}%)`)
        .join(", ");
      await updateJournalEntry(entry.id, {
        soap: {
          ...entry.soap,
          O: [
            entry.soap.O,
            `Nexus 4D fod-scan (${scan.mode}): arch strain ${scan.biomechanics.archStrainMPa} MPa, torsion ${scan.biomechanics.jointTorsionNm} N·m.`,
            findingLine ? `Findings: ${findingLine}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          A: scan.biomechanics.isCritical
            ? "Forhøjet biomekanisk belastning — behandler vurderer opfølgning."
            : entry.soap.A || "Scan uden kritiske biomekaniske flags i denne session.",
          P:
            entry.soap.P ||
            "Scan arkiveret. Eventuel indlæg/opfølgning aftales med behandler.",
        },
      });
    } catch {
      // journal optional — scan still succeeds
    }
  }

  return NextResponse.json({
    ok: true,
    summary: result.summary,
    specialist: result.specialist,
    tenantId,
    patientId,
    bookingId: booking?.id,
    journalId,
    scan,
  });
}

export async function GET() {
  const boot = await ensureNexusBooted("bypilar");
  const status = await ariaOrchestrator.dispatch({ type: "status" });
  return NextResponse.json({ ...status, nexus: boot, tenant: "bypilar" });
}
