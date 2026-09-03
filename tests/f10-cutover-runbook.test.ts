// F10 · cutover runbook + memory/JSON import script (NO execution).
// The import script defaults to --dry-run (prints SQL, no DB writes). This
// test exercises buildImportPlan (pure) against a fixture journal-store and
// asserts the emitted SQL imports journal_entries without touching a DB.

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildImportPlan, type JournalStoreJson } from "@/scripts/migrate-memory-to-pg";

const root = process.cwd();

const fixture: JournalStoreJson = {
  entries: [
    {
      id: "jr_booking_1001",
      tenant: "bypilar",
      clientId: "per",
      clientName: "Per Sørensen",
      bookingId: "booking_1001",
      service: "Medicinsk fodpleje",
      serviceId: "fod-med",
      practitioner: "Pilar",
      status: "signed",
      soap: { S: "Ømhed under forfod", O: "Ingen synlige sår", A: "Behandling OK", P: "Opfølgning 2 uger" },
      codes: ["M79.6", "L84"],
      aiDrafted: true,
      createdAt: "2026-09-01T10:00:00.000Z",
    },
    {
      id: "jr_draft_per_opfølgning",
      tenant: "bypilar",
      clientId: "per",
      service: "Opfølgning",
      status: "draft",
      soap: { S: "Patient beskriver ømhed", O: "", A: "", P: "" },
      aiDrafted: false,
      createdAt: "2026-09-02T09:00:00.000Z",
    },
    {
      id: "jr_nordlys_1",
      tenant: "nordlys",
      clientId: "nadia",
      service: "Konsultation",
      status: "pending_approval",
      soap: { S: "Konsultation", O: "", A: "", P: "" },
      aiDrafted: false,
      createdAt: "2026-09-03T08:00:00.000Z",
    },
  ],
};

describe("F10 · buildImportPlan (pure, dry-run)", () => {
  const plan = buildImportPlan(fixture);

  it("counts journal entries, journals, tenants", () => {
    expect(plan.counts.journalEntries).toBe(3);
    // 2 distinct (tenant, client) journals: bypilar:per, nordlys:nadia
    expect(plan.counts.journals).toBe(2);
    expect(plan.counts.tenants.sort()).toEqual(["bypilar", "nordlys"]);
  });

  it("emits INSERT INTO journal_entries for each entry", () => {
    const joined = plan.sql.join("\n");
    expect(joined).toMatch(/insert into journal_entries/);
    const entryInserts = plan.sql.filter((s) =>
      s.includes("insert into journal_entries"),
    );
    expect(entryInserts.length).toBe(3);
  });

  it("emits INSERT INTO journals (on conflict do nothing)", () => {
    const joined = plan.sql.join("\n");
    expect(joined).toMatch(/insert into journals/);
    expect(joined).toMatch(/on conflict do nothing/);
  });

  it("preserves SOAP values + codes in the emitted SQL", () => {
    const joined = plan.sql.join("\n");
    expect(joined).toContain("Ømhed under forfod");
    expect(joined).toContain("Behandling OK");
    expect(joined).toMatch(/ARRAY\['M79\.6','L84'\]::text\[/);
  });

  it("resolves tenant_id by slug (no hardcoded UUIDs)", () => {
    const joined = plan.sql.join("\n");
    expect(joined).toMatch(/t\.slug = 'bypilar'/);
    expect(joined).toMatch(/t\.slug = 'nordlys'/);
    // No raw UUID literals
    expect(joined).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("marks the output as dry-run with no DB writes", () => {
    expect(plan.sql[0]).toMatch(/dry-run/i);
  });

  it("warns on entries missing clientId", () => {
    const p = buildImportPlan({
      entries: [{ id: "jr_x", tenant: "bypilar" } as any],
    });
    expect(p.warnings.some((w) => w.includes("missing clientId"))).toBe(true);
    expect(p.counts.journalEntries).toBe(1);
  });
});

describe("F10 · script + runbook present", () => {
  it("scripts/migrate-memory-to-pg.ts exists", () => {
    expect(existsSync(join(root, "scripts/migrate-memory-to-pg.ts"))).toBe(true);
  });

  it("runbook exists and documents NO_AUTO_MERGE / manual cutover", () => {
    const rb = readFileSync(join(root, "docs/ops/p0-db-cutover-runbook.md"), "utf8");
    expect(rb).toMatch(/NO_AUTO_MERGE/);
    expect(rb).toMatch(/NOT automated/i);
    expect(rb).toMatch(/--dry-run/);
    expect(rb).toMatch(/--execute/);
    expect(rb).toMatch(/Michael/);
  });

  it("script defaults to dry-run and requires keys for --execute", () => {
    const src = readFileSync(join(root, "scripts/migrate-memory-to-pg.ts"), "utf8");
    expect(src).toMatch(/--execute requires SUPABASE_URL/);
    expect(src).toMatch(/DRY RUN/);
  });
});
