// INV-14 · Async-sti kontinuitet efter SYNC_DEADLINE_MS
// Kontrakt: app/api/v1/[tenant]/orchestrator/route.ts:7
//   "Async-sti: ved deadline overskridelse returneres 202 med run_id;
//    resten af run kører under waitUntil() indtil timeout."

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encodeSession, SESSION_COOKIE, type Session } from "@/lib/auth";
import { SYNC_DEADLINE_MS } from "@/lib/orchestrator";

const invokeSpy = vi.fn();

vi.mock("@/lib/orchestrator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orchestrator")>();
  return {
    ...actual,
    isOrchestrationEnabled: () => true,
    buildOrchestrator: () => ({ invoke: invokeSpy }),
  };
});

vi.mock("@/lib/llm-adapter", () => ({
  createDefaultLLMCaller: () => async () => ({ content: "", usage: { prompt: 0, completion: 0 } }),
}));

async function POST(...args: any[]) {
  const mod = await import("@/app/api/v1/[tenant]/orchestrator/route");
  return (mod.POST as any)(...args);
}

function makeReq(cookie: string | null, body: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest("http://localhost:3000/api/v1/bypilar/orchestrator", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  } as any);
}

const SESSION: Session = {
  accountId: "acc_pilar",
  tenant: "bypilar",
  role: "owner",
  loggedInAt: "2026-07-16T10:00:00.000Z",
};
const COOKIE = `${SESSION_COOKIE}=${encodeSession(SESSION)}`;

describe("orchestrator route · INV-14 async-deadline kontinuitet", () => {
  beforeEach(() => {
    invokeSpy.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("happy-path: run afsluttes før SYNC_DEADLINE_MS → 200 med fuldt run-resultat synkront", async () => {
    invokeSpy.mockResolvedValueOnce({
      status: "done",
      finalAgent: "aria",
      output: [{ role: "assistant", from: "aria", content: "hej" }],
      steps: [],
      tokenUsage: { prompt: 3, completion: 5 },
    });

    const req = makeReq(COOKIE, { input: "hej" });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.run_id).toMatch(/^run_/);
    expect(json.status).toBe("done");
    expect(json.tokenUsage).toEqual({ prompt: 3, completion: 5 });
  });

  it("failure-mode: run overskrider SYNC_DEADLINE_MS → 202 med poll_url, run stadig in-flight", async () => {
    vi.useFakeTimers();

    invokeSpy.mockImplementationOnce(() => new Promise(() => {}));

    const req = makeReq(COOKIE, { input: "langsom-opgave" });
    const resPromise = POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(SYNC_DEADLINE_MS);

    const res = await resPromise;
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.run_id).toMatch(/^run_/);
    expect(json.poll_url).toBe(`/api/v1/bypilar/orchestrator/runs/${json.run_id}`);
    expect(invokeSpy).toHaveBeenCalledTimes(1);
  });
});
