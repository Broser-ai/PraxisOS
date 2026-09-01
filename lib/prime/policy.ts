// Policy proposals · suggestion-only weight deltas (human-gated)

import { assertNoClinicalPolicyDelta } from "@/lib/prime/gates";
import { appendPrimeLedger } from "@/lib/prime/ledger";
import type { PolicyProposal, RewardScore } from "@/lib/prime/types";

type PolicyRoot = {
  proposals: PolicyProposal[];
};

const KEY = "__praxisos_prime_policy_v1__";

function getRoot(): PolicyRoot {
  const g = globalThis as typeof globalThis & { [KEY]?: PolicyRoot };
  if (!g[KEY]) g[KEY] = { proposals: [] };
  return g[KEY];
}

function newId(): string {
  return `pp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * From quiz scores, propose *ops/education* weight nudges.
 * Never touches clinical thresholds or pathology routing.
 */
export function proposePolicyFromScores(input: {
  tenantSlug: string;
  scores: RewardScore[];
  meanReward: number;
}): PolicyProposal | { error: string } {
  const suggestedDeltas: Record<string, number> = {
    quiz_item_weight: Number((input.meanReward - 0.5).toFixed(3)),
    ops_self_critique: input.meanReward < 0.5 ? 0.05 : 0.01,
  };

  const gate = assertNoClinicalPolicyDelta(suggestedDeltas);
  if (!gate.ok) return { error: gate.reason };

  const proposal: PolicyProposal = {
    id: newId(),
    at: new Date().toISOString(),
    tenantSlug: input.tenantSlug,
    title: "RLVR quiz weight nudge (education only)",
    rationale: `meanReward=${input.meanReward.toFixed(3)} over ${input.scores.length} items · class_0 only`,
    suggestedDeltas,
    status: "awaiting_human",
    clinicalImpact: "none",
  };

  getRoot().proposals.unshift(proposal);
  appendPrimeLedger({
    kind: "policy_proposal",
    tenantSlug: input.tenantSlug,
    content: `Proposal ${proposal.id} awaiting human · ${proposal.title}`,
    meta: { proposalId: proposal.id, deltas: suggestedDeltas },
  });

  return proposal;
}

export function listPolicyProposals(tenantSlug?: string): PolicyProposal[] {
  const list = getRoot().proposals;
  return tenantSlug
    ? list.filter((p) => p.tenantSlug === tenantSlug)
    : list.slice();
}

/**
 * Human adjudication for policy promotion. Agents cannot self-approve.
 */
export function adjudicatePolicyProposal(input: {
  proposalId: string;
  approve: boolean;
  adjudicator: string;
  approveToken?: string;
}): PolicyProposal | { error: string } {
  const proposal = getRoot().proposals.find((p) => p.id === input.proposalId);
  if (!proposal) return { error: "proposal_not_found" };

  const adjudicator = input.adjudicator.trim();
  if (!adjudicator) return { error: "adjudicator_required" };
  if (
    /^(agent|bot|prime|system|auto|cursor|ci)\b/i.test(adjudicator)
  ) {
    return { error: "adjudication_agent_self_label_forbidden" };
  }

  const expected =
    process.env.PRIME_APPROVE_TOKEN ||
    process.env.SWARM_APPROVE_TOKEN ||
    (process.env.NODE_ENV === "production" ? null : "I-APPROVE-PRIME");
  if (!expected || input.approveToken !== expected) {
    proposal.status = "rejected";
    appendPrimeLedger({
      kind: "adjudication",
      tenantSlug: proposal.tenantSlug,
      content: `REJECTED ${proposal.id} — invalid token`,
      meta: { proposalId: proposal.id },
    });
    return { error: "invalid_approve_token" };
  }

  proposal.status = input.approve ? "approved" : "rejected";
  proposal.approvedBy = adjudicator;
  proposal.approvedAt = new Date().toISOString();

  appendPrimeLedger({
    kind: "adjudication",
    tenantSlug: proposal.tenantSlug,
    content: `${proposal.status.toUpperCase()} ${proposal.id} by ${adjudicator}`,
    meta: {
      proposalId: proposal.id,
      deltas: proposal.suggestedDeltas,
      note: "Deltas recorded as suggestions — not applied to clinical routes",
    },
  });

  return proposal;
}

export function resetPrimePolicyForTests(): void {
  const g = globalThis as typeof globalThis & { [KEY]?: PolicyRoot };
  g[KEY] = { proposals: [] };
}
