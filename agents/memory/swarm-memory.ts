// PraxisOS swarm memory · file store + optional Supabase pgvector
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type MemoryKind = "observation" | "reflection" | "paper" | "scan" | "code";

export type SwarmMemoryItem = {
  id: string;
  kind: MemoryKind;
  tenant: string;
  text: string;
  embedding?: number[];
  meta: Record<string, unknown>;
  createdAt: string;
};

type Store = { items: SwarmMemoryItem[] };

const g = globalThis as typeof globalThis & { __praxisSwarmMemory?: Store };

function dataDir(): string | null {
  return process.env.PRAXIS_DATA_DIR?.trim() || null;
}

function storePath(): string | null {
  const dir = dataDir();
  return dir ? join(dir, "swarm-memory.json") : null;
}

function store(): Store {
  if (!g.__praxisSwarmMemory) {
    g.__praxisSwarmMemory = { items: [] };
    const path = storePath();
    if (path && existsSync(path)) {
      try {
        const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<Store>;
        if (Array.isArray(raw.items)) g.__praxisSwarmMemory.items = raw.items;
      } catch {
        // ignore corrupt store
      }
    }
  }
  return g.__praxisSwarmMemory;
}

function persist() {
  const dir = dataDir();
  const path = storePath();
  if (!dir || !path) return;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify({ items: store().items }, null, 2), "utf8");
  } catch {
    // ephemeral FS
  }
}

/** Deterministic local embedding (no API key) — cosine-searchable bag-of-chars hash. */
export function localEmbed(text: string, dims = 64): number[] {
  const vec = new Array<number>(dims).fill(0);
  const norm = text.toLowerCase().normalize("NFKD");
  for (let i = 0; i < norm.length; i++) {
    const code = norm.charCodeAt(i);
    vec[i % dims] += ((code * (i + 1)) % 97) / 97;
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / mag);
}

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot;
}

export async function remember(input: {
  kind: MemoryKind;
  tenant?: string;
  text: string;
  meta?: Record<string, unknown>;
}): Promise<SwarmMemoryItem> {
  const item: SwarmMemoryItem = {
    id: "mem_" + randomBytes(6).toString("hex"),
    kind: input.kind,
    tenant: input.tenant ?? "bypilar",
    text: input.text.trim(),
    embedding: localEmbed(input.text),
    meta: input.meta ?? {},
    createdAt: new Date().toISOString(),
  };
  store().items.unshift(item);
  if (store().items.length > 2000) store().items.length = 2000;
  persist();

  // Optional Supabase pgvector upsert when configured
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    try {
      await fetch(`${url}/rest/v1/swarm_memory`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id: item.id,
          kind: item.kind,
          tenant: item.tenant,
          text: item.text,
          embedding: item.embedding,
          meta: item.meta,
          created_at: item.createdAt,
        }),
      });
    } catch {
      // local store remains source of truth
    }
  }

  return item;
}

export function recall(query: string, opts?: { tenant?: string; kind?: MemoryKind; limit?: number }) {
  const q = localEmbed(query);
  const tenant = opts?.tenant ?? "bypilar";
  const limit = opts?.limit ?? 8;
  return store()
    .items.filter((i) => i.tenant === tenant && (!opts?.kind || i.kind === opts.kind))
    .map((i) => ({ item: i, score: cosine(q, i.embedding ?? localEmbed(i.text)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function memoryDigest(tenant = "bypilar"): string {
  const recent = store().items.filter((i) => i.tenant === tenant).slice(0, 12);
  if (!recent.length) return "Ingen swarm-hukommelse endnu.";
  return recent.map((i) => `[${i.kind}] ${i.text.slice(0, 120)}`).join("\n");
}

export function memoryFingerprint(): string {
  const raw = store().items.map((i) => i.id).join("|");
  return createHash("sha1").update(raw).digest("hex").slice(0, 12);
}
