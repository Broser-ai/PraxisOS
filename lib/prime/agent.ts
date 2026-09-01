// PRIME · RLVR agent cycle (class_0 education + ops self-critique)

import {
  assertPrimeIntentAllowed,
  pathologyShadowStatus,
} from "@/lib/prime/gates";
import { appendPrimeLedger } from "@/lib/prime/ledger";
import { proposePolicyFromScores } from "@/lib/prime/policy";
import { getQuizItem, listQuizItems } from "@/lib/prime/quiz-pack";
import { meanReward, scoreQuizAnswer } from "@/lib/prime/reward";
import {
  PRIME_INVARIANTS,
  type PrimeDomain,
  type PrimeRunResult,
  type RewardScore,
} from "@/lib/prime/types";

export type PrimeAttempt = {
  itemId: string;
  answer: string;
};

export type RunPrimeInput = {
  tenantSlug: string;
  /** Optional free-text brief (gated for clinical intent) */
  brief?: string;
  attempts?: PrimeAttempt[];
  /** If no attempts, sample N items and score empty → reward 0 (probe) */
  sampleSize?: number;
  domain?: PrimeDomain;
  proposePolicy?: boolean;
};

/**
 * Run one Prime RLVR cycle.
 * Produces verifiable rewards + optional human-gated policy proposal.
 * Never trains models; never diagnoses/treats.
 */
export function runPrimeCycle(input: RunPrimeInput): PrimeRunResult {
  const brief = input.brief ?? "RLVR quiz cycle · class_0 education";
  const intent = assertPrimeIntentAllowed(brief);
  if (!intent.ok) {
    const ledger = appendPrimeLedger({
      kind: "gate",
      tenantSlug: input.tenantSlug,
      content: intent.reason,
      meta: { code: intent.code },
    });
    return {
      ok: false,
      summary: intent.reason,
      scores: [],
      meanReward: 0,
      proposals: [],
      ledgerIds: [ledger.id],
      invariants: PRIME_INVARIANTS,
    };
  }

  const scores: RewardScore[] = [];
  const attempts = input.attempts ?? [];

  if (attempts.length > 0) {
    for (const a of attempts) {
      const item = getQuizItem(a.itemId);
      if (!item) continue;
      const score = scoreQuizAnswer(item, a.answer);
      scores.push(score);
      appendPrimeLedger({
        kind: "quiz_attempt",
        tenantSlug: input.tenantSlug,
        content: `${score.itemId} reward=${score.reward}`,
        meta: { correct: score.correct, domain: item.domain },
      });
    }
  } else {
    const sample = listQuizItems(input.domain).slice(
      0,
      Math.max(1, Math.min(input.sampleSize ?? 5, 20)),
    );
    for (const item of sample) {
      // Probe without learner answer → reward 0 (dataset readiness signal)
      const score = scoreQuizAnswer(item, "");
      scores.push(score);
      appendPrimeLedger({
        kind: "quiz_attempt",
        tenantSlug: input.tenantSlug,
        content: `probe ${item.id} (no answer) reward=0`,
        meta: { probe: true, domain: item.domain },
      });
    }
  }

  const avg = meanReward(scores);
  const proposals = [];
  const ledgerIds: string[] = [];

  if (input.proposePolicy !== false && scores.length > 0) {
    const proposal = proposePolicyFromScores({
      tenantSlug: input.tenantSlug,
      scores,
      meanReward: avg,
    });
    if (!("error" in proposal)) {
      proposals.push(proposal);
    }
  }

  const shadow = pathologyShadowStatus();
  const summaryLedger = appendPrimeLedger({
    kind: "swarm_signal",
    tenantSlug: input.tenantSlug,
    content: `Prime cycle complete · n=${scores.length} meanReward=${avg.toFixed(3)} · pathology=${shadow.mode}`,
    meta: {
      meanReward: avg,
      proposals: proposals.map((p) => p.id),
      pathology: shadow,
      invariants: PRIME_INVARIANTS,
    },
  });
  ledgerIds.push(summaryLedger.id);

  return {
    ok: true,
    summary: [
      `Prime RLVR · ${scores.length} items · meanReward=${avg.toFixed(3)}`,
      `proposals=${proposals.length} (awaiting human)`,
      `pathology=${shadow.mode} · training=${PRIME_INVARIANTS.NO_MODEL_TRAINING ? "forbidden" : "BROKEN"}`,
      "Actions: review quiz misses · human-adjudicate policy · never auto-diagnose",
    ].join("\n"),
    scores,
    meanReward: avg,
    proposals,
    ledgerIds,
    invariants: PRIME_INVARIANTS,
  };
}
