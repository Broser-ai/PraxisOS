// Del Pilar Nexus · S-Agent clinical scan pipeline
// Level 1: Roboflow foot isolation · Level 2: pathology VLM · Level 3: Replicate 3D lift · MonoMSK
// Shadow eval (optional): parallel custom endpoints — never used for routing/quality/patient copy.
import { MonoMSKSolver, type KinematicOutput } from "@/lib/physics/mono-msk-tensor";
import { scheduleCaptureGateShadow } from "@/lib/scanner/capture-gate";
import {
  attachQuality,
  isRemoteMeshUrl,
  scoreScanQuality,
  type ScanQualityReport,
} from "@/lib/scanner/quality";
import { scheduleShadowEval } from "@/lib/scanner/shadow-inference";
import { scheduleTriViewShadow } from "@/lib/scanner/triview-lift";
import { resolveSecret } from "@/lib/secrets";

export type MedicalFinding = {
  class: string;
  confidence: number;
  x?: number;
  y?: number;
  z?: number;
  width?: number;
  height?: number;
  source?: "segment" | "pathology" | "demo";
  ai_generated?: boolean;
};

export type AlphaScanResult = {
  meshUrl: string;
  medicalFindings: MedicalFinding[];
  biomechanics: KinematicOutput;
  mode: "live" | "demo";
  timestamp: string;
  notes: string[];
  quality?: ScanQualityReport;
  previewImageUrl?: string;
  segmentation?: { detected: boolean; confidence?: number };
};

function replicateToken(): string {
  return resolveSecret("REPLICATE_API_TOKEN");
}

function roboflowToken(): string {
  return resolveSecret("ROBOFLOW_API_KEY");
}

function stripDataUrl(b64: string): string {
  return b64.replace(/^data:image\/\w+;base64,/, "");
}

function estimateBytes(b64: string): number {
  if (!b64) return 0;
  return Math.floor((stripDataUrl(b64).length * 3) / 4);
}

type ReplicatePrediction = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: string;
  urls?: { get?: string };
};

function extractMeshUrl(output: unknown): string | null {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const hit = extractMeshUrl(item);
      if (hit) return hit;
    }
  }
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    for (const key of ["mesh", "model", "glb", "obj", "ply", "url", "output"]) {
      const hit = extractMeshUrl(o[key]);
      if (hit) return hit;
    }
  }
  return null;
}

