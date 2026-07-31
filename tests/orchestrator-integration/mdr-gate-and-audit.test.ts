// Sprint 6 Batch 3 - Orchestrator-integration test
// Kontrakt: COMPLETE-AUDIT-REPORT.md test-coverage MDR gate deprecated frozen

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildOrchestrator, type LLMCaller } from "@/lib/orchestrator";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import type { AgentId } from "@/lib/agents";

function makeRouteThenFinishStub(target: AgentId): LLMCaller {
  let routed = false;
  return async (input) => {
    if (input.jsonSchema) {
      if (!routed) {
        routed = true;
        return {
          content: `{"next":"${target}","reason":"routed"}`,
          json: { next: target, reason: "routed" },
          usage: { prompt: 1, completion: 1 },
        };
      }
      return {
        content: '{"next":"FINISH","reason":"done"}',
        json: { next: "FINISH", reason: "done" },
        usage: { prompt: 1, completion: 1 },
      };
    }
    return { content: "worker output", usage: { prompt: 1, completion: 1 } };
  };
}

const TENANT = "tenant-integ-11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  _clearMemorySink();
  process.env.PRAXIS_AUDIT_MODE = "memory";
  delete process.env.PRAXIS_CLINICAL_DEV;
});

afterEach(() => {
  delete process.env.PRAXIS_CLINICAL_DEV;
});

describe("Sprint 6 B3 - MDR gate end-to-end - deprecated + frozen agenter", () => {
  it("(a) deprecated agent magnus afvises uanset ce_marked + emitter audit-row", async () => {
    const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub("magnus") });
    const result = await orch.invoke({
      tenantId: TENANT,
      actorRole: "owner",
      tenantMdrStatus: "ce_marked",
      tenantSlug: "bypilar",
      origin: "api",
      messages: [{ role: "user", content: "route to magnus" }],
    });
    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("INV-CS-7 violation");
    expect(result.error?.message).toContain("deprecated");

    const denied = _readMemorySink().find((r) => r.event === "orchestrator.dispatch.denied");
    expect(denied, "audit MUST record every denied dispatch").toBeTruthy();
    expect(denied!.tenant_id).toBe(TENANT);
    expect(denied!.level).toBe("error");
    expect((denied!.meta as Record<string, unknown>).agent).toBe("magnus");
  });

  for (const dep of ["vega", "bjorn"] as const) {
    it(`(a2) deprecated agent ${dep} afvises uanset ce_marked`, async () => {
      const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub(dep) });
      const result = await orch.invoke({
        tenantId: TENANT,
        actorRole: "owner",
        tenantMdrStatus: "ce_marked",
        origin: "api",
        messages: [{ role: "user", content: "route" }],
      });
      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("INV-CS-7 violation");
    });
  }

  // NB: frej er class_iia MEN AGENT_DEPLOYMENT_STATUS['frej']='active' -
  // saa canDispatchAgent tillader den. Vi tester derfor kun niels/liv/atlas
  // som er class_iia AND frozen.
  for (const frozen of ["niels", "liv", "atlas"] as const) {
    it(`(b) frozen Class-IIa ${frozen} afvises paa mdr_status=none + audit-row`, async () => {
      const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub(frozen) });
      const result = await orch.invoke({
        tenantId: TENANT,
        actorRole: "owner",
        tenantMdrStatus: "none",
        origin: "api",
        messages: [{ role: "user", content: "route" }],
      });
      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("INV-CS-7 violation");
      const denied = _readMemorySink().find(
        (r) => r.event === "orchestrator.dispatch.denied",
      );
      expect(denied).toBeTruthy();
      expect((denied!.meta as Record<string, unknown>).mdr_status).toBe("none");
    });
  }

  it("(c) frozen niels tillades paa ce_marked + emitter dispatch-row", async () => {
    const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub("niels") });
    const result = await orch.invoke({
      tenantId: TENANT,
      actorRole: "owner",
      tenantMdrStatus: "ce_marked",
      origin: "api",
      messages: [{ role: "user", content: "route niels" }],
    });
    expect(result.status).toBe("done");
    const dispatched = _readMemorySink().find((r) => r.event === "orchestrator.dispatch");
    expect(dispatched).toBeTruthy();
    expect((dispatched!.meta as Record<string, unknown>).mdr_status).toBe("ce_marked");
    expect(dispatched!.target_ref).toBe("agent/niels");
  });

  it("(d) INV-7 rolle-scope udloeser FOER MDR-gate for at give praecis fejlkilde", async () => {
    const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub("niels") });
    const result = await orch.invoke({
      tenantId: TENANT,
      actorRole: "reception",
      tenantMdrStatus: "ce_marked",
      origin: "api",
      messages: [{ role: "user", content: "as reception" }],
    });
    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("INV-7 violation");
    const denied = _readMemorySink().find(
      (r) => r.event === "orchestrator.dispatch.denied",
    );
    expect(denied).toBeTruthy();
    expect((denied!.meta as Record<string, unknown>).reason).toContain("INV-7");
  });

  it("(e) by-Pilar dev-mode bypass - alle tre conditions kraeves for at faa done", async () => {
    const origNode = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "development";
      process.env.PRAXIS_CLINICAL_DEV = "1";

      const orchOK = buildOrchestrator({ llmCall: makeRouteThenFinishStub("niels") });
      const ok = await orchOK.invoke({
        tenantId: TENANT,
        actorRole: "owner",
        tenantMdrStatus: "none",
        tenantSlug: "bypilar",
        origin: "api",
        messages: [{ role: "user", content: "bypass" }],
      });
      expect(ok.status).toBe("done");

      _clearMemorySink();
      const orchBad = buildOrchestrator({ llmCall: makeRouteThenFinishStub("niels") });
      const bad = await orchBad.invoke({
        tenantId: TENANT,
        actorRole: "owner",
        tenantMdrStatus: "none",
        tenantSlug: "nordlys",
        origin: "api",
        messages: [{ role: "user", content: "no bypass" }],
      });
      expect(bad.status).toBe("error");
      expect(bad.error?.code).toBe("INV-CS-7 violation");

      _clearMemorySink();
      delete process.env.PRAXIS_CLINICAL_DEV;
      const orchNoFlag = buildOrchestrator({ llmCall: makeRouteThenFinishStub("niels") });
      const nf = await orchNoFlag.invoke({
        tenantId: TENANT,
        actorRole: "owner",
        tenantMdrStatus: "none",
        tenantSlug: "bypilar",
        origin: "api",
        messages: [{ role: "user", content: "no flag" }],
      });
      expect(nf.status).toBe("error");
      expect(nf.error?.code).toBe("INV-CS-7 violation");
    } finally {
      if (origNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = origNode;
    }
  });

  it("(f) dispatch audit-row har target_ref=agent/id + role + mdr_status", async () => {
    const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub("aria") });
    await orch.invoke({
      tenantId: TENANT,
      actorRole: "practitioner",
      tenantMdrStatus: "pre_market",
      origin: "chat",
      messages: [{ role: "user", content: "book" }],
    });
    const row = _readMemorySink().find((r) => r.event === "orchestrator.dispatch");
    expect(row).toBeTruthy();
    expect(row!.target_ref).toBe("agent/aria");
    expect((row!.meta as Record<string, unknown>).role).toBe("practitioner");
    expect((row!.meta as Record<string, unknown>).mdr_status).toBe("pre_market");
  });
});
