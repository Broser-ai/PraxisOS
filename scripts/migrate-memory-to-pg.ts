// migrate-memory-to-pg.ts · import durable memory/JSON stores into the
// self-host Postgres (P0 plan §C.4 / §F10).
//
// IMPORTANT: This script does NOT execute the cutover by default. It runs in
// --dry-run mode (prints SQL + summary, no DB write). Michael runs it with
// --execute on the Hetzner host during the MANUAL cutover, after the DB is
// up and migrations 0001→0008 are applied. See docs/ops/p0-db-cutover-runbook.md.
//
// Sources:
//   - $PRAXIS_DATA_DIR/journal-store.json  (durable journal entries)
//   - in-memory client/booking seed (lib/clients, lib/bookings) for reference
//
// ID strategy: the DB uses UUIDs; memory uses string ids (jr_*, mette, per…).
// We resolve tenant_id by slug, client_id by email (clients.email is unique
// per tenant), and create a journals row per (tenant, client) on demand.
// Legacy jr_ ids are preserved in journal_entries.id::text via a side table
// when --execute is used (see runbook). In dry-run we emit SQL using
// subqueries so no UUIDs need to be hard-coded.
//
// Usage:
//   npx tsx scripts/migrate-memory-to-pg.ts --dry-run
//   npx tsx scripts/migrate-memory-to-pg.ts --dry-run --journal-store /data/journal-store.json
//   npx tsx scripts/migrate-memory-to-pg.ts --execute   # requires SUPABASE_URL + SERVICE_ROLE_KEY

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type JournalStoreJson = {
  entries?: Array<{
    id: string;
    tenant?: string;
    clientId?: string;
    clientName?: string;
    bookingId?: string;
    service?: string;
    serviceId?: string;
    practitioner?: string;
    status?: string;
    soap?: { S?: string; O?: string; A?: string; P?: string };
    codes?: string[];
    aiDrafted?: boolean;
    createdAt?: string;
    updatedAt?: string;
    visitAt?: string;
  }>;
};

export type ImportPlan = {
  sql: string[];
  counts: { journalEntries: number; journals: number; tenants: string[] };
  warnings: string[];
};

