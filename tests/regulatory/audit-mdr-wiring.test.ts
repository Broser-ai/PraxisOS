// Sprint 6 · B1 (audit wiring) + B2 (canDispatchAgent gate) tests.
// Kontrakt: COMPLETE-AUDIT-REPORT.md §B1 + §B2 · regulatory dimension

import { beforeEach, describe, expect, it } from "vitest";
import {
  auditLog,
  auditError,
  _readMemorySink,
  _clearMemorySink,
  type AuditRecord,
} from "@/lib/audit";
import { canDispatchAgent } from "@/lib/agents";

beforeEach(() => {
  _clearMemorySink();
  process.env.PRAXIS_AUDIT_MODE = "memory";
});

describe("B1 · audit-log wiring · lib/audit.ts", () => {
  it("auditLog persists record with correct event + level=info", () => {
    auditLog("test.event", { tenant_id: "t1", foo: "bar" });
    const sink: AuditRecord[] = _readMemorySink();
    expect(sink.length).toBe(1);
    expect(sink[0]!.event).toBe("test.event");
    expect(sink[0]!.level).toBe("info");
    expect(sink[0]!.tenant_id).toBe("t1");
  });

  it("auditError persists record with level=error + error-message in meta", () => {
    auditError("test.error.event", new Error("boom"), { tenant_id: "t2" });
    const sink = _readMemorySink();
    expect(sink[0]!.level).toBe("error");
    expect(sink[0]!.event).toBe("test.error.event");
    expect((sink[0]!.meta as Record<string, unknown>).error).toBe("boom");
  });

  it("redactPII strips raw CPR from meta before persisting (INV-3)", () => {
    auditLog("test.pii", { note: "Patient 010190-1234 kommer", tenant_id: "t3" });
    const sink = _readMemorySink();
    const meta = JSON.stringify(sink[0]!.meta);
    expect(meta).not.toContain("010190-1234");
    // Redacted format
    expect(meta).toMatch(/XXXXXX/);
  });

  it("PRAXIS_AUDIT_MODE=stub skipper persistens helt", () => {
    process.env.PRAXIS_AUDIT_MODE = "stub";
    auditLog("skipped.event", { tenant_id: "t4" });
    expect(_readMemorySink().length).toBe(0);
  });

  it("ring buffer limits memory sink til 10000 entries", () => {
    for (let i = 0; i < 10_050; i++) {
      auditLog(`e${i}`, { tenant_id: "t" });
    }
    expect(_readMemorySink().length).toBe(10_000);
  });
});

describe("B2 · canDispatchAgent MDR gate", () => {
  it("class_0 agent (aria) allowed regardless of mdr_status", () => {
    const r1 = canDispatchAgent("aria", "none", "some-tenant");
    expect(r1.allowed).toBe(true);
    const r2 = canDispatchAgent("aria", "pre_market", "some-tenant");
    expect(r2.allowed).toBe(true);
    const r3 = canDispatchAgent("aria", "ce_marked", "some-tenant");
    expect(r3.allowed).toBe(true);
  });

  it("class_iia frozen agent (niels) refused when mdr_status='none'", () => {
    const r = canDispatchAgent("niels", "none", "some-tenant");
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("mdr_status=none");
  });

  it("class_iia frozen agent (niels) refused when mdr_status='pre_market'", () => {
    const r = canDispatchAgent("niels", "pre_market", "some-tenant");
    expect(r.allowed).toBe(false);
  });

  it("class_iia frozen agent (niels) ALLOWED when mdr_status='ce_marked'", () => {
    const r = canDispatchAgent("niels", "ce_marked", "some-tenant");
    expect(r.allowed).toBe(true);
  });

  it("by-Pilar clinical-dev-mode: bypass ONLY when PRAXIS_CLINICAL_DEV=1 AND slug=bypilar AND non-production", () => {
    const originalDev = process.env.PRAXIS_CLINICAL_DEV;
    const originalNode = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "development";
      process.env.PRAXIS_CLINICAL_DEV = "1";

      const bypass = canDispatchAgent("niels", "none", "bypilar");
      expect(bypass.allowed).toBe(true);
      expect(bypass.reason.toLowerCase()).toMatch(/by\s?pilar/);

      // Different tenant · no bypass
      const other = canDispatchAgent("niels", "none", "nordlys");
      expect(other.allowed).toBe(false);

      // Bypass off
      process.env.PRAXIS_CLINICAL_DEV = "0";
      const noFlag = canDispatchAgent("niels", "none", "bypilar");
      expect(noFlag.allowed).toBe(false);
    } finally {
      if (originalDev === undefined) delete process.env.PRAXIS_CLINICAL_DEV;
      else process.env.PRAXIS_CLINICAL_DEV = originalDev;
      if (originalNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNode;
    }
  });

  it("deprecated agents (magnus/vega/bjorn) NEVER allowed regardless of mdr_status", () => {
    for (const id of ["magnus", "vega", "bjorn"] as const) {
      const r = canDispatchAgent(id, "ce_marked", "any-tenant");
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain("deprecated");
    }
  });

  it("frozen Class-IIa agents (liv/atlas) allowed ONLY with ce_marked (Sprint 6 gate)", () => {
    for (const id of ["liv", "atlas"] as const) {
      const denied = canDispatchAgent(id, "none", "any-tenant");
      expect(denied.allowed).toBe(false);
      expect(denied.reason).toContain("mdr_status");
      const allowed = canDispatchAgent(id, "ce_marked", "any-tenant");
      expect(allowed.allowed).toBe(true);
    }
  });
});

describe("B4 · data-model · migration 0008 fixes 0002", () => {
  it("0008 migration file exists", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const mig = path.resolve(__dirname, "..", "..", "supabase", "migrations", "0008_fix_0002_rls_and_audit.sql");
    expect(fs.existsSync(mig)).toBe(true);
    const sql = fs.readFileSync(mig, "utf-8");
    // Sanity: skal indeholde app.tenant_id (den canonicaliserede setting)
    expect(sql).toContain("app.tenant_id");
    // Skal oprette audit_events
    expect(sql).toMatch(/create table\s+if not exists\s+audit_events/i);
    // Skal DROP + re-CREATE foot-scanner-policies
    expect(sql).toMatch(/drop policy\s+if exists\s+foot_scan_sessions_tenant/i);
  });

  it("no migration 0003-0007 leaks praxis.tenant_id (all should use app.tenant_id)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "..", "..", "supabase", "migrations");
    for (const num of ["0003", "0004", "0005", "0006", "0007"]) {
      const files = fs.readdirSync(dir).filter((f) => f.startsWith(num));
      for (const f of files) {
        const sql = fs.readFileSync(path.join(dir, f), "utf-8");
        // Strip line-comments so documentation-references don't false-positive
        const stripped = sql.split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join("\n");
        expect(stripped, `${f} must not use praxis.tenant_id in executable SQL`).not.toContain("praxis.tenant_id");
      }
    }
  });
});
