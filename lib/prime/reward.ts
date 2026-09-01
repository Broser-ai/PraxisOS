// Verifiable reward scoring · exact-match RLVR (no learned critic)

import type { QuizItem, RewardScore } from "@/lib/prime/types";

export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå.\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreQuizAnswer(item: QuizItem, givenRaw: string): RewardScore {
  const given = normalizeAnswer(givenRaw);
  const expected = normalizeAnswer(item.answer);
  const aliases = (item.aliases ?? []).map(normalizeAnswer);
  const correct =
    given.length > 0 && (given === expected || aliases.includes(given));

  return {
    itemId: item.id,
    correct,
    reward: correct ? 1 : 0,
    given,
    expected,
    explanation: item.explanation,
  };
}

export function meanReward(scores: RewardScore[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, s) => acc + s.reward, 0);
  return sum / scores.length;
}
