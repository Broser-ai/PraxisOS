// Sprint 6 Batch 2 · Orchestrator role-source
// Verificerer at actor_role udelukkende udledes af den signerede session-cookie
// og at et modificeret `actor_role`-felt i request-body IKKE bruges.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { encodeSession, SESSION_COOKIE, type Session } from "@/lib/auth";

// Vi mocker orchestrator og LLM-adapter så vi kan observere hvilken rolle
// route'n reelt sender ind i buildOrchestrator().invoke().
const invokeSpy = vi.fn(async () => ({
  status: "ok" as const,
  finalAgent: "aria" as const,
  output: [],
  steps: [],
  tokenUsage: { prompt: 0, completion: 0 },
}));

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

describe("orchestrator route · role-source (Sprint 6 B2)", () => {
  beforeEach(() => {
    invokeSpy.mockClear();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("afviser 401 når der ingen session-cookie er", async () => {
    const req = makeReq(null, { input: "hej" });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(401);
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("afviser 401 når session tilhører en anden tenant end URL'en", async () => {
    const s: Session = {
      accountId: "acc_pilar",
      tenant: "nordlys", // <-- mismatch
      role: "owner",
      loggedInAt: "2026-07-16T10:00:00.000Z",
    };
    const token = encodeSession(s);
    const req = makeReq(`${SESSION_COOKIE}=${token}`, { input: "hej" });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(401);
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("ignorerer body.actor_role og bruger session.role", async () => {
    const s: Session = {
      accountId: "acc_ema",
      tenant: "bypilar",
      role: "reception", // begrænset rolle
      loggedInAt: "2026-07-16T10:00:00.000Z",
    };
    const token = encodeSession(s);
    const req = makeReq(`${SESSION_COOKIE}=${token}`, {
      input: "test",
      // Angreb: klient forsøger at hæve sig selv til owner via body
      actor_role: "owner",
    });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(200);
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const arg = (invokeSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0] as { actorRole: string; tenantId: string };
    expect(arg.actorRole).toBe("reception");
    expect(arg.tenantId).toBe("bypilar");
  });
});
