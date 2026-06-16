// Supabase-client wrapper · drop-in til mock-data nu, swap til ægte Supabase ved deploy
//
// Tre modes styres af env.PRAXIS_DB:
//   - "mock"        : returnerer fra in-memory mock (default i prototypen)
//   - "supabase-local": kører mod lokal Supabase via supabase CLI (localhost:54321)
//   - "supabase-eu" : kører mod produktion (eu-central-1)
//
// Alle API-routes kan kalde getDb() og få samme interface — det er kun storage-laget
// der skifter når vi går fra prototype → ægte backend.

export type DbMode = "mock" | "supabase-local" | "supabase-eu";

const VALID_MODES: ReadonlyArray<DbMode> = ["mock", "supabase-local", "supabase-eu"];
const _rawMode = process.env.PRAXIS_DB?.trim() ?? "mock";
export const DB_MODE: DbMode = VALID_MODES.includes(_rawMode as DbMode) ? (_rawMode as DbMode) : "mock";

export type DbConfig = {
  mode: DbMode;
  url: string;
  region: string;
  rlsEnabled: boolean;
  poolMin: number;
  poolMax: number;
  pgvector: boolean;
};

export const DB_CONFIGS: Record<DbMode, DbConfig> = {
  "mock": {
    mode: "mock",
    url: "in-memory · lib/*.ts",
    region: "lokal",
    rlsEnabled: false,
    poolMin: 0,
    poolMax: 0,
    pgvector: false,
  },
  "supabase-local": {
    mode: "supabase-local",
    url: "http://127.0.0.1:54321",
    region: "lokal (docker)",
    rlsEnabled: true,
    poolMin: 2,
    poolMax: 10,
    pgvector: true,
  },
  "supabase-eu": {
    mode: "supabase-eu",
    url: "https://[project].supabase.co",
    region: "eu-central-1 · Frankfurt",
    rlsEnabled: true,
    poolMin: 5,
    poolMax: 50,
    pgvector: true,
  },
};

export const currentConfig = DB_CONFIGS[DB_MODE] ?? DB_CONFIGS["mock"];

// ========================================================================
// Generic interface · samme shape uanset backend
// ========================================================================

export type DbResult<T> = { data: T[]; count: number; error: null } | { data: null; count: 0; error: string };

// Stub-implementering. I prod erstattes med @supabase/supabase-js calls.
// Det vigtige er at API'en er ens på begge sider.
export const db = {
  mode: DB_MODE,
  config: currentConfig,

  // Tenant
  async setTenantContext(tenantId: string, role: string) {
    // I prod: await sb.rpc('set_config', { setting_name: 'app.tenant_id', new_value: tenantId, is_local: true })
    // Her: no-op (mock har ikke RLS)
    return { tenantId, role };
  },

  // List tenants (kun support kan se alle)
  async listTenants() {
    return { data: [], count: 0, error: null };  // stub
  },

  // Connectivity test
  async ping(): Promise<{ ok: boolean; latencyMs: number; mode: DbMode; region: string }> {
    const start = Date.now();
    // Mock: no-op
    return {
      ok: true,
      latencyMs: Date.now() - start,
      mode: DB_MODE,
      region: currentConfig.region,
    };
  },
};

// ========================================================================
// Migration-status (hvad ville være kørt i Postgres)
// ========================================================================

export const MIGRATIONS = [
  { version: "0001", name: "initial_schema", description: "Tabeller, RLS, hash-chain audit, pgvector", status: "ready" },
  { version: "0002", name: "seed_demo_data", description: "Seed bypilar + nordlys + 5 klienter", status: "ready" },
  { version: "0003", name: "agent_ledger",   description: "Agent-aktivitets-log + LLM-call-metrics", status: "planned" },
  { version: "0004", name: "scan_meshes",    description: "Object storage refs for 3D-fod-meshes", status: "planned" },
];

export const TABLES = [
  { name: "tenants",             rows: 2,   sizeKb: 4,    rls: true },
  { name: "users",                rows: 6,   sizeKb: 5,    rls: false },
  { name: "memberships",         rows: 7,   sizeKb: 2,    rls: false },
  { name: "services",            rows: 9,   sizeKb: 8,    rls: true },
  { name: "clients",             rows: 5,   sizeKb: 12,   rls: true },
  { name: "bookings",            rows: 14,  sizeKb: 24,   rls: true },
  { name: "journals",            rows: 12,  sizeKb: 18,   rls: true },
  { name: "journal_entries",     rows: 47,  sizeKb: 142,  rls: true },
  { name: "scans",                rows: 31,  sizeKb: 286,  rls: true },
  { name: "payments",            rows: 12,  sizeKb: 18,   rls: true },
  { name: "vouchers",            rows: 4,   sizeKb: 6,    rls: true },
  { name: "subsidy_schemes",     rows: 11,  sizeKb: 4,    rls: true },
  { name: "reports",              rows: 7,   sizeKb: 12,   rls: true },
  { name: "events",               rows: 247, sizeKb: 89,   rls: true },
  { name: "audit_log",           rows: 1247, sizeKb: 412,  rls: true },
  { name: "module_activations",  rows: 22,  sizeKb: 6,    rls: true },
  { name: "api_keys",             rows: 5,   sizeKb: 3,    rls: true },
  { name: "webhook_subscriptions", rows: 2,  sizeKb: 2,    rls: true },
];
