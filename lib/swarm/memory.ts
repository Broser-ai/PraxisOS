import type { JournalEntry, SwarmTask, WorktreeJob } from "@/lib/swarm/types";

type SwarmMemoryRoot = {
  tasks: SwarmTask[];
  journals: JournalEntry[];
  worktrees: WorktreeJob[];
};

const KEY = "__praxisos_swarm_memory_v1__";

function empty(): SwarmMemoryRoot {
  return { tasks: [], journals: [], worktrees: [] };
}

export function getSwarmMemory(): SwarmMemoryRoot {
  const g = globalThis as typeof globalThis & { [KEY]?: SwarmMemoryRoot };
  if (!g[KEY]) g[KEY] = empty();
  return g[KEY];
}

export function resetSwarmMemoryForTests(): void {
  const g = globalThis as typeof globalThis & { [KEY]?: SwarmMemoryRoot };
  g[KEY] = empty();
}
