// Sprint 6 Batch 3 - Configurator lifecycle integration test
// Kontrakt: COMPLETE-AUDIT-REPORT.md test-coverage draft reviewed locked
//
// Beviser at INV-NC-1 haandhaeves through hele draft-lifecycle og at et lock
// transition ledsages af audit-row (Sundhedsloven 42a-d klinisk-relevant).

import { beforeEach, describe, expect, it } from "vitest";
import {
  assertMutable,
  assertApprovalForLab,
  assertParamRanges,
} from "@/lib/configurator/constraints";
import {
  configurationStatusSchema,
  isLocked,
  type ConfigurationStatus,
} from "@/lib/configurator/schema";
import { generateParams, defaultParams } from "@/lib/configurator/orthotic-generator";
import { runBiophysicalInversion } from "@/lib/configurator/biophysical-inversion";
import type { ScannerFindings } from "@/lib/scanner/findings-schema";
import { auditLog, _clearMemorySink, _readMemorySink } from "@/lib/audit";

const TENANT = "tenant-nc1-int-11111111-1111-1111-1111-111111111111";
const CONFIG_ID = "cfg_lifecycle_001";
const SCAN_ID = "scan_lifecycle_001";
const USER_ID = "user_lifecycle";

const EMPTY_FINDINGS: ScannerFindings = {
  scan_id: SCAN_ID,
  vlm_model_version: "v1",
  ai_generated: true,
  confidence_overall: 0.8,
  findings: [],
  overall_summary_da: "",
};

beforeEach(() => {
  _clearMemorySink();
  process.env.PRAXIS_AUDIT_MODE = "memory";
});

// Simulerer den transition-guard en repository-callee vil have. Kaster hvis
// mutation forsoeges paa locked/sent_to_lab/delivered. Emitter audit-row for
// legitim state-change.
function transitionStatus(
  from: ConfigurationStatus,
  to: ConfigurationStatus,
  opts: { approvedBy?: string; approvedAt?: string } = {},
): void {
  assertMutable(from);
  assertApprovalForLab({
    newStatus: to,
    approvedBy: opts.approvedBy ?? null,
    approvedAt: opts.approvedAt ?? null,
  });
  auditLog("config.lock", {
    tenant_id: TENANT,
    actor_user_id: USER_ID,
    target_ref: "config/" + CONFIG_ID,
    from,
    to,
    approved_by: opts.approvedBy,
  });
}

