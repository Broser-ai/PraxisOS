import { describe, expect, it, vi } from "vitest";
import {
  computeCaptureGateShadow,
  isCaptureGateShadowEnabled,
  peekJpegDimensions,
  scheduleCaptureGateShadow,
} from "@/lib/scanner/capture-gate";
import { scoreScanQuality } from "@/lib/scanner/quality";

describe("CaptureGate-Σ (shadow only)", () => {
  it("flag defaults OFF", () => {
    expect(isCaptureGateShadowEnabled({})).toBe(false);
    expect(isCaptureGateShadowEnabled({ PRAXIS_CAPTURE_GATE_SHADOW: "true" })).toBe(
      true,
    );
  });

  it("emits structured proxies without driving PASS/HOLD", () => {
    const card = computeCaptureGateShadow({
      imageBytes: 180_000,
      footDetected: true,
      footBBox: { x: 0.2, y: 0.15, width: 0.55, height: 0.7 },
      previewStats: { meanLuma: 128, laplacianVar: 420, width: 1280, height: 960 },
      scanId: "test-scan-1",
    });

    expect(card.event).toBe("vision.capture_gate.shadow");
    expect(card.used_for_quality_gate).toBe(false);
    expect(card.drives_pass_hold).toBe(false);
    expect(card.used_for_routing).toBe(false);
    expect(card.blur_proxy).toBeGreaterThan(0.5);
    expect(card.exposure_proxy).toBeGreaterThan(0.8);
    expect(card.crop_foot_ratio).toBeCloseTo(0.385, 2);
    expect(card.slice_tags).toContain("usable_view");
    expect(["low", "med", "high"]).toContain(card.uncertainty_band);
  });

  it("marks unusable / high uncertainty when no foot", () => {
    const card = computeCaptureGateShadow({
      imageBytes: 40_000,
      footDetected: false,
      previewStats: { meanLuma: 30, laplacianVar: 40, width: 800, height: 600 },
    });
    expect(card.crop_foot_ratio).toBe(0);
    expect(card.slice_tags).toContain("unusable_view");
    expect(card.uncertainty_band).toBe("high");
  });

  it("does not change scoreScanQuality PASS when CaptureGate is poor", () => {
    const quality = scoreScanQuality({
      meshUrl: "https://replicate.delivery/example/mesh.glb",
      findings: [],
      notes: ["Roboflow", "Replicate"],
      imageBytes: 120_000,
      footDetected: true,
      meshPolledOk: true,
    });
    const card = computeCaptureGateShadow({
      imageBytes: 20_000,
      footDetected: true,
      previewStats: { meanLuma: 240, laplacianVar: 10, width: 1600, height: 1200 },
    });
    expect(quality.pass).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(70);
    expect(card.drives_pass_hold).toBe(false);
    expect(card.slice_tags.some((t) => t === "possible_blur" || t === "lighting_harsh")).toBe(
      true,
    );
  });

  it("schedule skips audit payload when flag off; logs when on", () => {
    const log = vi.fn();
    const error = vi.fn();
    const skipped = scheduleCaptureGateShadow(
      { imageBytes: 100_000, footDetected: true, scanId: "s1" },
      { flagEnabled: false, audit: { log, error } },
    );
    expect(skipped).toBeNull();
    expect(log).toHaveBeenCalledWith(
      "vision.capture_gate.skipped",
      expect.objectContaining({ skip_reason: "flag_off", drives_pass_hold: false }),
    );

    const card = scheduleCaptureGateShadow(
      { imageBytes: 100_000, footDetected: true, scanId: "s2" },
      { flagEnabled: true, audit: { log, error } },
    );
    expect(card?.event).toBe("vision.capture_gate.shadow");
    expect(log).toHaveBeenCalledWith(
      "vision.capture_gate.shadow",
      expect.objectContaining({ drives_pass_hold: false }),
    );
  });

  it("peekJpegDimensions returns null on non-jpeg", () => {
    expect(peekJpegDimensions("not-a-jpeg")).toBeNull();
    expect(peekJpegDimensions(undefined)).toBeNull();
  });
});
