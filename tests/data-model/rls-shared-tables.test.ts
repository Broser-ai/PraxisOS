// PraxisOS · Sprint 6 Batch 3 · RLS-verifikation paa delte core-tabeller
// Kontrakt: COMPLETE-AUDIT-REPORT.md · DM-04 + SEC-15
//
// Denne test er SQL-parsing (ikke live-DB) fordi CI ikke har Postgres.
// Vi verificerer at migration 0009 indeholder:
//   * ENABLE ROW LEVEL SECURITY paa users, memberships, tenants, learning_content
//   * CREATE POLICY med SELECT-restrictions matchende current auth-user
//   * ALTER TABLE learning_content ADD COLUMN tenant_id
//   * Idempotent (DROP POLICY IF EXISTS + CREATE) saa migrationen kan re-koeres

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let migrationSql = "";

beforeAll(() => {
  const path = resolve(
    __dirname,
    "..",
    "..",
    "supabase",
    "migrations",
    "0009_enable_rls_on_shared_tables.sql",
  );
  migrationSql = readFileSync(path, "utf-8");
});

// Case-insensitive helper - Postgres er case-insensitive paa keyword niveau
function contains(sql: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") {
    return sql.toLowerCase().includes(pattern.toLowerCase());
  }
  return pattern.test(sql);
}

describe("Migration 0009 · users RLS", () => {
  it("enabler RLS paa users", () => {
    expect(contains(migrationSql, "ALTER TABLE users ENABLE ROW LEVEL SECURITY"))
      .toBe(true);
  });

  it("har self-read policy (user_id == current auth)", () => {
    expect(contains(migrationSql, "users_self_read")).toBe(true);
    expect(contains(migrationSql, /app\.user_id/i)).toBe(true);
  });

  it("har shared-tenant-read policy (deler mindst en tenant)", () => {
    expect(contains(migrationSql, "users_shared_tenant_read")).toBe(true);
    expect(contains(migrationSql, /EXISTS.*memberships/is)).toBe(true);
  });

  it("har support-role escape hatch", () => {
    expect(contains(migrationSql, "users_support_read")).toBe(true);
    expect(contains(migrationSql, /app\.role.*support/i)).toBe(true);
  });
});

describe("Migration 0009 · memberships RLS", () => {
  it("enabler RLS paa memberships", () => {
    expect(contains(migrationSql, "ALTER TABLE memberships ENABLE ROW LEVEL SECURITY"))
      .toBe(true);
  });

  it("har self-read policy", () => {
    expect(contains(migrationSql, "memberships_self_read")).toBe(true);
  });

  it("har tenant-admin read for owners", () => {
    expect(contains(migrationSql, "memberships_tenant_admin_read")).toBe(true);
    expect(contains(migrationSql, /role\s*=\s*'owner'/i)).toBe(true);
  });
});

describe("Migration 0009 · tenants RLS", () => {
  it("enabler RLS paa tenants (0001 lavede kun policy uden ENABLE)", () => {
    expect(contains(migrationSql, "ALTER TABLE tenants ENABLE ROW LEVEL SECURITY"))
      .toBe(true);
  });

  it("gen-opretter tenants_select idempotent", () => {
    expect(contains(migrationSql, "DROP POLICY IF EXISTS tenants_select ON tenants"))
      .toBe(true);
    expect(contains(migrationSql, "CREATE POLICY tenants_select ON tenants"))
      .toBe(true);
  });

  it("owner kan opdatere egen tenant", () => {
    expect(contains(migrationSql, "tenants_owner_update")).toBe(true);
    expect(contains(migrationSql, /FOR UPDATE/i)).toBe(true);
  });
});

describe("Migration 0009 · learning_content (SEC-15 fix)", () => {
  it("tilfoejer tenant_id kolonne (nullable = global content tilladt)", () => {
    expect(contains(
      migrationSql,
      /ADD COLUMN IF NOT EXISTS tenant_id\s+uuid\s+REFERENCES\s+tenants/i,
    )).toBe(true);
  });

  it("opretter index paa tenant_id", () => {
    expect(contains(migrationSql, "learning_content_tenant_idx")).toBe(true);
  });

  it("enabler RLS", () => {
    expect(contains(
      migrationSql,
      "ALTER TABLE learning_content ENABLE ROW LEVEL SECURITY",
    )).toBe(true);
  });

  it("SELECT tillader egen tenant ELLER global (tenant_id IS NULL)", () => {
    expect(contains(migrationSql, "learning_content_select")).toBe(true);
    expect(contains(migrationSql, /tenant_id\s+IS\s+NULL/i)).toBe(true);
  });

  it("INSERT/UPDATE/DELETE begraenset til egen tenant", () => {
    expect(contains(migrationSql, "learning_content_insert")).toBe(true);
    expect(contains(migrationSql, "learning_content_update")).toBe(true);
    expect(contains(migrationSql, "learning_content_delete")).toBe(true);
  });
});

describe("Migration 0009 · idempotens + rollback", () => {
  it("alle policies bruger DROP IF EXISTS foer CREATE", () => {
    // Optael CREATE POLICY og verificer at hver har en tilhoerende DROP
    const creates = migrationSql.match(/CREATE POLICY (\w+)/gi) ?? [];
    const drops = migrationSql.match(/DROP POLICY IF EXISTS (\w+)/gi) ?? [];
    expect(creates.length).toBeGreaterThan(0);
    // Der maa vaere mindst lige saa mange drops som creates (idempotens)
    expect(drops.length).toBeGreaterThanOrEqual(creates.length);
  });

  it("indeholder kommenteret rollback-sektion", () => {
    expect(contains(migrationSql, /DISABLE ROW LEVEL SECURITY/i)).toBe(true);
  });

  it("ADD COLUMN bruger IF NOT EXISTS", () => {
    expect(contains(migrationSql, /ADD COLUMN IF NOT EXISTS/i)).toBe(true);
  });
});

describe("Migration 0009 · policy-udformning", () => {
  it("bruger NULLIF for tomme setting-strings (undgaar cast-fejl)", () => {
    // NULLIF(current_setting('app.user_id', true), '')::uuid
    expect(contains(migrationSql, /NULLIF\(current_setting/i)).toBe(true);
  });

  it("bruger true som anden parameter til current_setting (missing_ok)", () => {
    expect(contains(
      migrationSql,
      /current_setting\('app\.[a-z_]+',\s*true\)/i,
    )).toBe(true);
  });
});
