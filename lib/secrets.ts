// Runtime secrets · stored under PRAXIS_DATA_DIR (survives container restart via volume)
// Used so Bird/OpenAI keys can be set from admin UI without rebuilding the image.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type PraxisSecrets = {
  BIRD_API_KEY?: string;
  BIRD_SMS_CHANNEL_ID?: string;
  BIRD_SMS_FROM?: string;
  BIRD_WORKSPACE_ID?: string;
  OPENAI_API_KEY?: string;
  /** Del Pilar Nexus · 3D lift (Replicate) */
  REPLICATE_API_TOKEN?: string;
  /** Del Pilar Nexus · segment + pathology (Roboflow) */
  ROBOFLOW_API_KEY?: string;
};

const g = globalThis as typeof globalThis & { __praxisSecretsCache?: PraxisSecrets | null };

function dataDir(): string | null {
  return process.env.PRAXIS_DATA_DIR?.trim() || null;
}

function secretsPath(): string | null {
  const dir = dataDir();
  return dir ? join(dir, "secrets.json") : null;
}

function looksLikeComment(v: string): boolean {
  const t = v.trim();
  return !t || t.startsWith("#") || t.startsWith("valgfri") || t.includes("uden key");
}

export function readSecrets(): PraxisSecrets {
  if (g.__praxisSecretsCache) return g.__praxisSecretsCache;
  const path = secretsPath();
  if (!path || !existsSync(path)) {
    g.__praxisSecretsCache = {};
    return g.__praxisSecretsCache;
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PraxisSecrets;
    g.__praxisSecretsCache = raw && typeof raw === "object" ? raw : {};
  } catch {
    g.__praxisSecretsCache = {};
  }
  return g.__praxisSecretsCache;
}

export function writeSecrets(patch: PraxisSecrets): PraxisSecrets {
  const dir = dataDir();
  const path = secretsPath();
  if (!dir || !path) {
    throw new Error("PRAXIS_DATA_DIR mangler — kan ikke gemme secrets");
  }
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const next: PraxisSecrets = { ...readSecrets() };
  for (const [k, v] of Object.entries(patch) as [keyof PraxisSecrets, string | undefined][]) {
    if (v === undefined) continue;
    const trimmed = v.trim();
    if (!trimmed) {
      delete next[k];
    } else {
      next[k] = trimmed;
    }
  }
  writeFileSync(path, JSON.stringify(next, null, 2), "utf8");
  g.__praxisSecretsCache = next;
  return next;
}

/** Env first (if real), then secrets file. Filters out comment-polluted env values. */
export function resolveSecret(key: keyof PraxisSecrets): string {
  const fromEnv = process.env[key]?.trim() ?? "";
  if (fromEnv && !looksLikeComment(fromEnv)) return fromEnv;
  const fromFile = readSecrets()[key]?.trim() ?? "";
  return fromFile;
}

function hintOf(value: string, head = 4, tail = 4): string | null {
  if (!value) return null;
  if (value.length <= head + tail) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function secretsPublicStatus() {
  const birdKey = resolveSecret("BIRD_API_KEY");
  const openai = resolveSecret("OPENAI_API_KEY");
  const channel = resolveSecret("BIRD_SMS_CHANNEL_ID");
  const replicate = resolveSecret("REPLICATE_API_TOKEN");
  const roboflow = resolveSecret("ROBOFLOW_API_KEY");
  return {
    birdKey: Boolean(birdKey),
    birdKeyHint: hintOf(birdKey),
    birdChannel: Boolean(channel),
    openai: Boolean(openai),
    openaiHint: hintOf(openai, 3, 4),
    replicate: Boolean(replicate),
    replicateHint: hintOf(replicate, 3, 4),
    roboflow: Boolean(roboflow),
    roboflowHint: hintOf(roboflow, 3, 4),
    liveScanReady: Boolean(replicate && roboflow),
    dataDir: Boolean(dataDir()),
  };
}
