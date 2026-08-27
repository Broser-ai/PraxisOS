import { describe, expect, it } from "vitest";
import {
  FOOT_VISION_CANARY_MAX_PERCENT,
  getFootVisionCanaryPercent,
  isActiveRoutingEnvEnabled,
  isActiveRoutingGovernanceOpen,
  isInFootVisionCanary,
  resolveLiveVisionPins,
} from "@/lib/scanner/active-routing";
import { ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING } from "@/lib/scanner/shadow-workflow";

describe("active-routing canary gate", () => {
  it("keeps governance approved but canary default 0 (Universe primary)", () => {
    expect(ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING).toBe(true);
    expect(getFootVisionCanaryPercent({})).toBe(0);
    expect(isActiveRoutingEnvEnabled({})).toBe(false);
    expect(isActiveRoutingGovernanceOpen({})).toBe(false);
    expect(isInFootVisionCanary("tenant|patient", {})).toBe(false);
  });

  it("requires env + canary > 0 before selecting custom pins", () => {
    const envOff = {
      PRAXIS_ACTIVE_ROUTING_ENABLED: "true",
      FOOT_VISION_CANARY_PERCENT: "0",
    };
    expect(isActiveRoutingGovernanceOpen(envOff)).toBe(true);
    expect(isInFootVisionCanary("tenant|patient", envOff)).toBe(false);

    const pins = resolveLiveVisionPins("tenant|patient", envOff);
    expect(pins.usingCustomCanary).toBe(false);
    expect(pins.segmentModel).toContain("foot-segmentation");
    expect(pins.pathologyModels.some((m) => m.includes("foot-ulcer"))).toBe(
      true,
    );
  });

  it("clamps canary percent to max 5", () => {
    expect(
      getFootVisionCanaryPercent({ FOOT_VISION_CANARY_PERCENT: "99" }),
    ).toBe(FOOT_VISION_CANARY_MAX_PERCENT);
  });

  it("selects custom pins only inside canary bucket when pct > 0", () => {
    const env = {
      PRAXIS_ACTIVE_ROUTING_ENABLED: "true",
      FOOT_VISION_CANARY_PERCENT: "5",
      ROBOFLOW_SHADOW_MODEL_VERSION: "1",
    };
    expect(isActiveRoutingGovernanceOpen(env)).toBe(true);

    // Empty key fail-closed
    expect(isInFootVisionCanary("", env)).toBe(false);
    expect(resolveLiveVisionPins(undefined, env).usingCustomCanary).toBe(false);

    // Deterministic: same key → same membership
    const key = "bypilar|patient-canary-probe";
    const a = isInFootVisionCanary(key, env);
    const b = isInFootVisionCanary(key, env);
    expect(a).toBe(b);

    if (a) {
      const pins = resolveLiveVisionPins(key, env);
      expect(pins.usingCustomCanary).toBe(true);
      expect(pins.segmentModel).toContain("praxisos-foot-seg");
      expect(pins.pathologyModels[0]).toContain("praxisos-foot-candidates");
      expect(pins.clinicalCopy).toMatch(/Kandidatområde/);
    }
  });
});
