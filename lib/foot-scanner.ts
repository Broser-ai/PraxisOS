// Typed client for the Python foot-scanner engine (FastAPI on :8787).
// Called from server-side route handlers (RSC/Route Handlers) so the shared
// bearer token never leaves the server.
//
// In dev, the engine may be offline. All calls guard with `isEngineOnline()`
// and fall back to deterministic stub data so the UI works without hardware.

export type Side = "L" | "R";
export type CaptureSource =
  | "phone_video"
  | "phone_photos"
  | "structured_light"
  | "laser"
  | "pressure_mat";

export type SessionStatus =
  | "capturing"
  | "reconstructing"
  | "analyzing"
  | "ready"
  | "failed";

export type Engine =
  | "colmap+open3d"
  | "neural_meshing"
  | "gaussian_splat"
  | "hybrid"
  // FOCUS fits the FIND deformable-foot model to the customer's photos for a
  // per-customer identity mesh. When the Python venv / pytorch3d isn't
  // installed on the engine host, the Python side falls back to a pre-fitted
  // FIND identity mesh and reports it via `warnings` on the result.
  | "focus";

export type MarkerType = "a4" | "letter" | "aruco" | "sam_shoe";

export type FootSession = {
  id: string;
  tenant_slug: string;
  client_id: string;
  side: Side;
  source: CaptureSource;
  marker_type: MarkerType;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  frame_count: number;
  mesh_uri: string | null;
  report_uri: string | null;
};

export type ReconstructionResult = {
  session_id: string;
  engine: Engine;
  duration_ms: number;
  mesh_uri: string;
  preview_uri: string | null;
  stats: {
    vertex_count: number;
    face_count: number;
    watertight: boolean;
    volume_ml: number | null;
    surface_area_cm2: number | null;
    bbox_mm: [number, number, number];
  };
  calibration: {
    mm_per_px: number;
    marker_confidence: number;
    method: string;
  };
  warnings: string[];
};

export type BiomechanicalReport = {
  session_id: string;
  side: Side;
  generated_at: string;
  arch_type: "high" | "normal" | "low" | "flat";
  arch_index: number;
  hallux_valgus_deg: number;
  navicular_drop_mm: number;
  forefoot_width_mm: number;
  heel_width_mm: number;
  foot_length_mm: number;
  ball_girth_mm: number;
  metrics: Array<{
    label: string;
    value: number;
    unit: string;
    flag: "ok" | "watch" | "warn" | "critical";
    note?: string | null;
  }>;
  pressure_zones: Array<{
    label: string;
    cx: number;
    cy: number;
    radius_mm: number;
    peak_kpa: number;
    dwell_ms: number;
  }>;
  clinical_summary: string;
  recommendations: string[];
  icd10_suggestions: string[];
};

export type OrthoticSpec = {
  session_id: string;
  material?: "EVA_shore45" | "EVA_shore55" | "TPU_95A" | "PLA_matte";
  arch_support_mm?: number;
  heel_cup_mm?: number;
  metatarsal_pad?: boolean;
  metatarsal_pad_thickness_mm?: number;
  heel_wedge_deg?: number;
  forefoot_wedge_deg?: number;
  top_cover?: "none" | "leather" | "poron" | "cambrelle";
  print_style?: "fdm" | "sla" | "cnc_mill" | "vacuum_form";
};

export type OrthoticArtifact = {
  session_id: string;
  stl_uri: string;
  scad_uri: string;
  manufacturing_notes: string;
  estimated_print_hours: number;
  spec: OrthoticSpec;
};

const ENGINE_URL = process.env.FOOT_SCANNER_URL ?? "http://localhost:8787";

