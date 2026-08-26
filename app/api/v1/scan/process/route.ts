import { NextResponse } from "next/server";
import { ariaOrchestrator } from "@/agents/ARIA-orchestrator";
import { ensureNexusBooted } from "@/lib/nexus/runtime";
import { getBooking } from "@/lib/bookings";
import { ensureJournalForBooking, updateJournalEntry } from "@/lib/journal";
import type { AlphaScanResult } from "@/lib/scanner/alpha-pipeline";
import { secretsPublicStatus } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  imageUrl?: string;
  imageBase64?: string;
  tenantId?: string;
  patientId?: string;
  patientName?: string;
  bookingId?: string;
  requireQuality?: boolean;
};

function isPlaceholder(url: string): boolean {
  return /placehold\.co|procedural:\/\//i.test(url);
}

/** Del Pilar Nexus · ARIA + S-Agent clinical scan */
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

  const imageUrl = body.imageUrl?.trim() || "";
  const imageBase64 = body.imageBase64?.trim() || "";

  if (!imageUrl && !imageBase64) {
    return NextResponse.json(
      { ok: false, error: "missing_image", summary: "Upload eller fang et fodfoto først" },
      { status: 400 },
    );
  }

  if (body.requireQuality && imageUrl && isPlaceholder(imageUrl) && !imageBase64) {
    return NextResponse.json(
      {
        ok: false,
        error: "placeholder_rejected",
        summary: "Placeholder-billeder kan ikke bruges til klinisk Nexus-scan",
      },
      { status: 400 },
    );
  }

  const effectiveUrl =
    imageUrl ||
    (imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`);

  const result = await ariaOrchestrator.dispatch({
    type: "scan",
    imageUrl: effectiveUrl,
    imageBase64: imageBase64 || (effectiveUrl.startsWith("data:") ? effectiveUrl : undefined),
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
        .map((f) => `${f.class} (${Math.round(f.confidence * 100)}%) [AI]`)
        .join(", ");
      const q = scan.quality;
      await updateJournalEntry(entry.id, {
        soap: {
          ...entry.soap,
          O: [
            entry.soap.O,
            `Del Pilar Nexus fod-scan (${scan.mode}${q ? `, ${q.grade} ${q.score}/100` : ""}): arch ${scan.biomechanics.archStrainMPa} MPa, torsion ${scan.biomechanics.jointTorsionNm} N·m.`,
            findingLine ? `AI-fund: ${findingLine}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          A: scan.biomechanics.isCritical
            ? "Forhøjet biomekanisk belastning — behandler vurderer opfølgning. AI er beslutningsstøtte."
            : entry.soap.A ||
              "Scan uden kritiske biomekaniske flags. AI-fund er forslag, ikke diagnose.",
          P:
            entry.soap.P ||
            "Scan arkiveret. Eventuel indlæg/opfølgning aftales med behandler.",
        },
      });
    } catch {
      // journal optional
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
    quality: scan.quality,
    scan,
  });
}

export async function GET() {
  const boot = await ensureNexusBooted("bypilar");
  const status = await ariaOrchestrator.dispatch({ type: "status" });
  const secrets = secretsPublicStatus();
  const replicate = secrets.replicate;
  const roboflow = secrets.roboflow;
  const blockers: string[] = [];
  if (!replicate) blockers.push("REPLICATE_API_TOKEN mangler — 3D-mesh falder tilbage til anatomisk demo");
  if (!roboflow) blockers.push("ROBOFLOW_API_KEY mangler — segmentering/pathology fail-closed");
  return NextResponse.json({
    ...status,
    nexus: boot,
    tenant: "bypilar",
    pipeline: "del-pilar-nexus",
    providers: {
      replicate,
      roboflow,
      replicateHint: secrets.replicateHint,
      roboflowHint: secrets.roboflowHint,
      meshModel: process.env.REPLICATE_MESH_MODEL?.trim() || "firtoz/trellis",
      segmentModel:
        process.env.ROBOFLOW_SEGMENT_MODEL?.trim() || "foot-segmentation-ehn9q/1",
      pathologyModel: process.env.ROBOFLOW_MODEL?.trim() || "diabetic_ulcers/1",
    },
    liveReady: secrets.liveScanReady,
    blockers,
  });
}
