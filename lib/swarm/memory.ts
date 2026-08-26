import {
  defaultPersisted,
  loadPersistedSwarm,
  loadPersistedSwarmPreferRemote,
  savePersistedSwarm,
  type PersistedDaemonSlice,
} from "@/lib/swarm/persist";
import type { JournalEntry, SwarmTask, WorktreeJob } from "@/lib/swarm/types";

type SwarmMemoryRoot = {
  tasks: SwarmTask[];
  journals: JournalEntry[];
  worktrees: WorktreeJob[];
  daemonSlice: PersistedDaemonSlice;
  hydrated: boolean;
  remoteHydrated: boolean;
};

const KEY = "__praxisos_swarm_memory_v1__";

function empty(): SwarmMemoryRoot {
  const d = defaultPersisted();
  return {
    tasks: d.tasks,
    journals: d.journals,
    worktrees: d.worktrees,
    daemonSlice: d.daemon,
    hydrated: false,
    remoteHydrated: false,
  };
}

function applyDisk(root: SwarmMemoryRoot, disk: ReturnType<typeof defaultPersisted>): void {
  root.tasks = disk.tasks;
  root.journals = disk.journals;
  root.worktrees = disk.worktrees;
  root.daemonSlice = disk.daemon;
}

export function getSwarmMemory(): SwarmMemoryRoot {
  const g = globalThis as typeof globalThis & { [KEY]?: SwarmMemoryRoot };
  if (!g[KEY]) g[KEY] = empty();
  if (!g[KEY].hydrated) {
    const disk = loadPersistedSwarm();
    if (disk) applyDisk(g[KEY], disk);
    g[KEY].hydrated = true;
  }
  return g[KEY];
}

/** Pull shared Supabase snapshot when available (Vercel multi-instance). */
export async function ensureSwarmRemoteHydrated(opts?: {
  force?: boolean;
}): Promise<void> {
  const mem = getSwarmMemory();
  if (mem.remoteHydrated && !opts?.force) return;
  const remote = await loadPersistedSwarmPreferRemote();
  if (remote) {
    // Prefer remote if it has more progress (higher cycle or more journals)
    const localCycle = mem.daemonSlice.cycle;
    const remoteCycle = remote.daemon.cycle;
    if (
      remoteCycle > localCycle ||
      remote.journals.length > mem.journals.length ||
      (mem.tasks.length === 0 && remote.tasks.length > 0)
    ) {
      applyDisk(mem, remote);
    }
  }
  mem.remoteHydrated = true;
}

export function flushSwarmMemory(): void {
  const mem = getSwarmMemory();
  savePersistedSwarm({
    tasks: mem.tasks.slice(0, 200),
    journals: mem.journals.slice(0, 500),
    worktrees: mem.worktrees.slice(0, 50),
    daemon: mem.daemonSlice,
  });
}

export async function flushSwarmMemoryAsync(): Promise<void> {
  flushSwarmMemory();
}

export function resetSwarmMemoryForTests(): void {
  const g = globalThis as typeof globalThis & { [KEY]?: SwarmMemoryRoot };
  g[KEY] = empty();
  g[KEY].hydrated = true; // skip disk in tests
  g[KEY].remoteHydrated = true;
}