// Sprint 6 · B5: FOOT_SCANNER_TOKEN må aldrig defaulte til en dev-token
// i produktion — så eksponerer vi engine'en for enhver med URL'en. I dev
// warner vi og bruger en tydeligt markeret dev-token. Auth-hærdning
// dokumenteret i COMPLETE-AUDIT-REPORT.
function resolveEngineToken(): string {
  const token = process.env.FOOT_SCANNER_TOKEN;
  const nodeEnv = process.env.NODE_ENV;
  const isProd = nodeEnv === "production";
  if (!token) {
    if (isProd) {
      throw new Error(
        "FOOT_SCANNER_TOKEN missing in production. Refuse to talk to engine " +
        "without shared-secret auth (COMPLETE-AUDIT-REPORT · foot-scanner).",
      );
    }
    if (nodeEnv !== "test") {
      console.warn(
        "[foot-scanner] FOOT_SCANNER_TOKEN not set — using dev-token. " +
        "This will THROW in production.",
      );
    }
    return "dev-token-change-me";
  }
  return token;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${resolveEngineToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`foot-scanner engine ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// -------- health -------- //

export async function isEngineOnline(): Promise<boolean> {
  try {
    const r = await fetch(`${ENGINE_URL}/health`, { cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

// -------- sessions -------- //

export async function newSession(input: {
  tenant: string;
  clientId: string;
  side: Side;
  source?: CaptureSource;
  markerType?: MarkerType;
}): Promise<FootSession> {
  return call<FootSession>("POST", "/sessions", {
    tenant_slug: input.tenant,
    client_id: input.clientId,
    side: input.side,
    source: input.source ?? "phone_video",
    marker_type: input.markerType ?? "a4",
  });
}

export async function getSession(sessionId: string): Promise<FootSession> {
  return call<FootSession>("GET", `/sessions/${sessionId}`);
}

export async function listSessions(input: {
  tenant?: string;
  clientId?: string;
}): Promise<FootSession[]> {
  const q = new URLSearchParams();
  if (input.tenant) q.set("tenant", input.tenant);
  if (input.clientId) q.set("client_id", input.clientId);
  return call<FootSession[]>("GET", `/sessions?${q.toString()}`);
}

// -------- pipeline -------- //

export async function reconstruct(input: {
  sessionId: string;
  engine?: Engine;
  voxelSizeMm?: number;
  maxPoints?: number;
  fillHoles?: boolean;
}): Promise<ReconstructionResult> {
  return call<ReconstructionResult>(
    "POST",
    `/sessions/${input.sessionId}/reconstruct`,
    {
      session_id: input.sessionId,
      engine: input.engine ?? "colmap+open3d",
      voxel_size_mm: input.voxelSizeMm ?? 0.5,
      max_points: input.maxPoints ?? 400_000,
      fill_holes: input.fillHoles ?? true,
      symmetric_completion: true,
    },
  );
}

export async function report(sessionId: string): Promise<BiomechanicalReport> {
  return call<BiomechanicalReport>("GET", `/sessions/${sessionId}/report`);
}

export async function orthotic(spec: OrthoticSpec): Promise<OrthoticArtifact> {
  return call<OrthoticArtifact>(
    "POST",
    `/sessions/${spec.session_id}/orthotic`,
    spec,
  );
}

export function artefactUrl(sessionId: string, name: string): string {
  return `${ENGINE_URL}/sessions/${sessionId}/artefact/${name}`;
}

// -------- upload (multipart) -------- //

export async function uploadFrames(
  sessionId: string,
  files: File[] | Blob[],
): Promise<{ ok: boolean; frames: number }> {
  const form = new FormData();
  files.forEach((f, i) => {
    const name = f instanceof File ? f.name : `frame_${i}.jpg`;
    form.append("files", f, name);
  });
  const res = await fetch(
    `${ENGINE_URL}/sessions/${sessionId}/frames`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${resolveEngineToken()}` },
      body: form,
    },
  );
  if (!res.ok) {
    throw new Error(`upload failed: ${await res.text()}`);
  }
  return res.json();
}

// -------- deterministic stub for offline dev -------- //

export function stubReport(sessionId: string, side: Side): BiomechanicalReport {
  return {
    session_id: sessionId,
    side,
    generated_at: new Date().toISOString(),
    arch_type: side === "R" ? "low" : "normal",
    arch_index: side === "R" ? 0.28 : 0.24,
    hallux_valgus_deg: side === "R" ? 18.4 : 12.1,
    navicular_drop_mm: side === "R" ? 8.4 : 6.1,
    forefoot_width_mm: 102,
    heel_width_mm: 68,
    foot_length_mm: 265,
    ball_girth_mm: 228,
    metrics: [
      { label: "Foot length", value: 265, unit: "mm", flag: "ok" },
      { label: "Arch index", value: side === "R" ? 0.28 : 0.24, unit: "", flag: side === "R" ? "warn" : "ok" },
      { label: "Hallux valgus", value: side === "R" ? 18.4 : 12.1, unit: "deg", flag: side === "R" ? "warn" : "ok" },
    ],
    pressure_zones: [
      { label: "Hæl", cx: 50, cy: 18, radius_mm: 22, peak_kpa: 210, dwell_ms: 0 },
      { label: "Forfods-ballen", cx: 50, cy: 78, radius_mm: 18, peak_kpa: 242, dwell_ms: 0 },
    ],
    clinical_summary: side === "R"
      ? "Asymmetrisk overbelastning af højre forfod. Mild hallux valgus."
      : "Anatomi inden for referenceområde.",
    recommendations: side === "R"
      ? ["Medial arch-support 8 mm", "Metatarsal-pad", "Opfølgning 6 uger"]
      : ["Ingen intervention"],
    icd10_suggestions: side === "R" ? ["M20.1", "M21.4"] : [],
  };
}
