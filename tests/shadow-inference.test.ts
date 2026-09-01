import { afterEach, describe, expect, it, vi } from "vitest";
import {
  _clearMemorySink,
  _readMemorySink,
} from "@/lib/audit";
import { evaluatePrivacyGate, isPrivacyGateOpen } from "@/lib/scanner/privacy-gate";
import {
  SHADOW_EVAL_FLAG,
  hashScanRef,
  isShadowEvalEnabled,
  runShadowEval,
  scheduleShadowEval,
} from "@/lib/scanner/shadow-inference";
import {
  ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING,
  ROBOFLOW_SHADOW_WORKFLOW_ID,
  listShadowParallelInferenceEndpoints,
} from "@/lib/scanner/shadow-workflow";
import { AlphaSpatiotemporalPipeline } from "@/lib/scanner/alpha-pipeline";

const openPrivacyEnv = {
  privateProject: "true",
  euRouteDocumented: "true",
  dpaSigned: "true",
  residencyReviewed: "true",
  retentionPolicySet: "true",
  humanApprover: "Broser",
  privacyAuditEventId: "privacy.audit.test-001",
};

function mockFetchOk(): typeof fetch {
  return vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    const isSeg = u.includes("praxisos-foot-seg");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        predictions: isSeg
          ? [{ class: "foot", confidence: 0.91, x: 1, y: 2, width: 3, height: 4 }]
          : [
              {
                class: "candidate_open_wound",
                confidence: 0.77,
                x: 10,
                y: 20,
                width: 30,
                height: 40,
              },
            ],
      }),
    } as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => {
  _clearMemorySink();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("privacy-gate", () => {
  it("fails closed by default", () => {
    const result = evaluatePrivacyGate({});
    expect(result.allowed).toBe(false);
    expect(result.failReasons.length).toBeGreaterThan(0);
    expect(isPrivacyGateOpen({})).toBe(false);
  });

  it("opens only when every checklist item is set", () => {
    expect(evaluatePrivacyGate(openPrivacyEnv).allowed).toBe(true);
    expect(
      evaluatePrivacyGate({ ...openPrivacyEnv, dpaSigned: "" }).allowed,
    ).toBe(false);
  });
});

describe("shadow eval flag", () => {
  it("defaults OFF", () => {
    vi.stubEnv(SHADOW_EVAL_FLAG, undefined as unknown as string);
    expect(isShadowEvalEnabled({})).toBe(false);
    expect(isShadowEvalEnabled({ [SHADOW_EVAL_FLAG]: "false" })).toBe(false);
    expect(isShadowEvalEnabled({ [SHADOW_EVAL_FLAG]: "true" })).toBe(true);
  });
});

describe("runShadowEval", () => {
  it("flag off → no Roboflow call", async () => {
    const fetchFn = vi.fn();
    const outcome = await runShadowEval(
      { imageBase64: "abc", tenantId: "t1", patientId: "p1" },
      { flagEnabled: false, privacyEnv: openPrivacyEnv, fetchFn, apiKey: "k" },
    );
    expect(outcome.status).toBe("skipped");
    if (outcome.status === "skipped") {
      expect(outcome.reason).toBe("flag_off");
    }
    expect(fetchFn).not.toHaveBeenCalled();
    expect(outcome.record.approved_for_active_routing).toBe(true);
    expect(outcome.record.used_for_routing).toBe(false);
  });

  it("privacy gate blocks → no Roboflow call and logs reason", async () => {
    const fetchFn = vi.fn();
    const outcome = await runShadowEval(
      { imageBase64: "abc", tenantId: "t1", patientId: "p1" },
      {
        flagEnabled: true,
        privacyEnv: { dpaSigned: "false" },
        fetchFn,
        apiKey: "k",
      },
    );
    expect(outcome.status).toBe("skipped");
    if (outcome.status === "skipped") {
      expect(outcome.reason).toBe("privacy_gate");
      expect(outcome.record.privacy_fail_reasons?.length).toBeGreaterThan(0);
    }
    expect(fetchFn).not.toHaveBeenCalled();
    const events = _readMemorySink().filter((e) => e.event === "vision.shadow.skipped");
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("flag on + gate ok → parallel call to seg + candidates (not landmarks)", async () => {
    const fetchFn = mockFetchOk();
    const outcome = await runShadowEval(
      { imageBase64: "Zm9vZA==", tenantId: "clinic-a", patientId: "pat-9" },
      {
        flagEnabled: true,
        privacyEnv: openPrivacyEnv,
        fetchFn,
        apiKey: "rf_test",
        now: (() => {
          let t = 1000;
          return () => {
            t += 5;
            return t;
          };
        })(),
      },
    );
    expect(outcome.status).toBe("completed");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const urls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls.map((c) =>
      String(c[0]),
    );
    expect(urls.some((u) => u.includes("praxisos-foot-seg"))).toBe(true);
    expect(urls.some((u) => u.includes("praxisos-foot-candidates"))).toBe(true);
    expect(urls.some((u) => /\/praxisos\/1\?/.test(u))).toBe(false);

    if (outcome.status === "completed") {
      expect(outcome.record.workflow_id).toBe(ROBOFLOW_SHADOW_WORKFLOW_ID);
      expect(outcome.record.used_for_quality_gate).toBe(false);
      expect(outcome.record.used_for_patient_response).toBe(false);
      expect(outcome.record.endpoints).toHaveLength(2);
      expect(outcome.record.endpoints[0]?.predictions[0]?.class).toBe("foot");
      expect(outcome.record.endpoints[1]?.predictions[0]?.class).toBe(
        "candidate_open_wound",
      );
      expect(outcome.record.endpoints.every((e) => e.latency_ms >= 0)).toBe(
        true,
      );
    }

    const lanes = listShadowParallelInferenceEndpoints();
    expect(lanes.map((l) => l.endpoint)).toEqual([
      "praxisos-foot-seg",
      "praxisos-foot-candidates",
    ]);
  });

  it("shadow HTTP error is fail-soft (completed with ok:false, no throw)", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const outcome = await runShadowEval(
      { imageBase64: "abc", tenantId: "t1" },
      {
        flagEnabled: true,
        privacyEnv: openPrivacyEnv,
        fetchFn,
        apiKey: "k",
      },
    );
    expect(outcome.status).toBe("completed");
    if (outcome.status === "completed") {
      expect(outcome.record.endpoints.every((e) => e.ok === false)).toBe(true);
    }
  });
});

describe("scheduleShadowEval + primary pipeline isolation", () => {
  it("shadow error does not fail primary Universe pipeline", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("shadow boom");
    }) as unknown as typeof fetch;

    // schedule must never throw
    expect(() =>
      scheduleShadowEval(
        { imageBase64: "abc", tenantId: "t1", patientId: "p1" },
        {
          flagEnabled: true,
          privacyEnv: openPrivacyEnv,
          fetchFn,
          apiKey: "k",
        },
      ),
    ).not.toThrow();

    // Primary path with no tokens falls back to demo — still succeeds
    const pipeline = new AlphaSpatiotemporalPipeline();
    const result = await pipeline.executeAlphaScan(
      "https://example.com/foot.jpg",
      "",
      "tenant-x",
      "patient-y",
    );
    expect(result.medicalFindings).toEqual([]);
    expect(result.mode).toBe("demo");
    expect(result.quality).toBeDefined();
    // Shadow findings must never appear in patient/clinical findings
    expect(
      result.medicalFindings.some((f) =>
        String(f.class).startsWith("candidate_"),
      ),
    ).toBe(false);
  });
});

describe("governance invariants", () => {
  it("records approved_for_active_routing from workflow (true) without live cutover", () => {
    expect(ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING).toBe(true);
  });

  it("hashScanRef is stable short hex without raw PII in output", () => {
    const a = hashScanRef({
      tenantId: "bypilar",
      patientId: "cpr-should-not-leak",
      imageBase64: "abc123",
    });
    const b = hashScanRef({
      tenantId: "bypilar",
      patientId: "cpr-should-not-leak",
      imageBase64: "abc123",
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
    expect(a.includes("cpr")).toBe(false);
    expect(a.includes("bypilar")).toBe(false);
  });
});
