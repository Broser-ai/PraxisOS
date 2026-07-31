import { describe, expect, it } from "vitest";
import {
  AGENT_DEPLOYMENT_STATUS,
  AGENT_MDR_TIER,
  canDispatchAgent,
} from "@/lib/agents";

describe("MDR · Frej consistency", () => {
  it("frej is class_0 and active (compliance gate, non-clinical)", () => {
    expect(AGENT_MDR_TIER.frej).toBe("class_0");
    expect(AGENT_DEPLOYMENT_STATUS.frej).toBe("active");
  });

  it("active agents are never class_iia", () => {
    for (const id of Object.keys(AGENT_DEPLOYMENT_STATUS) as Array<
      keyof typeof AGENT_DEPLOYMENT_STATUS
    >) {
      if (AGENT_DEPLOYMENT_STATUS[id] === "active") {
        expect(AGENT_MDR_TIER[id]).toBe("class_0");
      }
    }
  });

  it("class_iia agents require ce_marked even if mislabeled active", () => {
    // atlas is frozen + class_iia
    const blocked = canDispatchAgent("atlas", "none");
    expect(blocked.allowed).toBe(false);

    const allowed = canDispatchAgent("atlas", "ce_marked");
    expect(allowed.allowed).toBe(true);
  });

  it("frej dispatches without CE-mark", () => {
    const r = canDispatchAgent("frej", "none");
    expect(r.allowed).toBe(true);
  });
});
