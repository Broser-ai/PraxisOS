import { describe, expect, it } from "vitest";
import {
  PRIVACY_GATE_DEFAULT_STATUS,
  evaluatePrivacyGate,
  getPrivacyGateStatus,
  isAgentSelfApproval,
  isPrivacyGateOpen,
  mayRunShadowOnlyImageInference,
  maySendImagesToCustomRoboflow,
  type PrivacyGateEnv,
} from "@/lib/scanner/privacy-gate";

const broserPassEnv: PrivacyGateEnv = {
  privateProject: "true",
  euRouteDocumented: "true",
  dpaSigned: "true",
  residencyReviewed: "true",
  retentionPolicySet: "true",
  humanApprover: "Broser Reviewer",
  privacyAuditEventId: "privacy.gate.passed.2026-08-26",
};

describe("privacy-gate (fail-closed)", () => {
  it("stays closed by default with no env", () => {
    const result = evaluatePrivacyGate({});
    expect(PRIVACY_GATE_DEFAULT_STATUS).toBe("closed");
    expect(result.status).toBe("closed");
    expect(result.allowed).toBe(false);
    expect(result.failReasons.length).toBe(7);
    expect(isPrivacyGateOpen({})).toBe(false);
    expect(maySendImagesToCustomRoboflow({})).toBe(false);
    expect(mayRunShadowOnlyImageInference({})).toBe(false);
    expect(getPrivacyGateStatus({})).toBe("closed");
  });

  it("passes only when every Broser checklist item is set", () => {
    const result = evaluatePrivacyGate(broserPassEnv);
    expect(result.status).toBe("passed");
    expect(result.allowed).toBe(true);
    expect(result.failReasons).toEqual([]);
    expect(mayRunShadowOnlyImageInference(broserPassEnv)).toBe(true);
  });

  it("rejects agent self-approval even if other flags are set", () => {
    expect(isAgentSelfApproval("cursor-cloud-agent")).toBe(true);
    expect(isAgentSelfApproval("Broser Reviewer")).toBe(false);

    const result = evaluatePrivacyGate({
      ...broserPassEnv,
      humanApprover: "agent",
    });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.failReasons).toContain("human_approver");
    expect(maySendImagesToCustomRoboflow({
      ...broserPassEnv,
      humanApprover: "CI",
    })).toBe(false);
  });

  it("fails closed when only some checks pass", () => {
    const result = evaluatePrivacyGate({
      privateProject: "true",
      dpaSigned: "true",
      humanApprover: "Broser",
    });
    expect(result.status).toBe("failed");
    expect(result.allowed).toBe(false);
    expect(result.failReasons).toEqual(
      expect.arrayContaining([
        "eu_route_documented",
        "residency_reviewed",
        "retention_policy_set",
        "privacy_audit_event",
      ]),
    );
  });
});
