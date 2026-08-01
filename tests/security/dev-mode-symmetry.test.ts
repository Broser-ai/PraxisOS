// C18 · PRAXIS_CLINICAL_DEV asymmetri-fix
//
// Verificerer at lib/agents.ts's canDispatchAgent() og lib/dev-mode.ts's
// isClinicalDevModeEnabled() altid er enige om hvornår by Pilar-bypass er
// aktiv. Før fixet krævede agents.ts kun NODE_ENV !== 'production', mens
// dev-mode.ts krævede NODE_ENV === 'production' AND VERCEL_ENV === 'production'
// for at kaste — de to lag kunne derfor drifte fra hinanden på Vercel preview
// (hvor NODE_ENV=production men VERCEL_ENV=preview).

import { afterEach, describe, expect, it } from "vitest";
import { isClinicalDevModeEnabled } from "@/lib/dev-mode";
import { canDispatchAgent } from "@/lib/agents";

const ENV_KEYS = ["NODE_ENV", "VERCEL_ENV", "PRAXIS_CLINICAL_DEV"] as const;
type EnvKey = (typeof ENV_KEYS)[number];

function snapshotEnv(): Record<EnvKey, string | undefined> {
  return {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    PRAXIS_CLINICAL_DEV: process.env.PRAXIS_CLINICAL_DEV,
  };
}

function restoreEnv(snapshot: Record<EnvKey, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else if (key === "NODE_ENV") {
      // @ts-expect-error NODE_ENV er readonly i TS-typerne
      process.env.NODE_ENV = value;
    } else {
      process.env[key] = value;
    }
  }
}

const FROZEN_CLASS_IIA_AGENT = "niels"; // AGENT_DEPLOYMENT_STATUS.niels === 'frozen'

describe("C18 · PRAXIS_CLINICAL_DEV symmetri mellem dev-mode.ts og agents.ts", () => {
  const original = snapshotEnv();

  afterEach(() => {
    restoreEnv(original);
  });

  it("(a) NODE_ENV=production AND VERCEL_ENV=production -> begge lag kaster", () => {
    // @ts-expect-error NODE_ENV er readonly i TS-typerne
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.PRAXIS_CLINICAL_DEV = "1";

    expect(() => isClinicalDevModeEnabled()).toThrow(/must NEVER run in production/);
    expect(() =>
      canDispatchAgent(FROZEN_CLASS_IIA_AGENT, "none", "bypilar"),
    ).toThrow(/must NEVER run in production/);
  });

  it("(b) NODE_ENV=production alene (Vercel preview) -> ingen af lagene kaster, matcher dev-mode.ts", () => {
    // @ts-expect-error NODE_ENV er readonly i TS-typerne
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";
    process.env.PRAXIS_CLINICAL_DEV = "1";

    expect(() => isClinicalDevModeEnabled()).not.toThrow();
    expect(isClinicalDevModeEnabled()).toBe(true);

    let result: ReturnType<typeof canDispatchAgent> | undefined;
    expect(() => {
      result = canDispatchAgent(FROZEN_CLASS_IIA_AGENT, "none", "bypilar");
    }).not.toThrow();
    expect(result).toEqual({
      allowed: true,
      reason: "class_iia agent · by Pilar clinical-dev-mode bypass (PRAXIS_CLINICAL_DEV=1)",
    });
  });

  it("(c) hverken NODE_ENV eller VERCEL_ENV er production -> begge lag tillader bypass", () => {
    // @ts-expect-error NODE_ENV er readonly i TS-typerne
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    process.env.PRAXIS_CLINICAL_DEV = "1";

    expect(isClinicalDevModeEnabled()).toBe(true);

    const result = canDispatchAgent(FROZEN_CLASS_IIA_AGENT, "none", "bypilar");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe(
      "class_iia agent · by Pilar clinical-dev-mode bypass (PRAXIS_CLINICAL_DEV=1)",
    );
  });

  it("bypass gaelder stadig KUN tenant 'bypilar' efter fixet", () => {
    // @ts-expect-error NODE_ENV er readonly i TS-typerne
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    process.env.PRAXIS_CLINICAL_DEV = "1";

    const result = canDispatchAgent(FROZEN_CLASS_IIA_AGENT, "none", "andenTenant");
    expect(result.allowed).toBe(false);
  });
});
