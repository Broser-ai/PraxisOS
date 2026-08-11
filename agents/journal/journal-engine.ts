// PraxisOS agent self-reflection journal (swarm learning loop)
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { remember } from "@/agents/memory/swarm-memory";

export type ReflectionEntry = {
  id: string;
  agentId: string;
  tenant: string;
  prompt: string;
  outcome: string;
  lesson: string;
  score: number;
  createdAt: string;
};

type Store = { entries: ReflectionEntry[] };

const g = globalThis as typeof globalThis & { __praxisJournalEngine?: Store };

function dataDir(): string | null {
  return process.env.PRAXIS_DATA_DIR?.trim() || null;
}

function path(): string | null {
  const dir = dataDir();
  return dir ? join(dir, "swarm-journal.json") : null;
}

function store(): Store {
  if (!g.__praxisJournalEngine) {
    g.__praxisJournalEngine = { entries: [] };
    const p = path();
    if (p && existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<Store>;
        if (Array.isArray(raw.entries)) g.__praxisJournalEngine.entries = raw.entries;
      } catch {
        // ignore
      }
    }
  }
  return g.__praxisJournalEngine;
}

function persist() {
  const dir = dataDir();
  const p = path();
  if (!dir || !p) return;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(p, JSON.stringify({ entries: store().entries }, null, 2), "utf8");
  } catch {
    // ignore
  }
}

export async function reflect(input: {
  agentId: string;
  tenant?: string;
  prompt: string;
  outcome: string;
  lesson?: string;
  score?: number;
}): Promise<ReflectionEntry> {
  const lesson =
    input.lesson?.trim() ||
    deriveLesson(input.prompt, input.outcome);
  const entry: ReflectionEntry = {
    id: "ref_" + randomBytes(5).toString("hex"),
    agentId: input.agentId,
    tenant: input.tenant ?? "bypilar",
    prompt: input.prompt.trim(),
    outcome: input.outcome.trim(),
    lesson,
    score: typeof input.score === "number" ? input.score : 0.5,
    createdAt: new Date().toISOString(),
  };
  store().entries.unshift(entry);
  if (store().entries.length > 500) store().entries.length = 500;
  persist();
  await remember({
    kind: "reflection",
    tenant: entry.tenant,
    text: `${entry.agentId}: ${entry.lesson}`,
    meta: { reflectionId: entry.id, score: entry.score },
  });
  return entry;
}

function deriveLesson(prompt: string, outcome: string): string {
  const failed = /fejl|error|fail|critical/i.test(outcome);
  if (failed) {
    return `Ved lignende opgaver (${prompt.slice(0, 80)}): eskalér tidligere og log klinisk kontekst.`;
  }
  return `Succesmønster: ${prompt.slice(0, 60)} → ${outcome.slice(0, 80)}`;
}

export function listReflections(opts?: { agentId?: string; tenant?: string; limit?: number }) {
  const tenant = opts?.tenant ?? "bypilar";
  const limit = opts?.limit ?? 20;
  return store()
    .entries.filter((e) => e.tenant === tenant && (!opts?.agentId || e.agentId === opts.agentId))
    .slice(0, limit);
}
