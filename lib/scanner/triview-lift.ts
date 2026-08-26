/**
 * TriView-Lift — shadow-only multi-view / InstantMesh A/B vs live TRELLIS.
 *
 * - Does NOT replace firtoz/trellis production pin.
 * - Does NOT change REPLICATE_MESH_MODEL.
 * - Feature flag PRAXIS_TRIVIEW_SHADOW_ENABLED — default OFF.
 * - Fail-soft: errors audited; live mesh path unaffected.
 */

import { createHash } from "node:crypto";
import { auditError, auditLog } from "@/lib/audit";
import { resolveSecret } from "@/lib/secrets";

export const TRIVIEW_SHADOW_FLAG = "PRAXIS_TRIVIEW_SHADOW_ENABLED" as const;

/** Live mesh pin — never swapped by this module. */
export const TRIVIEW_LIVE_MESH_PIN = "firtoz/trellis" as const;

export type TriViewFrameRole = "medial" | "plantar" | "lateral";

export type TriViewFrames = Partial<Record<TriViewFrameRole, string>>;

export type TriViewShadowArtifact = {
  event: "vision.triview.shadow";
  session_ref: string;
  trellis_glb_url: string | null;
  instantmesh_glb_url: string | null;
  hausdorff_proxy: number | null;
  latency_ms: number;
  frames_present: TriViewFrameRole[];
  winner_shadow_only: "trellis" | "instantmesh" | "tie" | "skipped" | "error";
  used_for_routing: false;
  used_for_patient_response: false;
  replaces_live_trellis: false;
  live_mesh_pin: typeof TRIVIEW_LIVE_MESH_PIN;
  skipped?: boolean;
  skip_reason?: string;
  notes: string[];
};

export type TriViewShadowInput = {
  frames?: TriViewFrames;
  /** Single plantar / primary frame when multi-view not yet collected. */
  imageBase64?: string;
  trellisGlbUrl?: string | null;
  scanId?: string;
  tenantId?: string;
};

export type TriViewShadowDeps = {
  flagEnabled?: boolean;
  fetchFn?: typeof fetch;
  replicateToken?: string;
  /** Optional InstantMesh-compatible model id — never the live TRELLIS pin. */
  instantMeshModel?: string;
  now?: () => number;
  audit?: { log: typeof auditLog; error: typeof auditError };
};

function truthyFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isTriViewShadowEnabled(
  processEnv: Record<string, string | undefined> = process.env,
): boolean {
  return truthyFlag(processEnv[TRIVIEW_SHADOW_FLAG]);
}

function stripDataUrl(b64: string): string {
  return b64.replace(/^data:image\/\w+;base64,/, "");
}

function sessionRef(input: TriViewShadowInput): string {
  const h = createHash("sha256");
  h.update(input.scanId ?? "");
  h.update("|");
  h.update(input.tenantId ?? "");
  const plantar = input.frames?.plantar ?? input.imageBase64 ?? "";
  if (plantar) h.update(stripDataUrl(plantar).slice(0, 48));
  return h.digest("hex").slice(0, 16);
}

function listFrames(frames: TriViewFrames | undefined, fallback?: string): TriViewFrameRole[] {
  const present: TriViewFrameRole[] = [];
  if (frames?.medial) present.push("medial");
  if (frames?.plantar || fallback) present.push("plantar");
  if (frames?.lateral) present.push("lateral");
  return present;
}

function baseArtifact(
  ref: string,
  trellisUrl: string | null,
  frames: TriViewFrameRole[],
): TriViewShadowArtifact {
  return {
    event: "vision.triview.shadow",
    session_ref: ref,
    trellis_glb_url: trellisUrl,
    instantmesh_glb_url: null,
    hausdorff_proxy: null,
    latency_ms: 0,
    frames_present: frames,
    winner_shadow_only: "skipped",
    used_for_routing: false,
    used_for_patient_response: false,
    replaces_live_trellis: false,
    live_mesh_pin: TRIVIEW_LIVE_MESH_PIN,
    notes: [],
  };
}

/**
 * Shadow InstantMesh A/B. When flag OFF or incomplete frames → skipped audit.
 * Never mutates live mesh selection.
 */
