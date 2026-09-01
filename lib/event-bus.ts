// PraxisOS event-bus · shared publish/subscribe (in-memory + optional file mirror)
// Used by /api/events, agent worker, and MCP tool side-effects.

import { createHmac, randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export type PraxisEvent = {
  id: string;
  type: string;
  tenant: string;
  at: string;
  data: Record<string, unknown>;
  source?: string;
};

export type EventHandler = (event: PraxisEvent) => void | Promise<void>;

const g = globalThis as typeof globalThis & {
  __praxisEventLog?: PraxisEvent[];
  __praxisEventHandlers?: EventHandler[];
};

function log(): PraxisEvent[] {
  if (!g.__praxisEventLog) g.__praxisEventLog = [];
  return g.__praxisEventLog;
}

function handlers(): EventHandler[] {
  if (!g.__praxisEventHandlers) g.__praxisEventHandlers = [];
  return g.__praxisEventHandlers;
}

export function eventSecret(): string {
  return process.env.PRAXIS_EVENT_SECRET?.trim() || "demo-secret-key";
}

export function signEventPayload(raw: string): string {
  return createHmac("sha256", eventSecret()).update(raw).digest("hex");
}

export function verifyEventSignature(raw: string, sig: string | null): boolean {
  if (!sig) return false;
  const expected = signEventPayload(raw);
  // Timing-safe-ish compare for prototype (Node timingSafeEqual needs equal length)
  if (sig.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < sig.length; i++) ok |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return ok === 0;
}

function mirrorToDisk(evt: PraxisEvent) {
  const dir = process.env.PRAXIS_DATA_DIR?.trim();
  if (!dir) return;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "events.jsonl"), JSON.stringify(evt) + "\n", "utf8");
  } catch {
    // ephemeral FS / permission — ignore
  }
}

export function subscribe(handler: EventHandler): () => void {
  handlers().push(handler);
  return () => {
    const idx = handlers().indexOf(handler);
    if (idx >= 0) handlers().splice(idx, 1);
  };
}

export async function publishEvent(input: {
  type: string;
  tenant: string;
  data?: Record<string, unknown>;
  source?: string;
}): Promise<PraxisEvent> {
  const stored: PraxisEvent = {
    id: "evt_" + randomBytes(6).toString("hex"),
    type: input.type,
    tenant: input.tenant,
    at: new Date().toISOString(),
    data: input.data ?? {},
    source: input.source,
  };
  const L = log();
  L.unshift(stored);
  if (L.length > 2000) L.length = 2000;
  mirrorToDisk(stored);

  for (const h of handlers()) {
    try {
      await h(stored);
    } catch (err) {
      console.error("[event-bus] handler error", err);
    }
  }
  return stored;
}

export function listEvents(opts?: {
  tenant?: string | null;
  type?: string | null;
  limit?: number;
}): PraxisEvent[] {
  const limit = Math.min(500, opts?.limit ?? 50);
  return log()
    .filter((e) => {
      if (opts?.tenant && e.tenant !== opts.tenant) return false;
      if (opts?.type && !e.type.startsWith(opts.type)) return false;
      return true;
    })
    .slice(0, limit);
}

export function eventCount(): number {
  return log().length;
}
