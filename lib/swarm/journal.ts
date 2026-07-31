import { getSwarmMemory } from "@/lib/swarm/memory";
import type { JournalEntry, SAgentId } from "@/lib/swarm/types";

export function writeJournal(entry: Omit<JournalEntry, "id" | "at"> & { at?: string }): JournalEntry {
  const mem = getSwarmMemory();
  const full: JournalEntry = {
    id: `j_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: entry.at ?? new Date().toISOString(),
    agent: entry.agent,
    kind: entry.kind,
    taskId: entry.taskId,
    content: entry.content,
    meta: entry.meta,
  };
  mem.journals.unshift(full);
  // keep last 500
  if (mem.journals.length > 500) mem.journals.length = 500;
  return full;
}

export function listJournals(opts?: {
  taskId?: string;
  agent?: SAgentId | "H_BRIDGE" | "SYSTEM";
  limit?: number;
}): JournalEntry[] {
  let list = getSwarmMemory().journals;
  if (opts?.taskId) list = list.filter((j) => j.taskId === opts.taskId);
  if (opts?.agent) list = list.filter((j) => j.agent === opts.agent);
  return list.slice(0, opts?.limit ?? 50);
}
