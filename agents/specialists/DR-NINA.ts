// DR. NINA · Neural Rendering / WebGPU SSS specialist (PraxisOS swarm)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { remember } from "@/agents/memory/swarm-memory";
import { reflect } from "@/agents/journal/journal-engine";

export type NinaShaderProfile = {
  melaninFraction: number;
  haemoglobinFraction: number;
  scatterRgb: [number, number, number];
  warningHotspots: { x: number; y: number; z: number; label: string; severity: "low" | "med" | "high" }[];
};

export const NINA_ID = "nina" as const;

const DEFAULT_SHADER = /* wgsl */ `
// Biophysical Skin Inversion Shader (Spectral SSS) · fallback inline
struct Uniforms {
    lightPos: vec3<f32>,
    viewPos: vec3<f32>,
    melaninFraction: f32,
    haemoglobinFraction: f32,
};
`;

export function loadSkinSssWgsl(): string {
  const candidates = [
    join(process.cwd(), "lib/nail/shaders/skin-sss.wgsl"),
    join(process.cwd(), "src/lib/nail/shaders/skin-sss.wgsl"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return DEFAULT_SHADER;
}

export function buildShaderProfile(input?: {
  fitzpatrick?: number;
  inflammation?: number;
  findings?: { class: string; confidence: number; x?: number; y?: number; z?: number }[];
}): NinaShaderProfile {
  const fp = Math.min(6, Math.max(1, input?.fitzpatrick ?? 3));
  const inflam = Math.min(1, Math.max(0, input?.inflammation ?? 0.15));
  const findings = input?.findings ?? [];
  return {
    melaninFraction: (fp - 1) / 5,
    haemoglobinFraction: 0.15 + inflam * 0.55,
    scatterRgb: [3.67, 1.37, 0.68],
    warningHotspots: findings.map((f) => ({
      x: (f.x ?? 50) / 100,
      y: (f.y ?? 50) / 100,
      z: f.z ?? 0.4,
      label: f.class,
      severity: f.confidence > 0.75 ? "high" : f.confidence > 0.45 ? "med" : "low",
    })),
  };
}

export async function ninaRenderBrief(scanSummary: string, tenant = "bypilar") {
  const wgsl = loadSkinSssWgsl();
  const profile = buildShaderProfile();
  await remember({
    kind: "observation",
    tenant,
    text: `NINA shader brief: ${scanSummary.slice(0, 200)} · melanin=${profile.melaninFraction.toFixed(2)}`,
    meta: { agent: NINA_ID, shaderBytes: wgsl.length },
  });
  await reflect({
    agentId: NINA_ID,
    tenant,
    prompt: "Render clinical skin SSS profile",
    outcome: `profile ready · hotspots=${profile.warningHotspots.length}`,
    score: 0.7,
  });
  return { wgslPreview: wgsl.slice(0, 280), profile };
}
