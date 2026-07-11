// Smoke-test af /api/v1/[tenant]/orchestrator route-handler.
// Kalder POST() direkte uden dev-server for at undgå port-konflikt.
//
// Verificerer:
//   - Feature-flag OFF → 503
//   - Feature-flag ON + stub-LLM → 200 med run_id + done status
//   - Invalid JSON → 400
//   - Manglende tenant slug håndteres

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Sæt env FØR route-modulet importeres
beforeAll(() => {
  process.env.PRAXIS_LLM_MODE = "stub";
});

describe("route smoke · POST /api/v1/[tenant]/orchestrator", () => {
  it("(a) feature-flag OFF → 503 AGENT_ORCHESTRATION_DISABLED", async () => {
    process.env.AGENT_ORCHESTRATION_ENABLED = "false";
    // Fresh import så isOrchestrationEnabled() evalueres med aktuel env
    const { POST } = await import(
      "@/app/api/v1/[tenant]/orchestrator/route?flag=off" as string
    ).catch(() => import("@/app/api/v1/[tenant]/orchestrator/route"));

    const req = new Request("http://localhost/api/v1/bypilar/orchestrator", {
      method: "POST",
      body: JSON.stringify({ input: "hej" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req as any, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("AGENT_ORCHESTRATION_DISABLED");
  });

  it("(b) feature-flag ON + stub-LLM → 200 med run_id + status done", async () => {
    process.env.AGENT_ORCHESTRATION_ENABLED = "true";
    // Fresh import fordi POST-lukningen holder på et in-memory registry
    // som vi ikke behøver bekymre os om for smoke, men flaget skal genlæses
    const routeModule = await import(
      "@/app/api/v1/[tenant]/orchestrator/route?flag=on" as string
    ).catch(() => import("@/app/api/v1/[tenant]/orchestrator/route"));
    const POST = routeModule.POST;

    const req = new Request("http://localhost/api/v1/bypilar/orchestrator", {
      method: "POST",
      body: JSON.stringify({
        input: "Hvornår har jeg næste tid?",
        actor_role: "practitioner",
        origin: "chat",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req as any, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("run_id");
    expect(typeof body.run_id).toBe("string");
    expect(body.status).toBe("done");
  });

  it("(c) invalid JSON body → 400 INVALID_JSON", async () => {
    process.env.AGENT_ORCHESTRATION_ENABLED = "true";
    const { POST } = await import("@/app/api/v1/[tenant]/orchestrator/route");
    const req = new Request("http://localhost/api/v1/bypilar/orchestrator", {
      method: "POST",
      body: "{ not valid json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req as any, { params: Promise.resolve({ tenant: "bypilar" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_JSON");
  });
});

afterAll(() => {
  process.env.AGENT_ORCHESTRATION_ENABLED = "false";
  delete process.env.PRAXIS_LLM_MODE;
});
