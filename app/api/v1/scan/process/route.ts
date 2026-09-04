import { NextResponse } from "next/server";
import { ariaOrchestrator } from "@/agents/ARIA-orchestrator";
import { ensureNexusBooted } from "@/lib/nexus/runtime";
import { getBooking } from "@/lib/bookings";
import { ensureJournalForBooking, updateJournalEntry } from "@/lib/journal";
import type { AlphaScanResult } from "@/lib/scanner/alpha-pipeline";
import { secretsPublicStatus } from "@/lib/secrets";
import { auditLogWithContext } from "@/lib/audit";
import {
  jsonAuthFail,
  requireRole,
  resolveRequestAuth,
  type AuthOk,
} from "@/lib/request-auth";
import { assertConsent } from "@/lib/consent";

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
  // Staff-only clinical scan — was unauthenticated (biometri + AI without login).
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, [
    "practitioner",
    "owner",
    "support",
  ]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);
  const session = auth as AuthOk;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const booking = body.bookingId ? getBooking(body.bookingId) : undefined;
  const requestedTenant = body.tenantId ?? booking?.tenant ?? "bypilar";
  // Tenant must come from verified session, not free body — support may cross.
  if (
    session.tenant !== requestedTenant &&
    session.role !== "support"
  ) {
    return NextResponse.json({ error: "tenant_mismatch" }, { status: 403 });
  }
  const tenantId = requestedTenant;
  const patientId = body.patientId ?? booking?.clientId ?? "demo-patient";

  // Consent gate (P0 §D.3) — photo capture + AI processing BEFORE inference.
  const photoConsent = assertConsent({
    tenantId,
    clientId: patientId,
    purpose: "photo_capture",
    actorUserId: session.accountId,
  });
  if (!photoConsent.ok) return NextResponse.json(photoConsent.body, { status: photoConsent.status });
  const aiConsent = assertConsent({
    tenantId,
    clientId: patientId,
    purpose: "ai_processing",
    actorUserId: session.accountId,
  });
  if (!aiConsent.ok) return NextResponse.json(aiConsent.body, { status: aiConsent.status });

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

  // F23 · request context on clinical scan mutation audit
  auditLogWithContext(req, "scan.processed", {
    tenant_id: tenantId,
    actor_user_id: session.accountId,
    target_ref: `scan/${patientId}`,
    auth_mode: session.mode,
    meta: { mode: scan.mode, bookingId: booking?.id },
  });

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

/** Staff-only readiness for clinical scan pipeline (F24 · was unauthenticated). */
export async function GET(req: Request) {
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, [
    "practitioner",
    "owner",
    "support",
  ]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);
  const session = auth as AuthOk;

  const boot = await ensureNexusBooted(session.tenant);
  const status = await ariaOrchestrator.dispatch({ type: "status" });
  const secrets = secretsPublicStatus();
  const replicate = secrets.replicate;
  const roboflow = secrets.roboflow;
  const blockers: string[] = [];
  if (!replicate) blockers.push("REPLICATE_API_TOKEN mangler — 3D-mesh falder tilbage til anatomisk demo");
  if (!roboflow) blockers.push("ROBOFLOW_API_KEY mangler — segmentering/pathology fail-closed");
  const notes: string[] = [];
  if (!secrets.openai) {
    notes.push(
      "OPENAI_API_KEY mangler — valgfri for live scan; kræves til LLM-agentsvar (ingen rebuild: /scan eller /admin/bird).",
    );
  }
  // F26-adjacent: never echo raw secret values — booleans + short hints only.
  return NextResponse.json({
    ...status,
    nexus: boot,
    tenant: session.tenant,
    pipeline: "del-pilar-nexus",
    providers: {
      replicate,
      roboflow,
      openai: secrets.openai,
      replicateHint: secrets.replicateHint,
      roboflowHint: secrets.roboflowHint,
      openaiHint: secrets.openaiHint,
      meshModel: process.env.REPLICATE_MESH_MODEL?.trim() || "firtoz/trellis",
      segmentModel:
        process.env.ROBOFLOW_SEGMENT_MODEL?.trim() || "foot-segmentation-ehn9q/1",
      pathologyModel: process.env.ROBOFLOW_MODEL?.trim() || "foot-ulcer/1",
      pathologyModelSecondary:
        process.env.ROBOFLOW_MODEL_SECONDARY?.trim() || "wounds-detection/1",
    },
    liveReady: secrets.liveScanReady,
    llmReady: secrets.openai,
    blockers,
    notes,
  });
}
