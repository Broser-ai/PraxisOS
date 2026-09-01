import { appendAgentLedger } from "@/lib/agents/ledger";
import { publishSwarmEvent } from "@/lib/swarm/events";
import { flushSwarmMemory, getSwarmMemory } from "@/lib/swarm/memory";
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
  if (mem.journals.length > 500) mem.journals.length = 500;
  publishSwarmEvent({ type: "journal", entry: full });
  flushSwarmMemory();
  appendAgentLedger({
    agent: full.agent,
    workflow: "swarm_journal",
    event: `journal_${full.kind}`,
    status: full.kind === "gate" ? "warn" : "ok",
    payload: {
      journalId: full.id,
      taskId: full.taskId,
      content: full.content.slice(0, 240),
      meta: full.meta ?? {},
    },
    at: full.at,
  });
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
