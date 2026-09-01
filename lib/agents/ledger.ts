/**
 * Agent activity ledger — in-memory + optional Supabase `agent_ledger`.
 * Swarm journals and MCP/tool ticks should append here for auditability.
 */

import { getServiceSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type LedgerStatus = "ok" | "warn" | "error" | "skipped";

export type AgentLedgerEntry = {
  id: string;
  tenantSlug: string;
  agent: string;
  workflow?: string;
  event: string;
  status: LedgerStatus;
  payload: Record<string, unknown>;
  errorMessage?: string;
  durationMs?: number;
  at: string;
};

type LedgerRoot = { entries: AgentLedgerEntry[] };

const KEY = "__praxisos_agent_ledger_v1__";
const MAX_LOCAL = 1000;

function root(): LedgerRoot {
  const g = globalThis as typeof globalThis & { [KEY]?: LedgerRoot };
  if (!g[KEY]) g[KEY] = { entries: [] };
  return g[KEY];
}

function newId(): string {
  return `led_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function appendAgentLedger(input: {
  tenantSlug?: string;
  agent: string;
  workflow?: string;
  event: string;
  status?: LedgerStatus;
  payload?: Record<string, unknown>;
  errorMessage?: string;
  durationMs?: number;
  at?: string;
}): AgentLedgerEntry {
  const entry: AgentLedgerEntry = {
    id: newId(),
    tenantSlug: input.tenantSlug ?? "bypilar",
    agent: input.agent,
    workflow: input.workflow,
    event: input.event,
    status: input.status ?? "ok",
    payload: input.payload ?? {},
    errorMessage: input.errorMessage,
    durationMs: input.durationMs,
    at: input.at ?? new Date().toISOString(),
  };
  const store = root();
  store.entries.unshift(entry);
  if (store.entries.length > MAX_LOCAL) store.entries.length = MAX_LOCAL;
  void persistLedgerRemote(entry);
  return entry;
}

async function persistLedgerRemote(entry: AgentLedgerEntry): Promise<void> {
  if (process.env.NODE_ENV === "test" && process.env.SWARM_SUPABASE !== "1") return;
  if (!isSupabaseConfigured()) return;
  const sb = getServiceSupabase();
  if (!sb) return;
  try {
    await sb.from("agent_ledger").insert({
      tenant_slug: entry.tenantSlug,
      agent: entry.agent,
      workflow: entry.workflow ?? null,
      event: entry.event,
      status: entry.status,
      payload: entry.payload,
      error_message: entry.errorMessage ?? null,
      duration_ms: entry.durationMs ?? null,
      at: entry.at,
    });
  } catch {
    // local ledger remains source of truth
  }
}

export function listAgentLedger(opts?: {
  tenantSlug?: string;
  agent?: string;
  limit?: number;
}): AgentLedgerEntry[] {
  let list = root().entries;
  if (opts?.tenantSlug) list = list.filter((e) => e.tenantSlug === opts.tenantSlug);
  if (opts?.agent) list = list.filter((e) => e.agent === opts.agent);
  return list.slice(0, opts?.limit ?? 50);
}

export function resetAgentLedgerForTests(): void {
  root().entries = [];
}
