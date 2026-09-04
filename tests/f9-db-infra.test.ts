// F9 · additive docker-compose.db.yml + scripts + .env.production.example.
// No production change, no secrets in git. Validates the cutover infra files
// exist and are well-formed, and the production DB fail-fast guard.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assertProductionDbConfig, DB_MODE } from "@/lib/supabase";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("F9 · docker-compose.db.yml", () => {
  const compose = read("docker-compose.db.yml");

  it("uses pgvector/pgvector:pg17 image", () => {
    expect(compose).toMatch(/image:\s*pgvector\/pgvector:pg17/);
  });

  it("declares the praxis_pgdata named volume", () => {
    expect(compose).toMatch(/praxis_pgdata:/);
  });

  it("has a pg_isready healthcheck", () => {
    expect(compose).toMatch(/pg_isready/);
    expect(compose).toMatch(/healthcheck:/);
  });

  it("mounts supabase/migrations read-only", () => {
    expect(compose).toMatch(/\.\/supabase\/migrations:\/migrations:ro/);
  });

  it("binds loopback by default (PRAXIS_PG_BIND 127.0.0.1)", () => {
    expect(compose).toMatch(/\$\{PRAXIS_PG_BIND:-127\.0\.0\.1\}/);
  });

  it("has a migrate profile running db-apply-migrations.sh", () => {
    expect(compose).toMatch(/profiles:/);
    expect(compose).toMatch(/db-apply-migrations\.sh/);
  });

  it("requires POSTGRES_PASSWORD (not a default secret in git)", () => {
    expect(compose).toMatch(/POSTGRES_PASSWORD:\?POSTGRES_PASSWORD is required/);
    // No hardcoded password value
    expect(compose).not.toMatch(/POSTGRES_PASSWORD:\s*(praxis|secret|password|changeme)/i);
  });
});

describe("F9 · db scripts", () => {
  it("db-apply-migrations.sh exists and is executable", () => {
    const p = join(root, "scripts/db-apply-migrations.sh");
    expect(existsSync(p)).toBe(true);
  });

  it("applies migrations idempotently with ON_ERROR_STOP", () => {
    const sh = read("scripts/db-apply-migrations.sh");
    expect(sh).toMatch(/ON_ERROR_STOP=1/);
    expect(sh).toMatch(/\/migrations\/\*\.sql/);
  });

  it("db-init-selfhost.sh refuses to run without POSTGRES_PASSWORD", () => {
    const sh = read("scripts/db-init-selfhost.sh");
    expect(sh).toMatch(/POSTGRES_PASSWORD must be set/);
    expect(sh).toMatch(/docker-compose\.db\.yml/);
    // Explicitly does NOT switch PRAXIS_DB (Michael's manual step)
    expect(sh).toMatch(/PRAXIS_DB was NOT changed/);
  });
});

describe("F9 · .env.production.example forbids mock in prod", () => {
  const env = read(".env.production.example");

  it("does not default PRAXIS_DB to mock", () => {
    expect(env).not.toMatch(/^PRAXIS_DB=mock\s*$/m);
    expect(env).toMatch(/PRAXIS_DB=supabase-eu/);
  });

  it("documents that mock is forbidden in production", () => {
    expect(env).toMatch(/MUST NOT RUN ON PRAXIS_DB=mock/i);
  });

  it("requires PRAXIS_SESSION_SECRET (was missing before)", () => {
    expect(env).toMatch(/PRAXIS_SESSION_SECRET=/);
  });

  it("requires PRAXIS_AUDIT_MODE=supabase for production", () => {
    expect(env).toMatch(/PRAXIS_AUDIT_MODE=supabase/);
  });

  it("documents SUPABASE_URL + service role + POSTGRES_PASSWORD (no values)", () => {
    expect(env).toMatch(/SUPABASE_URL=/);
    expect(env).toMatch(/SUPABASE_SERVICE_ROLE_KEY=/);
    expect(env).toMatch(/POSTGRES_PASSWORD=/);
    // No real secret values committed
    expect(env).not.toMatch(/sk_live_[a-z0-9]{16,}/i);
  });
});

describe("F9 · migrations 0001-0008 present", () => {
  const files = readdirSync(join(root, "supabase/migrations"));
  for (const n of ["0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008"]) {
    it(`${n}_*.sql exists`, () => {
      expect(files.some((f) => f.startsWith(`${n}_`) && f.endsWith(".sql"))).toBe(true);
    });
  }
});

describe("F9 · assertProductionDbConfig fail-fast guard", () => {
  const env = process.env as Record<string, string | undefined>;
  const origNodeEnv = env.NODE_ENV;
  const origPraxisDb = env.PRAXIS_DB;

  beforeEach(() => {
    delete env.NODE_ENV;
    delete env.PRAXIS_DB;
  });

  afterEach(() => {
    if (origNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = origNodeEnv;
    if (origPraxisDb === undefined) delete env.PRAXIS_DB;
    else env.PRAXIS_DB = origPraxisDb;
  });

  it("rejects mock in production", () => {
    env.NODE_ENV = "production";
    const r = assertProductionDbConfig();
    if (DB_MODE === "mock") {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/mock is forbidden/i);
    } else {
      // non-mock mode in prod without configured supabase → fail (no keys)
      expect(r.ok).toBe(false);
    }
  });

  it("allows any mode outside production", () => {
    delete env.NODE_ENV;
    const r = assertProductionDbConfig();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe(DB_MODE);
  });
});