function sqlStr(v: string | undefined): string {
  if (v === undefined || v === null) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

/**
 * Build the import plan (pure — no IO, no DB writes). Testable.
 * Emits idempotent-ish SQL using subqueries to resolve UUIDs by slug/email.
 */
export function buildImportPlan(store: JournalStoreJson): ImportPlan {
  const entries = store.entries ?? [];
  const sql: string[] = [];
  const warnings: string[] = [];
  const tenants = new Set<string>();
  const journalsKeys = new Set<string>();

  sql.push("-- PraxisOS memory → PG import (dry-run)");
  sql.push("-- Idempotency: uses INSERT ... ON CONFLICT DO NOTHING where possible.");
  sql.push("-- Resolve tenant_id by slug, client_id by email (per-tenant unique).");

  for (const e of entries) {
    const tenant = e.tenant ?? "bypilar";
    tenants.add(tenant);

    if (!e.id) {
      warnings.push("entry missing id — skipped");
      continue;
    }
    if (!e.clientId) {
      warnings.push(`entry ${e.id} missing clientId — cannot resolve client_id`);
      continue;
    }

    // journal row per (tenant, client) — created on demand.
    const journalKey = `${tenant}:${e.clientId}`;
    if (!journalsKeys.has(journalKey)) {
      journalsKeys.add(journalKey);
      sql.push(
        `insert into journals (tenant_id, client_id, protocol, active, created_at)
select t.id, c.id, ${sqlStr(e.service)}, true, ${sqlStr(e.createdAt ?? new Date().toISOString())}
from tenants t, clients c
where t.slug = ${sqlStr(tenant)}
  and c.tenant_id = t.id
  and c.email = (select email from clients where tenant_id = t.id and id::text = ${sqlStr(e.clientId)} limit 1)
on conflict do nothing;`,
      );
    }

    // journal_entry — resolve journal_id by (tenant, client).
    const soapS = sqlStr(e.soap?.S);
    const soapO = sqlStr(e.soap?.O);
    const soapA = sqlStr(e.soap?.A);
    const soapP = sqlStr(e.soap?.P);
    const codes = e.codes && e.codes.length ? `ARRAY[${e.codes.map((c) => sqlStr(c)).join(",")}]::text[]` : "NULL";
    sql.push(
      `insert into journal_entries (tenant_id, journal_id, booking_id, soap_s, soap_o, soap_a, soap_p, icd10_codes, ai_drafted, created_at)
select t.id, j.id,
  (select id from bookings where tenant_id = t.id and id::text = ${sqlStr(e.bookingId ?? "")} limit 1),
  ${soapS}, ${soapO}, ${soapA}, ${soapP}, ${codes}, ${e.aiDrafted ? "true" : "false"}, ${sqlStr(e.createdAt ?? new Date().toISOString())}
from tenants t, journals j
where t.slug = ${sqlStr(tenant)}
  and j.tenant_id = t.id
  and j.client_id = (select id from clients where tenant_id = t.id and id::text = ${sqlStr(e.clientId)} limit 1);`,
    );
  }

  return {
    sql,
    counts: {
      journalEntries: entries.length,
      journals: journalsKeys.size,
      tenants: [...tenants],
    },
    warnings,
  };
}

function readStore(path?: string): JournalStoreJson {
  const dir = process.env.PRAXIS_DATA_DIR?.trim() || null;
  const file = path ?? (dir ? join(dir, "journal-store.json") : null);
  if (!file) {
    throw new Error(
      "No journal-store path: pass --journal-store <path> or set PRAXIS_DATA_DIR",
    );
  }
  if (!existsSync(file)) {
    throw new Error(`journal-store not found: ${file}`);
  }
  return JSON.parse(readFileSync(file, "utf8")) as JournalStoreJson;
}

async function execute(plan: ImportPlan): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "--execute requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (point at self-host API/PostgREST)",
    );
  }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Execute via rpc — the runbook ships a migrate_memory_to_pg() SQL function
  // that runs the emitted statements in order. Here we only fire the plan
  // through a single rpc to keep it transactional.
  const { error } = await sb.rpc("migrate_memory_to_pg", { plan: plan.sql });
  if (error) throw new Error(`migrate_memory_to_pg rpc failed: ${error.message}`);
}

async function main() {
  const args = process.argv.slice(2);
  const executeFlag = args.includes("--execute");
  const dryRun = !executeFlag;
  const journalStoreArg = args[args.indexOf("--journal-store") + 1];

  const store = readStore(journalStoreArg);
  const plan = buildImportPlan(store);

  if (dryRun) {
    process.stdout.write(
      `-- DRY RUN · no DB writes\n` +
        `-- journal_entries: ${plan.counts.journalEntries}\n` +
        `-- journals (new): ${plan.counts.journals}\n` +
        `-- tenants: ${plan.counts.tenants.join(", ") || "—"}\n` +
        `-- warnings: ${plan.warnings.length}\n\n`,
    );
    for (const s of plan.sql) process.stdout.write(s + "\n\n");
    for (const w of plan.warnings) process.stdout.write(`-- WARNING: ${w}\n`);
    process.stdout.write("\n-- DRY RUN complete. Re-run with --execute to apply (Michael, manual).\n");
    return;
  }

  await execute(plan);
  process.stdout.write(
    `-- EXECUTED · journal_entries=${plan.counts.journalEntries} journals=${plan.counts.journals}\n`,
  );
}

// Run only when invoked directly (not when imported by tests).
if (
  process.argv[1] &&
  (process.argv[1].endsWith("migrate-memory-to-pg.ts") ||
    process.argv[1].endsWith("migrate-memory-to-pg"))
) {
  void main().catch((err: unknown) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  });
}
