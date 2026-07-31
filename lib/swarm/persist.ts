// Durable swarm state — file-backed for awaken workers + Supabase for Vercel.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getServiceSupabase, isSupabaseConfigured } from "@/lib/supabase";
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
const SNAPSHOT_ID = "global";

function canUseFs(): boolean {
  if (process.env.SWARM_PERSIST === "0") return false;
  if (process.env.NODE_ENV === "test" && process.env.SWARM_PERSIST !== "1") return false;
  if (process.env.VERCEL === "1" && process.env.SWARM_PERSIST !== "1") return false;
  return true;
}

function canUseSupabase(): boolean {
  if (process.env.SWARM_PERSIST === "0") return false;
  if (process.env.NODE_ENV === "test" && process.env.SWARM_SUPABASE !== "1") return false;
  return isSupabaseConfigured();
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
  if (canUseFs()) {
    try {
      mkdirSync(DIR, { recursive: true });
      writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
    } catch {
      // best-effort on read-only FS
    }
  }
  // Cross-instance durability (Vercel): fire-and-forget Supabase upsert
  void savePersistedSwarmToSupabase(data);
}

export async function loadPersistedSwarmFromSupabase(): Promise<PersistedSwarm | null> {
  if (!canUseSupabase()) return null;
  const sb = getServiceSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("swarm_snapshots")
      .select("payload, updated_at, revision")
      .eq("id", SNAPSHOT_ID)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return data.payload as PersistedSwarm;
  } catch {
    return null;
  }
}

export async function savePersistedSwarmToSupabase(
  data: PersistedSwarm,
): Promise<boolean> {
  if (!canUseSupabase()) return false;
  const sb = getServiceSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from("swarm_snapshots").upsert(
      {
        id: SNAPSHOT_ID,
        tenant_slug: data.daemon.tenantSlug,
        payload: {
          tasks: data.tasks.slice(0, 200),
          journals: data.journals.slice(0, 500),
          worktrees: data.worktrees.slice(0, 50),
          daemon: data.daemon,
        },
      },
      { onConflict: "id" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Prefer Supabase (shared), else local file. */
export async function loadPersistedSwarmPreferRemote(): Promise<PersistedSwarm | null> {
  const remote = await loadPersistedSwarmFromSupabase();
  if (remote) return remote;
  return loadPersistedSwarm();
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
