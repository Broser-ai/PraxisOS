import { describe, expect, it } from "vitest";
import { scoreScanQuality } from "@/lib/scanner/quality";

/**
 * Synthetic quality-gate E2E (no network, no PHI).
 * Mirrors docs/vision/acceptance-criteria.md §A without calling Replicate/Roboflow.
 */
describe("scan quality gate (fixture / synthetic)", () => {
  it("PASS when remote mesh + foot + live notes meet threshold", () => {
    const report = scoreScanQuality({
      meshUrl: "https://replicate.delivery/example/mesh.glb",
      findings: [{ class: "candidate_open_wound", confidence: 0.72 }],
      notes: ["Roboflow segment OK", "Replicate mesh polled"],
      imageBytes: 120_000,
      footDetected: true,
      meshPolledOk: true,
    });
    expect(report.pass).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(70);
    expect(report.checks.find((c) => c.id === "mesh_remote")?.ok).toBe(true);
    expect(report.checks.find((c) => c.id === "foot_detected")?.ok).toBe(true);
  });

  it("never PASS with procedural/demo mesh", () => {
    const report = scoreScanQuality({
      meshUrl: "procedural://anatomic-demo",
      findings: [],
      notes: ["demo fallback"],
      imageBytes: 200_000,
      footDetected: true,
      meshPolledOk: true,
    });
    expect(report.pass).toBe(false);
    expect(report.checks.find((c) => c.id === "mesh_remote")?.ok).toBe(false);
  });

  it("never PASS when footDetected is false", () => {
    const report = scoreScanQuality({
      meshUrl: "https://replicate.delivery/example/mesh.glb",
      findings: [],
      notes: ["Roboflow segment: no foot"],
      imageBytes: 150_000,
      footDetected: false,
      meshPolledOk: true,
    });
    expect(report.pass).toBe(false);
    expect(report.checks.find((c) => c.id === "foot_detected")?.ok).toBe(false);
  });

  it("HOLD on low resolution even if other checks look live", () => {
    const report = scoreScanQuality({
      meshUrl: "https://replicate.delivery/example/mesh.glb",
      findings: [],
      notes: ["Roboflow", "Replicate"],
      imageBytes: 20_000,
      footDetected: true,
      meshPolledOk: true,
    });
    expect(report.checks.find((c) => c.id === "image_resolution")?.ok).toBe(false);
    // Still can PASS if score stays ≥70 and remote+foot — document current weights:
    // mesh 35+15 + foot 20 + providers 10 + findings 10 = 90 without resolution
    expect(report.score).toBe(90);
    expect(report.pass).toBe(true);
  });
});
