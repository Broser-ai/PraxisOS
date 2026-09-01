/**
 * Clean swarm wiring surface for Prime RL.
 * Swarm may call these without importing quiz internals.
 */

import { runPrimeCycle, type RunPrimeInput } from "@/lib/prime/agent";
import {
  adjudicatePolicyProposal,
  listPolicyProposals,
} from "@/lib/prime/policy";
import { listPrimeLedger } from "@/lib/prime/ledger";
import { quizPackStats } from "@/lib/prime/quiz-pack";
import { PRIME_INVARIANTS, type PrimeRunResult } from "@/lib/prime/types";
import type { SwarmTask } from "@/lib/swarm/types";

export type PrimeSwarmSignal = {
  agent: "PRIME_RL";
  taskId?: string;
  result: PrimeRunResult;
  pack: ReturnType<typeof quizPackStats>;
};

/** Map a swarm task into a Prime cycle (research/improve RL briefs). */
export function runPrimeForSwarmTask(task: SwarmTask): PrimeSwarmSignal {
  const input: RunPrimeInput = {
    tenantSlug: task.tenantSlug,
    brief: `${task.title}\n${task.brief}`,
    sampleSize: 5,
    proposePolicy: true,
  };
  const result = runPrimeCycle(input);
  return {
    agent: "PRIME_RL",
    taskId: task.id,
    result,
    pack: quizPackStats(),
  };
}

export function getPrimeSwarmStatus(tenantSlug?: string) {
  return {
    invariants: PRIME_INVARIANTS,
    pack: quizPackStats(),
    proposals: listPolicyProposals(tenantSlug).slice(0, 10),
    ledger: listPrimeLedger({ tenantSlug, limit: 20 }),
  };
}

export { adjudicatePolicyProposal };
