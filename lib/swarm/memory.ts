import {
  defaultPersisted,
  loadPersistedSwarm,
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
  };
}

export function getSwarmMemory(): SwarmMemoryRoot {
  const g = globalThis as typeof globalThis & { [KEY]?: SwarmMemoryRoot };
  if (!g[KEY]) g[KEY] = empty();
  if (!g[KEY].hydrated) {
    const disk = loadPersistedSwarm();
    if (disk) {
      g[KEY].tasks = disk.tasks;
      g[KEY].journals = disk.journals;
      g[KEY].worktrees = disk.worktrees;
      g[KEY].daemonSlice = disk.daemon;
    }
    g[KEY].hydrated = true;
  }
  return g[KEY];
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

export function resetSwarmMemoryForTests(): void {
  const g = globalThis as typeof globalThis & { [KEY]?: SwarmMemoryRoot };
  g[KEY] = empty();
  g[KEY].hydrated = true; // skip disk in tests
}
