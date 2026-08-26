// Supabase client + mode switcher.
//
// PRAXIS_DB:
//   mock            — in-memory durable store (lib/data)
//   supabase-local  — local Supabase CLI
//   supabase-eu     — production EU project

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type DbMode = "mock" | "supabase-local" | "supabase-eu";

const VALID_MODES: ReadonlyArray<DbMode> = ["mock", "supabase-local", "supabase-eu"];
const _rawMode = process.env.PRAXIS_DB?.trim() ?? "mock";
export const DB_MODE: DbMode = VALID_MODES.includes(_rawMode as DbMode)
  ? (_rawMode as DbMode)
  : "mock";

export type DbConfig = {
  mode: DbMode;
  url: string;
  region: string;
  rlsEnabled: boolean;
  poolMin: number;
  poolMax: number;
  pgvector: boolean;
};

function resolveUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "https://jajdtvduzkitjzcazcng.supabase.co"
  );
}

export const DB_CONFIGS: Record<DbMode, DbConfig> = {
  mock: {
    mode: "mock",
    url: "in-memory · lib/data",
    region: "lokal",
    rlsEnabled: false,
    poolMin: 0,
    poolMax: 0,
    pgvector: false,
  },
  "supabase-local": {
    mode: "supabase-local",
    url: process.env.SUPABASE_URL?.trim() || "http://127.0.0.1:54321",
    region: "lokal (docker)",
    rlsEnabled: true,
    poolMin: 2,
    poolMax: 10,
    pgvector: true,
  },
  "supabase-eu": {
    mode: "supabase-eu",
    url: resolveUrl(),
    region: "eu-west-1 · Ireland",
    rlsEnabled: true,
    poolMin: 5,
    poolMax: 50,
    pgvector: true,
  },
};

export const currentConfig = DB_CONFIGS[DB_MODE] ?? DB_CONFIGS.mock;

function looksLikeSecret(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v || v === "[SENSITIVE]" || v.includes("SENSITIVE")) return false;
  // JWT-ish or long opaque key
  return v.length >= 20;
}

/** True when we can open a service-role Supabase client for server writes. */
export function isSupabaseConfigured(): boolean {
  if (DB_MODE === "mock") return false;
  const url = resolveUrl();
  if (!/^https?:\/\//i.test(url)) return false;
  return looksLikeSecret(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let _service: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (_service) return _service;
  const url = resolveUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  _service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _service;
}

export function getAnonSupabase(): SupabaseClient | null {
  const url = resolveUrl();
  const key =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!/^https?:\/\//i.test(url) || !looksLikeSecret(key)) return null;
  if (_anon) return _anon;
  _anon = createClient(url, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _anon;
}

export type DbResult<T> =
  | { data: T[]; count: number; error: null }
  | { data: null; count: 0; error: string };

export const db = {
  mode: DB_MODE,
  config: currentConfig,

  async setTenantContext(tenantId: string, role: string) {
    // Service-role bypasses RLS; route handlers filter by tenant_id explicitly.
    // When using anon/user JWT, call rpc set_config if available.
    return { tenantId, role };
  },

  async listTenants() {
    const sb = getServiceSupabase();
    if (!sb) return { data: [], count: 0, error: null as null };
    const { data, error, count } = await sb
      .from("tenants")
      .select("id,slug,legal_name,cvr,mode,locale", { count: "exact" });
    if (error) return { data: null, count: 0 as const, error: error.message };
    return { data: data ?? [], count: count ?? data?.length ?? 0, error: null };
  },

  async ping(): Promise<{
    ok: boolean;
    latencyMs: number;
    mode: DbMode;
    region: string;
    backend: "supabase" | "memory";
    detail?: string;
  }> {
    const start = Date.now();
    const sb = getServiceSupabase();
    if (!sb) {
      return {
        ok: true,
        latencyMs: Date.now() - start,
        mode: DB_MODE,
        region: currentConfig.region,
        backend: "memory",
        detail: isSupabaseConfigured()
          ? undefined
          : "SUPABASE_SERVICE_ROLE_KEY missing — using durable memory store",
      };
    }
    const { error } = await sb.from("tenants").select("id").limit(1);
    return {
      ok: !error,
      latencyMs: Date.now() - start,
      mode: DB_MODE,
      region: currentConfig.region,
      backend: "supabase",
      detail: error?.message,
    };
  },
};

export const MIGRATIONS = [
  { version: "0001", name: "initial_schema", description: "Tabeller, RLS, hash-chain audit, pgvector", status: "ready" },
  { version: "0002", name: "seed_demo_data", description: "Seed bypilar + nordlys + demo users/clients", status: "ready" },
  { version: "0003", name: "agent_ledger", description: "Agent-aktivitets-log + LLM-call-metrics", status: "planned" },
  { version: "0004", name: "scan_meshes", description: "Object storage refs for 3D-fod-meshes", status: "planned" },
];

export const TABLES = [
  { name: "tenants", rows: 2, sizeKb: 4, rls: true },
  { name: "users", rows: 6, sizeKb: 5, rls: false },
  { name: "memberships", rows: 7, sizeKb: 2, rls: false },
  { name: "services", rows: 9, sizeKb: 8, rls: true },
  { name: "clients", rows: 5, sizeKb: 12, rls: true },
  { name: "bookings", rows: 14, sizeKb: 24, rls: true },
  { name: "journals", rows: 12, sizeKb: 18, rls: true },
  { name: "journal_entries", rows: 47, sizeKb: 142, rls: true },
  { name: "scans", rows: 31, sizeKb: 286, rls: true },
  { name: "payments", rows: 12, sizeKb: 18, rls: true },
  { name: "vouchers", rows: 4, sizeKb: 6, rls: true },
  { name: "subsidy_schemes", rows: 11, sizeKb: 4, rls: true },
  { name: "reports", rows: 7, sizeKb: 12, rls: true },
  { name: "events", rows: 247, sizeKb: 89, rls: true },
  { name: "audit_log", rows: 1247, sizeKb: 412, rls: true },
  { name: "module_activations", rows: 22, sizeKb: 6, rls: true },
  { name: "api_keys", rows: 5, sizeKb: 3, rls: true },
  { name: "webhook_subscriptions", rows: 2, sizeKb: 2, rls: true },
];