async function pollReplicate(getUrl: string, token: string, maxMs = 90_000): Promise<ReplicatePrediction> {
  const started = Date.now();
  let last: ReplicatePrediction = {};
  while (Date.now() - started < maxMs) {
    const res = await fetch(getUrl, {
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
    });
    last = (await res.json().catch(() => ({}))) as ReplicatePrediction;
    if (last.status === "succeeded" || last.status === "failed" || last.status === "canceled") {
      return last;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { ...last, status: "timeout", error: "Replicate poll timeout" };
}

export class AlphaSpatiotemporalPipeline {
  private mskSolver = new MonoMSKSolver();

  /** Level 1 — isolate foot (domain-specific segmentation) */
  async segmentFoot(imageBase64: string): Promise<{
    detected: boolean;
    confidence: number;
    note: string;
    maskPreview?: string;
  }> {
    const token = roboflowToken();
    if (!token || !imageBase64) {
      return {
        detected: Boolean(imageBase64),
        confidence: imageBase64 ? 0.55 : 0,
        note: token ? "Ingen base64 til segmentering" : "ROBOFLOW_API_KEY mangler — segment-skip",
      };
    }

    const model =
      process.env.ROBOFLOW_SEGMENT_MODEL?.trim() ||
      "foot-segmentation-ehn9q/1";

    try {
      const res = await fetch(
        `https://detect.roboflow.com/${model}?api_key=${encodeURIComponent(token)}`,
        {
          method: "POST",
          body: stripDataUrl(imageBase64),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );
      const data = (await res.json().catch(() => null)) as {
        predictions?: Array<{ confidence?: number; class?: string }>;
        message?: string;
      } | null;

      if (!res.ok) {
        return {
          detected: true,
          confidence: 0.4,
          note: `Segment HTTP ${res.status} — fortsætter med rå billede`,
        };
      }

      const preds = data?.predictions ?? [];
      const best = preds.reduce((m, p) => Math.max(m, p.confidence ?? 0), 0);
      const detected = preds.length > 0 || best >= 0.35;
      return {
        detected: detected || preds.length === 0, // empty model response ≠ hard fail
        confidence: best || (preds.length === 0 ? 0.6 : 0),
        note:
          preds.length > 0
            ? `Fod-segmentering: ${preds.length} region(er), conf ${Math.round(best * 100)}%`
            : "Segment-model returnerede ingen maske — bruger fuldt frame",
      };
    } catch (e) {
      return {
        detected: true,
        confidence: 0.35,
        note: `Segment fejl: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  }

  /** Level 2 — pathology / dermatology detections */
  async extractClinicalFindings(imageBase64: string): Promise<{
    findings: MedicalFinding[];
    note: string;
  }> {
    const token = roboflowToken();
    if (!token) {
      return { findings: [], note: "ROBOFLOW_API_KEY mangler — ingen pathology (fail-closed)" };
    }
    if (!imageBase64) {
      return { findings: [], note: "Ingen imageBase64 — springer pathology over" };
    }

    const models = [
      process.env.ROBOFLOW_MODEL?.trim() || "foot-ulcer/1",
      process.env.ROBOFLOW_MODEL_SECONDARY?.trim() || "wounds-detection/1",
    ].filter(Boolean) as string[];

    const all: MedicalFinding[] = [];
    const notes: string[] = [];

    for (const model of models) {
      try {
        const res = await fetch(
          `https://detect.roboflow.com/${model}?api_key=${encodeURIComponent(token)}`,
          {
            method: "POST",
            body: stripDataUrl(imageBase64),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          },
        );
        const data = (await res.json().catch(() => null)) as {
          predictions?: Array<MedicalFinding & { class?: string; confidence?: number }>;
        } | null;

        if (!res.ok) {
          notes.push(`${model}: HTTP ${res.status}`);
          continue;
        }

        const preds = (data?.predictions ?? []).map((p) => ({
          class: p.class || "finding",
          confidence: p.confidence ?? 0,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          z: 0.35,
          source: "pathology" as const,
          ai_generated: true,
        }));
        all.push(...preds);
        notes.push(`${model}: ${preds.length} fund`);
      } catch (e) {
        notes.push(`${model}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    // Deduplicate overlapping class names keeping highest confidence
    const byClass = new Map<string, MedicalFinding>();
    for (const f of all) {
      const prev = byClass.get(f.class);
      if (!prev || (f.confidence ?? 0) > (prev.confidence ?? 0)) byClass.set(f.class, f);
    }

    return {
      findings: [...byClass.values()].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)),
      note: notes.join(" · ") || "Pathology completed",
    };
  }

  /**
   * Level 3 — 2D→3D geometric lifting via Replicate model predictions API
   * Uses /v1/models/{owner}/{name}/predictions so we don't need a pinned version hash.
   */
  async extractGeometryWithPriors(imageUrl: string): Promise<{
    meshUrl: string;
    note: string;
    polledOk: boolean;
  }> {
    const token = replicateToken();
    if (!token) {
      return {
        meshUrl: "procedural://anatomical-foot",
        note: "REPLICATE_API_TOKEN mangler — anatomisk demo-mesh (ikke klinisk)",
        polledOk: false,
      };
    }

    if (!imageUrl || /placehold\.co/i.test(imageUrl)) {
      return {
        meshUrl: "procedural://anatomical-foot",
        note: "Afvist: placeholder-billede kan ikke give klinisk 3D",
        polledOk: false,
      };
    }

    // Prefer explicit owner/name; fall back to common image→3D models
    const modelRef =
      process.env.REPLICATE_MESH_MODEL?.trim() ||
      process.env.REPLICATE_MESH_VERSION?.trim() ||
      "firtoz/trellis";

    const ownerName = modelRef.includes("/")
      ? modelRef.replace(/:.*$/, "")
      : "firtoz/trellis";
    const [owner, name] = ownerName.split("/");

    try {
      // Prefer models API (no version hash required)
      const startRes = await fetch(
        `https://api.replicate.com/v1/models/${owner}/${name}/predictions`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
            Prefer: "wait",
          },
          body: JSON.stringify({
            input: {
              image: imageUrl,
              images: [imageUrl],
              // common optional knobs ignored by models that don't use them
              texture_size: 1024,
              mesh_simplify: 0.95,
            },
          }),
        },
      );

      let pred = (await startRes.json().catch(() => ({}))) as ReplicatePrediction;

      // Fallback: classic versioned predictions if models API rejects
      if (!startRes.ok && process.env.REPLICATE_MESH_VERSION?.includes(":")) {
        const version = process.env.REPLICATE_MESH_VERSION.trim();
        const vRes = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
            Prefer: "wait",
          },
          body: JSON.stringify({ version, input: { image: imageUrl } }),
        });
        pred = (await vRes.json().catch(() => ({}))) as ReplicatePrediction;
        if (!vRes.ok) {
          return {
            meshUrl: "procedural://anatomical-foot",
            note: `Replicate HTTP ${vRes.status}: ${pred.error ?? "start failed"}`,
            polledOk: false,
          };
        }
      } else if (!startRes.ok) {
        return {
          meshUrl: "procedural://anatomical-foot",
          note: `Replicate HTTP ${startRes.status}: ${pred.error ?? ownerName}`,
          polledOk: false,
        };
      }

      if (pred.status !== "succeeded" && pred.urls?.get) {
        pred = await pollReplicate(pred.urls.get, token);
      }

      if (pred.status === "failed" || pred.status === "canceled" || pred.status === "timeout") {
        return {
          meshUrl: "procedural://anatomical-foot",
          note: `Replicate ${pred.status}: ${pred.error ?? "no mesh"}`,
          polledOk: false,
        };
      }

      const meshUrl = extractMeshUrl(pred.output);
      if (meshUrl) {
        return {
          meshUrl,
          note: `3D lift OK · ${ownerName} · mesh klar`,
          polledOk: true,
        };
      }

      return {
        meshUrl: "procedural://anatomical-foot",
        note: "Replicate succeeded uden mesh-URL i output",
        polledOk: false,
      };
    } catch (e) {
      return {
        meshUrl: "procedural://anatomical-foot",
        note: `Replicate exception: ${e instanceof Error ? e.message : "error"}`,
        polledOk: false,
      };
    }
  }

  /** Landmark-ish stream from findings + plantar priors (better than pure noise) */
  synthesizeStreamFromFindings(findings: MedicalFinding[]): Float32Array[] {
    const landmarks = [
      { name: "heel", x: 0.5, y: 0.85, z: 0.05 },
      { name: "arch", x: 0.45, y: 0.55, z: 0.09 },
      { name: "ball", x: 0.5, y: 0.28, z: 0.04 },
      { name: "hallux", x: 0.62, y: 0.12, z: 0.03 },
      { name: "fifth", x: 0.32, y: 0.18, z: 0.03 },
      { name: "navicular", x: 0.42, y: 0.48, z: 0.07 },
      { name: "lateral", x: 0.28, y: 0.5, z: 0.05 },
      { name: "medial", x: 0.68, y: 0.5, z: 0.06 },
    ];

    const frames: Float32Array[] = [];
    for (let f = 0; f < 24; f++) {
      const arr = new Float32Array(landmarks.length * 3);
      const gait = Math.sin((f / 24) * Math.PI); // stance compression
      landmarks.forEach((lm, i) => {
        const near = findings.find((find) => {
          if (find.x == null || find.y == null) return false;
          const dx = find.x / 100 - lm.x;
          const dy = find.y / 100 - lm.y;
          return dx * dx + dy * dy < 0.04;
        });
        const pressure = near ? 0.02 + (near.confidence ?? 0.5) * 0.05 : 0;
        arr[i * 3] = (lm.x - 0.5) * 0.08 + (near ? ((near.x ?? 50) / 100 - 0.5) * 0.01 : 0);
        arr[i * 3 + 1] = 0;
        arr[i * 3 + 2] = lm.z - gait * 0.015 - pressure;
      });
      frames.push(arr);
    }
    return frames;
  }

  async executeAlphaScan(
    imageUrl: string,
    imageBase64: string,
    tenantId: string,
    patientId: string,
  ): Promise<AlphaScanResult> {
    const notes: string[] = [];
    const imageBytes = estimateBytes(imageBase64);

    // SHADOW_ONLY parallel eval — fire-and-forget; never feeds quality/findings/routing.
    // Requires PRAXIS_SHADOW_EVAL_ENABLED + privacy-gate; default OFF / fail-closed.
    scheduleShadowEval({ imageBase64, tenantId, patientId });

    // Parallel: segment + pathology + 3D (legacy Universe / Replicate pins — live path)
    const [segment, clinical, geometry] = await Promise.all([
      this.segmentFoot(imageBase64),
      this.extractClinicalFindings(imageBase64),
      this.extractGeometryWithPriors(imageUrl),
    ]);

    notes.push(segment.note, clinical.note, geometry.note);

    const stream = this.synthesizeStreamFromFindings(clinical.findings);
    const biomechanics = await this.mskSolver.computeInternalJointForces(
      stream,
      tenantId,
      patientId,
    );

    const providersLive = Boolean(replicateToken() || roboflowToken());
    const draft: AlphaScanResult = {
      meshUrl: geometry.meshUrl,
      medicalFindings: clinical.findings.map((f) => ({ ...f, ai_generated: true })),
      biomechanics,
      mode: providersLive && isRemoteMeshUrl(geometry.meshUrl) ? "live" : "demo",
      timestamp: new Date().toISOString(),
      notes,
      previewImageUrl: imageUrl.startsWith("data:") ? undefined : imageUrl,
      segmentation: { detected: segment.detected, confidence: segment.confidence },
    };

    const quality = scoreScanQuality({
      meshUrl: geometry.meshUrl,
      findings: clinical.findings,
      notes,
      imageBytes,
      footDetected: segment.detected,
      meshPolledOk: geometry.polledOk,
    });

    // CaptureGate-Σ — parallel shadow signals only; never drives PASS/HOLD (threshold 70).
    scheduleCaptureGateShadow({
      imageBase64,
      imageBytes,
      footDetected: segment.detected,
      tenantId,
    });

    // TriView-Lift — InstantMesh A/B scaffold; live TRELLIS pin unchanged (flag default OFF).
    scheduleTriViewShadow({
      imageBase64,
      trellisGlbUrl: isRemoteMeshUrl(geometry.meshUrl) ? geometry.meshUrl : null,
      tenantId,
    });

    return attachQuality(draft, quality);
  }
}