describe("Sprint 6 B3 - INV-NC-1 draft reviewed locked lifecycle", () => {
  it("(a) draft er mutable - assertMutable throws IKKE + params kan udledes", () => {
    expect(isLocked("draft")).toBe(false);
    expect(() => assertMutable("draft")).not.toThrow();

    const bp = runBiophysicalInversion({
      scanId: SCAN_ID,
      meshRegions: ["heel", "arch", "forefoot"],
      clientProfile: {},
    });
    const p = generateParams({
      findings: EMPTY_FINDINGS,
      biophysical: bp,
      clientProfile: {},
      auditContext: { tenantId: TENANT, actorUserId: USER_ID, configId: CONFIG_ID, scanId: SCAN_ID },
    });
    expect(() => assertParamRanges(p)).not.toThrow();
    const gen = _readMemorySink().find((r) => r.event === "config.generate");
    expect(gen, "generateParams med auditContext MUST emit config.generate").toBeTruthy();
    expect(gen!.tenant_id).toBe(TENANT);
    expect(gen!.target_ref).toBe("config/" + CONFIG_ID);
  });

  it("(b) reviewed er stadig mutable + transition audit-row emitteres", () => {
    expect(isLocked("reviewed")).toBe(false);
    expect(() => assertMutable("reviewed")).not.toThrow();
    _clearMemorySink();
    transitionStatus("draft", "reviewed");
    const row = _readMemorySink().find((r) => r.event === "config.lock");
    expect(row).toBeTruthy();
    expect((row!.meta as Record<string, unknown>).to).toBe("reviewed");
  });

  it("(c) lock-transition emitter audit-row - efterfoelgende mutation kaster INV-NC-1", () => {
    transitionStatus("reviewed", "locked");
    const lockRow = _readMemorySink().find(
      (r) => r.event === "config.lock" && (r.meta as Record<string, unknown>).to === "locked",
    );
    expect(lockRow, "config.lock MUST emit paa lock-transition").toBeTruthy();
    expect(lockRow!.tenant_id).toBe(TENANT);
    expect(lockRow!.target_ref).toBe("config/" + CONFIG_ID);
    expect((lockRow!.meta as Record<string, unknown>).from).toBe("reviewed");

    expect(isLocked("locked")).toBe(true);
    expect(() => assertMutable("locked")).toThrow(/INV-NC-1/);
    expect(() => transitionStatus("locked", "sent_to_lab", {
      approvedBy: USER_ID,
      approvedAt: new Date().toISOString(),
    })).toThrow(/INV-NC-1/);
  });

  it("(d) sent_to_lab kraever approval (INV-NC-4) UDOVER lock-check", () => {
    expect(() =>
      assertApprovalForLab({
        newStatus: "sent_to_lab",
        approvedBy: null,
        approvedAt: null,
      }),
    ).toThrow(/INV-NC-4/);

    expect(() => transitionStatus("reviewed", "sent_to_lab")).toThrow(/INV-NC-4/);

    expect(() =>
      transitionStatus("reviewed", "sent_to_lab", {
        approvedBy: USER_ID,
        approvedAt: new Date().toISOString(),
      }),
    ).not.toThrow();
    const rows = _readMemorySink().filter((r) => r.event === "config.lock");
    expect(rows.some((r) => (r.meta as Record<string, unknown>).to === "sent_to_lab")).toBe(true);
  });

  it("(e) delivered er terminal - assertMutable throws + status er valid schema", () => {
    expect(configurationStatusSchema.parse("delivered")).toBe("delivered");
    expect(isLocked("delivered")).toBe(true);
    expect(() => assertMutable("delivered")).toThrow(/INV-NC-1/);
  });

  it("(f) invariant-property: for hver mutable-locked overgang gaelder assertMutable(FROM) OK men assertMutable(TO) throws", () => {
    const mutables: ConfigurationStatus[] = ["draft", "reviewed"];
    const locks: ConfigurationStatus[] = ["locked", "sent_to_lab", "delivered"];
    for (const f of mutables) {
      for (const t of locks) {
        expect(() => assertMutable(f)).not.toThrow();
        expect(() => assertMutable(t)).toThrow(/INV-NC-1/);
      }
    }
  });

  it("(g) fuld lifecycle-run: audit-trail har praecis forventet event-sekvens", () => {
    _clearMemorySink();
    const bp = runBiophysicalInversion({
      scanId: SCAN_ID,
      meshRegions: ["heel", "arch", "forefoot"],
      clientProfile: {},
    });
    generateParams({
      findings: EMPTY_FINDINGS,
      biophysical: bp,
      clientProfile: {},
      auditContext: { tenantId: TENANT, actorUserId: USER_ID, configId: CONFIG_ID, scanId: SCAN_ID },
    });
    transitionStatus("draft", "reviewed");
    transitionStatus("reviewed", "locked");

    const events = _readMemorySink().map((r) => r.event);
    expect(events).toEqual(["config.generate", "config.lock", "config.lock"]);
    for (const r of _readMemorySink()) {
      expect(r.target_ref).toBe("config/" + CONFIG_ID);
      expect(r.tenant_id).toBe(TENANT);
    }
  });
});

describe("Sprint 6 B3 - INV-NC-1 defense-in-depth pure assertions", () => {
  it("assertMutable respekterer alle 5 states korrekt", () => {
    expect(() => assertMutable("draft")).not.toThrow();
    expect(() => assertMutable("reviewed")).not.toThrow();
    expect(() => assertMutable("locked")).toThrow(/INV-NC-1/);
    expect(() => assertMutable("sent_to_lab")).toThrow(/INV-NC-1/);
    expect(() => assertMutable("delivered")).toThrow(/INV-NC-1/);
  });

  it("defaultParams er range-safe", () => {
    expect(() => assertParamRanges(defaultParams())).not.toThrow();
  });
});
