import type { AlphaScanResult, MedicalFinding } from "@/lib/scanner/alpha-pipeline";

export type ScanQualityReport = {
  score: number; // 0–100
  grade: "A" | "B" | "C" | "F";
  pass: boolean;
  checks: Array<{ id: string; ok: boolean; detail: string; weight: number }>;
};

const PASS_THRESHOLD = Number(process.env.SCAN_QUALITY_THRESHOLD ?? "70");

export function isRemoteMeshUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && !/placehold|mock|procedural/i.test(url);
}

export function scoreScanQuality(input: {
  meshUrl: string;
  findings: MedicalFinding[];
  notes: string[];
  imageBytes?: number;
  footDetected?: boolean;
  meshPolledOk?: boolean;
}): ScanQualityReport {
  const checks: ScanQualityReport["checks"] = [];

  const remoteMesh = isRemoteMeshUrl(input.meshUrl);
  checks.push({
    id: "mesh_remote",
    ok: remoteMesh,
    detail: remoteMesh ? "3D-mesh fra live GPU-model" : "Ingen live mesh (demo/fallback)",
    weight: 35,
  });

  checks.push({
    id: "mesh_polled",
    ok: input.meshPolledOk !== false && remoteMesh,
    detail: input.meshPolledOk === false ? "Replicate prediction ikke færdig" : "Mesh-job afsluttet",
    weight: 15,
  });

  const footOk = input.footDetected !== false;
  checks.push({
    id: "foot_detected",
    ok: footOk,
    detail: footOk ? "Fod isoleret / detekteret" : "Ingen fod-maske — scan afvist",
    weight: 20,
  });

  const bytes = input.imageBytes ?? 0;
  const resOk = bytes === 0 || bytes >= 80_000;
  checks.push({
    id: "image_resolution",
    ok: resOk,
    detail:
      bytes === 0
        ? "Billedstørrelse ukendt (URL-input)"
        : resOk
          ? `Upload ${(bytes / 1024).toFixed(0)} KB`
          : `For lav opløsning (${(bytes / 1024).toFixed(0)} KB) — brug skarpt foto`,
    weight: 10,
  });

  const liveNotes = input.notes.some((n) => /Roboflow|Replicate|segment/i.test(n) && !/mangler|fallback|demo/i.test(n));
  checks.push({
    id: "providers_live",
    ok: liveNotes || remoteMesh,
    detail: liveNotes || remoteMesh ? "Mindst én live provider brugt" : "Kun demo-providers",
    weight: 10,
  });

  const highConf = input.findings.filter((f) => (f.confidence ?? 0) >= 0.55).length;
  checks.push({
    id: "findings_confidence",
    ok: input.findings.length === 0 || highConf > 0,
    detail:
      input.findings.length === 0
        ? "Ingen dermatologiske fund (OK)"
        : `${highConf}/${input.findings.length} findings ≥55% confidence`,
    weight: 10,
  });

  const earned = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);
  const score = Math.round(earned);
  const grade: ScanQualityReport["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= PASS_THRESHOLD ? "C" : "F";

  return {
    score,
    grade,
    pass: score >= PASS_THRESHOLD && remoteMesh && footOk,
    checks,
  };
}

export function attachQuality(result: AlphaScanResult, quality: ScanQualityReport): AlphaScanResult {
  return {
    ...result,
    quality,
    mode: quality.pass ? "live" : result.mode === "live" && !quality.pass ? "demo" : result.mode,
    notes: [
      ...result.notes,
      `Quality ${quality.grade} · ${quality.score}/100 · ${quality.pass ? "PASS" : "HOLD (ikke klinisk klar)"}`,
    ],
  };
}
