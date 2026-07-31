// Durable swarm state — file-backed for awaken/daemon workers.
// Enabled when not on Vercel, or SWARM_PERSIST=1.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { JournalEntry, SwarmTask, WorktreeJob } from "@/lib/swarm/types";

export type PersistedDaemonSlice = {
  cycle: number;
  agendaIndex: number;
  tenantSlug: string;
  intervalMs: number;
  lastTickAt: string | null;
  running: boolean;
  /** Cron should keep ticking even without in-process setInterval */
  cronEnabled: boolean;
};

export type PersistedSwarm = {
  tasks: SwarmTask[];
  journals: JournalEntry[];
  worktrees: WorktreeJob[];
  daemon: PersistedDaemonSlice;
};

const DIR = join(process.cwd(), ".swarm-data");
const FILE = join(DIR, "state.json");

function canUseFs(): boolean {
  if (process.env.SWARM_PERSIST === "0") return false;
  if (process.env.NODE_ENV === "test" && process.env.SWARM_PERSIST !== "1") return false;
  if (process.env.VERCEL === "1" && process.env.SWARM_PERSIST !== "1") return false;
  return true;
}

export function loadPersistedSwarm(): PersistedSwarm | null {
  if (!canUseFs()) return null;
  try {
    if (!existsSync(FILE)) return null;
    return JSON.parse(readFileSync(FILE, "utf8")) as PersistedSwarm;
  } catch {
    return null;
  }
}

export function savePersistedSwarm(data: PersistedSwarm): void {
  if (!canUseFs()) return;
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // best-effort on read-only FS
  }
}

export function defaultPersisted(): PersistedSwarm {
  return {
    tasks: [],
    journals: [],
    worktrees: [],
    daemon: {
      cycle: 0,
      agendaIndex: 0,
      tenantSlug: "bypilar",
      intervalMs: 60_000,
      lastTickAt: null,
      running: false,
      cronEnabled: true,
    },
  };
}
