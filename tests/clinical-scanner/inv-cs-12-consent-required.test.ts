// INV-CS-12 · samtykke er påkrævet før scan-upload
// Kontrakt: app/api/v1/[tenant]/scans/upload/route.ts · GDPR Art. 30 · Corti 4-lags samtykke
//
// Beviser at POST /api/v1/[tenant]/scans/upload:
//   (a) uden consent_given -> 403 CONSENT_REQUIRED, pipeline køres ALDRIG,
//       og der emittes et audit-error-record med reason_code "INV-CS-12".
//   (b) med consent_given: true -> pipeline køres, og der emittes et
//       audit-info-record der bekræfter samtykket.
//
// TARGET PATH (i praxisos/prototype-repoet, IKKE i denne worktree):
//   tests/clinical-scanner/inv-cs-12-consent-required.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";

const runPipelineSpy = vi.fn(async () => ({
  status: "done" as const,
  denseMeshUrl: "stub://mesh",
  watertight: true,
  qualityScore: 1,
  findings: { ai_generated: true } as never,
  gpuSeconds: 0,
  latencyMs: 0,
}));

vi.mock("@/lib/scanner/pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scanner/pipeline")>();
  return {
    ...actual,
    runPipeline: runPipelineSpy,
  };
});

async function POST(...args: any[]) {
  const mod = await import("@/app/api/v1/[tenant]/scans/upload/route");
  return (mod.POST as any)(...args);
}

function makeReq(body: unknown, tenant = "bypilar") {
  return new NextRequest(`http://localhost:3000/api/v1/${tenant}/scans/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  } as any);
}

beforeEach(() => {
  runPipelineSpy.mockClear();
  process.env.AGENT_SCANNER_V2_ENABLED = "true";
  delete process.env.PRAXIS_AUDIT_MODE; // -> default 'memory' sink
  // runPipeline is mocked above so these never actually execute a live
  // caller, but keep createDefaultLifter()/createDefaultVlmCaller() (called
  // by the route to BUILD the args passed into the mock) hermetic in case
  // real API keys happen to be present in the shell env.
  process.env.PRAXIS_LLM_MODE = "stub";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.REPLICATE_API_TOKEN;
  _clearMemorySink();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("INV-CS-12 · samtykke påkrævet før scan-upload", () => {
  it("(a) manglende consent_given -> 403 CONSENT_REQUIRED, pipeline køres ikke, audit-error med reason_code INV-CS-12", async () => {
    const req = makeReq({
      scan_id: "scan_test_1",
      client_id: "client_1",
      frames_count: 24,
      calibration_mode: "monocular",
      // consent_given udeladt
      actor_user_id: "acc_ema",
    });

    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("CONSENT_REQUIRED");
    expect(runPipelineSpy).not.toHaveBeenCalled();

    const denied = _readMemorySink().find(
      (r) => r.event === "scan.upload.consent.denied",
    );
    expect(denied).toBeDefined();
    expect(denied?.level).toBe("error");
    expect(denied?.meta.reason_code).toBe("INV-CS-12");
    expect(denied?.tenant_id).toBe("bypilar");
    expect(denied?.target_ref).toBe("scan/scan_test_1");
  });

  it("(b) consent_given: true -> pipeline køres, audit bekræfter samtykke, 200 fra pipeline-resultat", async () => {
    const req = makeReq({
      scan_id: "scan_test_2",
      client_id: "client_2",
      frames_count: 30,
      calibration_mode: "aruco",
      consent_given: true,
      actor_user_id: "acc_ema",
    });

    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.scan_id).toBe("scan_test_2");
    expect(runPipelineSpy).toHaveBeenCalledTimes(1);

    const confirmed = _readMemorySink().find(
      (r) => r.event === "scan.upload.consent",
    );
    expect(confirmed).toBeDefined();
    expect(confirmed?.level).toBe("info");
    expect(confirmed?.meta.consent_given).toBe(true);
    expect(confirmed?.tenant_id).toBe("bypilar");
  });
});
