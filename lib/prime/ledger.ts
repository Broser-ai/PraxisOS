// Prime RL ledger · in-memory + audit hook + shared agent_ledger

import { appendAgentLedger } from "@/lib/agents/ledger";
import { auditLog } from "@/lib/audit";
import type { PrimeLedgerEntry, PrimeLedgerKind } from "@/lib/prime/types";

type LedgerRoot = {
  entries: PrimeLedgerEntry[];
};

const KEY = "__praxisos_prime_ledger_v1__";

function getRoot(): LedgerRoot {
  const g = globalThis as typeof globalThis & { [KEY]?: LedgerRoot };
  if (!g[KEY]) g[KEY] = { entries: [] };
  return g[KEY];
}

function newId(): string {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function appendPrimeLedger(input: {
  kind: PrimeLedgerKind;
  tenantSlug: string;
  content: string;
  meta?: Record<string, unknown>;
}): PrimeLedgerEntry {
  const entry: PrimeLedgerEntry = {
    id: newId(),
    at: new Date().toISOString(),
    kind: input.kind,
    tenantSlug: input.tenantSlug,
    content: input.content,
    meta: input.meta,
  };
  const root = getRoot();
  root.entries.unshift(entry);
  if (root.entries.length > 1000) root.entries.length = 1000;

  auditLog("prime.ledger", {
    tenant_id: input.tenantSlug,
    target_ref: `prime/${entry.id}`,
    kind: entry.kind,
    content: entry.content.slice(0, 240),
  });

  appendAgentLedger({
    tenantSlug: input.tenantSlug,
    agent: "PRIME_RL",
    workflow: "prime_rlvr",
    event: `prime_${entry.kind}`,
    status: entry.kind === "gate" ? "warn" : "ok",
    payload: {
      primeLedgerId: entry.id,
      content: entry.content.slice(0, 240),
      meta: entry.meta ?? {},
    },
    at: entry.at,
  });

  return entry;
}

export function listPrimeLedger(opts?: {
  tenantSlug?: string;
  kind?: PrimeLedgerKind;
  limit?: number;
}): PrimeLedgerEntry[] {
  let list = getRoot().entries;
  if (opts?.tenantSlug) {
    list = list.filter((e) => e.tenantSlug === opts.tenantSlug);
  }
  if (opts?.kind) {
    list = list.filter((e) => e.kind === opts.kind);
  }
  return list.slice(0, opts?.limit ?? 50);
}

export function resetPrimeLedgerForTests(): void {
  const g = globalThis as typeof globalThis & { [KEY]?: LedgerRoot };
  g[KEY] = { entries: [] };
}
