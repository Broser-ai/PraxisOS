// S-Agent · Alpha spatiotemporal pipeline (Replicate 3D + Roboflow clinical)
import { MonoMSKSolver, type KinematicOutput } from "@/lib/physics/mono-msk-tensor";

export type MedicalFinding = {
  class: string;
  confidence: number;
  x?: number;
  y?: number;
  z?: number;
  width?: number;
  height?: number;
};

export type AlphaScanResult = {
  meshUrl: string;
  medicalFindings: MedicalFinding[];
  biomechanics: KinematicOutput;
  mode: "live" | "demo";
  timestamp: string;
  notes: string[];
};

function replicateToken(): string {
  return process.env.REPLICATE_API_TOKEN?.trim() || "";
}

function roboflowToken(): string {
  return process.env.ROBOFLOW_API_KEY?.trim() || "";
}

export class AlphaSpatiotemporalPipeline {
  private mskSolver = new MonoMSKSolver();

  async extractGeometryWithPriors(imageUrl: string): Promise<{ meshUrl: string; note: string }> {
    const token = replicateToken();
    if (!token) {
      return {
        meshUrl: "procedural://foot",
        note: "REPLICATE_API_TOKEN mangler — bruger procedurel fod-mesh",
      };
    }

    const version =
      process.env.REPLICATE_MESH_VERSION?.trim() ||
      "lucataco/hunyuan3d-2:latest";

    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version,
        input: { image: imageUrl },
      }),
    });

    const data = (await res.json().catch(() => null)) as
      | { urls?: { get?: string }; output?: string | string[]; error?: string; status?: string }
      | null;

    if (!res.ok) {
      return {
        meshUrl: "procedural://foot",
        note: `Replicate HTTP ${res.status} — fallback mesh (${data?.error ?? "error"})`,
      };
    }

    const output = data?.output;
    const meshFromOutput = Array.isArray(output) ? output[0] : output;
    if (typeof meshFromOutput === "string" && meshFromOutput.length > 0) {
      return { meshUrl: meshFromOutput, note: "Replicate mesh klar" };
    }

    return {
      meshUrl: data?.urls?.get || "procedural://foot",
      note: "Replicate prediction startet — poll URL eller fallback mesh",
    };
  }

  async extractClinicalFindings(imageBase64: string): Promise<{
    findings: MedicalFinding[];
    note: string;
  }> {
    const token = roboflowToken();
    if (!token) {
      return {
        findings: demoFindings(),
        note: "ROBOFLOW_API_KEY mangler — demo findings",
      };
    }
    if (!imageBase64) {
      return { findings: [], note: "Ingen imageBase64 — springer Roboflow over" };
    }

    const model = process.env.ROBOFLOW_MODEL?.trim() || "diabetic_ulcers/1";
    const res = await fetch(`https://detect.roboflow.com/${model}?api_key=${encodeURIComponent(token)}`, {
      method: "POST",
      body: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const data = (await res.json().catch(() => null)) as
      | { predictions?: MedicalFinding[]; message?: string }
      | null;

    if (!res.ok) {
      return {
        findings: demoFindings(),
        note: `Roboflow HTTP ${res.status} — demo findings`,
      };
    }

    return {
      findings: Array.isArray(data?.predictions) ? data!.predictions! : [],
      note: "Roboflow detections klar",
    };
  }

  /** Build a short synthetic 4D stream when no depth video is provided */
  synthesizeStreamFromFindings(findings: MedicalFinding[]): Float32Array[] {
    const frames: Float32Array[] = [];
    for (let f = 0; f < 12; f++) {
      const arr = new Float32Array(24);
      for (let p = 0; p < 8; p++) {
        const finding = findings[p % Math.max(findings.length, 1)];
        const conf = finding?.confidence ?? 0.3;
        arr[p * 3] = ((finding?.x ?? 40) / 100 - 0.5) * 0.04 * (1 + f * 0.02);
        arr[p * 3 + 1] = 0;
        arr[p * 3 + 2] = 0.04 + conf * 0.06 + Math.sin(f / 3 + p) * 0.01;
      }
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
    const live = Boolean(replicateToken() || roboflowToken());

    const [geometry, clinical] = await Promise.all([
      this.extractGeometryWithPriors(imageUrl),
      this.extractClinicalFindings(imageBase64),
    ]);
    notes.push(geometry.note, clinical.note);

    const stream = this.synthesizeStreamFromFindings(clinical.findings);
    const biomechanics = await this.mskSolver.computeInternalJointForces(
      stream,
      tenantId,
      patientId,
    );

    return {
      meshUrl: geometry.meshUrl,
      medicalFindings: clinical.findings,
      biomechanics,
      mode: live ? "live" : "demo",
      timestamp: new Date().toISOString(),
      notes,
    };
  }
}

function demoFindings(): MedicalFinding[] {
  return [
    { class: "callus_risk", confidence: 0.62, x: 48, y: 72, z: 0.35, width: 12, height: 10 },
    { class: "pressure_hotspot", confidence: 0.71, x: 55, y: 80, z: 0.4, width: 9, height: 8 },
  ];
}
