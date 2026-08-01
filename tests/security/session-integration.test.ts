// Sprint 6 Batch 3 - Session integration test
// Kontrakt: COMPLETE-AUDIT-REPORT.md test-coverage login orchestrator flow
//
// Beviser at signeret session-cookie fra /api/auth/login KAN bruges direkte
// mod orchestrator-route (INV-7 rolle-scope) og at:
//   (a) roundtrip login -> orchestrator med matching tenant -> success (200)
//   (b) tamperet cookie -> 401 UNAUTHORIZED
//   (c) session for anden tenant end URL -> 401
//   (d) body.actor_role ignoreres selv naar den forsoeger role-escalation
//   (e) tampered signature detekteres uanset payload
//   (f) sessions replayes ikke paa tvaers af tenants selv med gyldigt token

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  encodeSession,
  SESSION_COOKIE,
  type Session,
} from "@/lib/auth";
import { encodeSignedSession } from "@/lib/session-token";

// Mock orchestrator saa vi kan observere hvilken rolle route'n reelt sender ind
const invokeSpy = vi.fn(async () => ({
  status: "done" as const,
  finalAgent: "aria" as const,
  output: [],
  steps: [],
  tokenUsage: { prompt: 0, completion: 0 },
}));

// Undgå importOriginal() her: route.ts's eneste runtime-afhængighed af
// "@/lib/orchestrator" er de 5 eksports nedenfor (resten er `import type`,
// slettet ved compile). importOriginal() ville ellers cold-loade den ægte
// modul-graf inkl. @langchain/langgraph (~8-18s), hvilket presser test (a)
// over vitest.config.ts's testTimeout: 20_000 under fuld sweep-belastning —
// og en killed/timed-out test (a) lader dens orphaned POST-promise resolve
// asynkront ind i test (b), som så ser invokeSpy kaldt uventet.
vi.mock("@/lib/orchestrator", () => ({
  isOrchestrationEnabled: () => true,
  buildOrchestrator: () => ({ invoke: invokeSpy }),
  SYNC_DEADLINE_MS: 8_000,
  DEFAULT_TIMEOUT_MS: 30_000,
  SCRIBE_TIMEOUT_MS: 120_000,
}));

vi.mock("@/lib/llm-adapter", () => ({
  createDefaultLLMCaller: () => async () => ({
    content: "",
    usage: { prompt: 0, completion: 0 },
  }),
}));

async function POST(...args: any[]) {
  const mod = await import("@/app/api/v1/[tenant]/orchestrator/route");
  return (mod.POST as any)(...args);
}

function makeReq(cookie: string | null, body: unknown, tenant = "bypilar") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest(`http://localhost:3000/api/v1/${tenant}/orchestrator`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  } as any);
}

const PILAR_SESSION: Session = {
  accountId: "acc_pilar",
  tenant: "bypilar",
  role: "owner",
  loggedInAt: "2026-07-16T10:00:00.000Z",
};

beforeEach(() => {
  invokeSpy.mockClear();
  process.env.AGENT_ORCHESTRATION_ENABLED = "true";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Sprint 6 B3 - Login-to-orchestrator flow (session-integration)", () => {
  it("(a) roundtrip: encodeSession -> POST orchestrator -> 200 + invoke kaldes med session.role", async () => {
    const token = encodeSession(PILAR_SESSION);
    const req = makeReq(`${SESSION_COOKIE}=${token}`, { input: "hej" });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(200);
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const arg = (invokeSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect((arg as { actorRole: string }).actorRole).toBe("owner");
    expect((arg as { tenantId: string }).tenantId).toBe("bypilar");
  });

  it("(b) tamperet payload med genbrugt signatur -> 401", async () => {
    const legit = encodeSession(PILAR_SESSION);
    const [_, sig] = legit.split(".");
    // Byt payload'en ud med en anden tenant men behold gammel sig
    const evilPayload = encodeSignedSession<Session>({
      ...PILAR_SESSION,
      tenant: "nordlys",
    }).split(".")[0];
    const evilToken = `${evilPayload}.${sig}`;
    const req = makeReq(`${SESSION_COOKIE}=${evilToken}`, { input: "hej" });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(401);
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("(c) session for anden tenant end URL -> 401", async () => {
    const nordlysSession: Session = {
      ...PILAR_SESSION,
      tenant: "nordlys",
    };
    const token = encodeSession(nordlysSession);
    const req = makeReq(`${SESSION_COOKIE}=${token}`, { input: "hej" }, "bypilar");
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(401);
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("(d) body.actor_role ignoreres - klient kan IKKE role-escalate", async () => {
    const receptionSession: Session = {
      accountId: "acc_ema",
      tenant: "bypilar",
      role: "reception",
      loggedInAt: "2026-07-16T10:00:00.000Z",
    };
    const token = encodeSession(receptionSession);
    const req = makeReq(`${SESSION_COOKIE}=${token}`, {
      input: "test",
      actor_role: "owner", // angreb
    });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(200);
    const arg = (invokeSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect((arg as { actorRole: string }).actorRole).toBe("reception");
  });

  it("(e) tampered signature (garbage) -> 401", async () => {
    const token = encodeSession(PILAR_SESSION);
    const [payload] = token.split(".");
    const fake = `${payload}.${"A".repeat(43)}`;
    const req = makeReq(`${SESSION_COOKIE}=${fake}`, { input: "hej" });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(401);
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("(f) session helt uden signatur -> 401", async () => {
    const token = encodeSession(PILAR_SESSION);
    const [payload] = token.split(".");
    const req = makeReq(`${SESSION_COOKIE}=${payload}`, { input: "hej" });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(401);
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("(g) helt manglende cookie -> 401", async () => {
    const req = makeReq(null, { input: "hej" });
    const res = await POST(req, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(401);
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("(h) session med sofie (practitioner paa flere tenants) - kun URL-tenant respekteres", async () => {
    // Sofie er practitioner paa baade bypilar og nordlys. Vi kalder mod bypilar
    // med session for bypilar - skal vaere 200. Derefter samme session mod
    // nordlys URL - MUST vaere 401 (session.tenant er bundet til bypilar).
    const sofieBypilar: Session = {
      accountId: "acc_sofie",
      tenant: "bypilar",
      role: "practitioner",
      loggedInAt: "2026-07-16T10:00:00.000Z",
    };
    const token = encodeSession(sofieBypilar);

    const reqOK = makeReq(`${SESSION_COOKIE}=${token}`, { input: "ok" }, "bypilar");
    const resOK = await POST(reqOK, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(resOK.status).toBe(200);

    const reqCross = makeReq(`${SESSION_COOKIE}=${token}`, { input: "cross" }, "nordlys");
    const resCross = await POST(reqCross, { params: Promise.resolve({ tenant: "nordlys" }) });
    expect(resCross.status).toBe(401);
  });
});