export async function runTriViewShadowCompare(
  input: TriViewShadowInput,
  deps: TriViewShadowDeps = {},
): Promise<TriViewShadowArtifact> {
  const audit = deps.audit ?? { log: auditLog, error: auditError };
  const now = deps.now ?? Date.now;
  const ref = sessionRef(input);
  const frames = listFrames(input.frames, input.imageBase64);
  const artifact = baseArtifact(ref, input.trellisGlbUrl ?? null, frames);

  const flagOn =
    deps.flagEnabled !== undefined
      ? deps.flagEnabled
      : isTriViewShadowEnabled();

  if (!flagOn) {
    artifact.skipped = true;
    artifact.skip_reason = "flag_off";
    artifact.notes.push("PRAXIS_TRIVIEW_SHADOW_ENABLED off — live TRELLIS unchanged");
    audit.log("vision.triview.skipped", {
      ...artifact,
      target_ref: `triview/${ref}`,
    });
    return artifact;
  }

  // Prefer full 3-frame ritual; allow single plantar for dry-run scaffolding.
  if (frames.length < 1) {
    artifact.skipped = true;
    artifact.skip_reason = "missing_frames";
    artifact.notes.push("Need ≥1 frame (ideally medial/plantar/lateral)");
    audit.log("vision.triview.skipped", {
      ...artifact,
      target_ref: `triview/${ref}`,
    });
    return artifact;
  }

  if (frames.length < 3) {
    artifact.notes.push(
      "Partial frames — full TriView ritual wants medial+plantar+lateral",
    );
  }

  const started = now();
  const token = deps.replicateToken ?? resolveSecret("REPLICATE_API_TOKEN");
  const model =
    deps.instantMeshModel ??
    process.env.PRAXIS_TRIVIEW_INSTANTMESH_MODEL?.trim() ??
    "";

  // Hard guard: never point InstantMesh env at the live TRELLIS pin.
  if (model === TRIVIEW_LIVE_MESH_PIN || model.includes("firtoz/trellis")) {
    artifact.skipped = true;
    artifact.skip_reason = "refuses_live_pin";
    artifact.notes.push("InstantMesh model must not equal live TRELLIS pin");
    artifact.winner_shadow_only = "trellis";
    audit.log("vision.triview.skipped", {
      ...artifact,
      target_ref: `triview/${ref}`,
    });
    return artifact;
  }

  if (!token || !model) {
    // Scaffold path: record contract without calling remote InstantMesh.
    artifact.latency_ms = Math.max(0, now() - started);
    artifact.skipped = true;
    artifact.skip_reason = !token ? "missing_replicate_token" : "missing_instantmesh_model";
    artifact.winner_shadow_only = artifact.trellis_glb_url ? "trellis" : "skipped";
    artifact.notes.push(
      "Shadow scaffold only — set PRAXIS_TRIVIEW_INSTANTMESH_MODEL for remote A/B",
    );
    audit.log("vision.triview.shadow", {
      ...artifact,
      target_ref: `triview/${ref}`,
      tenant_id: input.tenantId,
    });
    return artifact;
  }

  const fetchFn = deps.fetchFn ?? fetch;
  const primary =
    input.frames?.plantar ?? input.imageBase64 ?? input.frames?.medial ?? "";

  try {
    // Minimal Replicate predictions create — fail-soft; live TRELLIS already done.
    const res = await fetchFn("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Model version string supplied by Broser for InstantMesh-compatible endpoint.
        version: model,
        input: {
          image: primary.startsWith("data:")
            ? primary
            : `data:image/jpeg;base64,${stripDataUrl(primary)}`,
        },
      }),
    });
    artifact.latency_ms = Math.max(0, now() - started);
    if (!res.ok) {
      artifact.winner_shadow_only = artifact.trellis_glb_url ? "trellis" : "error";
      artifact.notes.push(`InstantMesh HTTP ${res.status} — fail-soft`);
      audit.log("vision.triview.shadow", {
        ...artifact,
        target_ref: `triview/${ref}`,
        tenant_id: input.tenantId,
      });
      return artifact;
    }
    const data = (await res.json().catch(() => null)) as {
      output?: unknown;
      urls?: { get?: string };
      id?: string;
    } | null;
    // Do not poll to completion in request path — record prediction id for offline A/B.
    const predId = data?.id ?? data?.urls?.get ?? null;
    artifact.instantmesh_glb_url =
      typeof data?.output === "string" && /^https?:\/\//i.test(data.output)
        ? data.output
        : predId
          ? `replicate://prediction/${predId}`
          : null;
    artifact.hausdorff_proxy = null; // requires offline mesh compare job
    if (artifact.instantmesh_glb_url && artifact.trellis_glb_url) {
      artifact.winner_shadow_only = "tie";
      artifact.notes.push("Both paths present — clinician/visual review decides (shadow)");
    } else if (artifact.trellis_glb_url) {
      artifact.winner_shadow_only = "trellis";
    } else if (artifact.instantmesh_glb_url) {
      artifact.winner_shadow_only = "instantmesh";
    } else {
      artifact.winner_shadow_only = "error";
    }
    audit.log("vision.triview.shadow", {
      ...artifact,
      target_ref: `triview/${ref}`,
      tenant_id: input.tenantId,
    });
    return artifact;
  } catch (e) {
    artifact.latency_ms = Math.max(0, now() - started);
    artifact.winner_shadow_only = "error";
    artifact.notes.push(e instanceof Error ? e.message : "triview_error");
    audit.error("vision.triview.error", e, {
      ...artifact,
      target_ref: `triview/${ref}`,
    });
    return artifact;
  }
}

/** Fire-and-forget; never rejects to caller. */
export function scheduleTriViewShadow(
  input: TriViewShadowInput,
  deps?: TriViewShadowDeps,
): void {
  void runTriViewShadowCompare(input, deps).catch((err) => {
    try {
      auditError("vision.triview.error", err, {
        event: "vision.triview.shadow",
        replaces_live_trellis: false,
        used_for_routing: false,
        live_mesh_pin: TRIVIEW_LIVE_MESH_PIN,
      });
    } catch {
      // never break primary
    }
  });
}
