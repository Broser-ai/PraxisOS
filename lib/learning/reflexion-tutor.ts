// Reflexion Tutor pattern: tutor genererer → reflexion scorer → op til 3 iterationer.
// Kontrakt: docs/harness/EPIC-4-ELearning.md §3, INV-EL-3

import { assertNoUnbackedClaims } from "./medical-claims";
import { meanScore, type ReflexionScore, type Language } from "./schema";

export const MAX_REFLEXION_ITERATIONS = 3;   // INV-EL-3
export const ACCEPTANCE_THRESHOLD = 0.8;

export type TutorContext = {
  clientQuery: string;
  retrievedContent: string[];   // markdown-uddrag fra RAG
  language: Language;
  findingsSummary?: string;
};

export type TutorOutput = {
  answer_md: string;
  citations: string[];          // list of source_urls
};

export type TutorFn = (
  ctx: TutorContext,
  feedback?: string,
) => Promise<TutorOutput>;

export type ReflexionFn = (
  output: TutorOutput,
  ctx: TutorContext,
) => Promise<ReflexionScore & { feedback: string }>;

export type ReflexionRunResult = {
  final: TutorOutput;
  iterations: number;
  scores: ReflexionScore[];
  acceptedAt: number | null;    // iteration hvor accept skete (null hvis vi ramte max)
};

/**
 * Kør reflexion loop. Højst MAX_REFLEXION_ITERATIONS iterations (INV-EL-3).
 * Hver runde tjekkes INV-EL-5 (no unbacked medical claims) — hvis fejl,
 * bubbler op og loop stopper.
 */
export async function runReflexionLoop(
  tutor: TutorFn,
  reflexion: ReflexionFn,
  ctx: TutorContext,
): Promise<ReflexionRunResult> {
  let output = await tutor(ctx);
  assertNoUnbackedClaims(output.answer_md, ctx.language);

  const scores: ReflexionScore[] = [];
  let acceptedAt: number | null = null;

  for (let i = 0; i < MAX_REFLEXION_ITERATIONS; i++) {
    const scored = await reflexion(output, ctx);
    const { feedback, ...scoreOnly } = scored;
    scores.push(scoreOnly);

    if (meanScore(scoreOnly) >= ACCEPTANCE_THRESHOLD) {
      acceptedAt = i + 1;
      break;
    }

    if (i < MAX_REFLEXION_ITERATIONS - 1) {
      output = await tutor(ctx, feedback);
      assertNoUnbackedClaims(output.answer_md, ctx.language);
    }
  }

  return {
    final: output,
    iterations: scores.length,
    scores,
    acceptedAt,
  };
}

// ---------------------------------------------------------------------------
// Stub-tutor og stub-reflexion til tests
// ---------------------------------------------------------------------------

export function createStubTutor(): TutorFn {
  return async (ctx) => ({
    answer_md: `[STUB] Om ${ctx.clientQuery.substring(0, 30)}. [ref: Sundhedsstyrelsen]`,
    citations: ["https://www.sst.dk"],
  });
}

/** Reflexion-stub der accepterer med det samme (score = 0.9). */
export function createHighScoreReflexion(): ReflexionFn {
  return async () => ({
    factual_accuracy: 0.9,
    evidence_citation: 0.9,
    language_accessibility: 0.9,
    client_relevance: 0.9,
    feedback: "OK",
  });
}

/** Reflexion-stub der ALDRIG accepterer (score = 0.5) — bruges til INV-EL-3 test. */
export function createNeverAcceptReflexion(): ReflexionFn {
  return async () => ({
    factual_accuracy: 0.5,
    evidence_citation: 0.5,
    language_accessibility: 0.5,
    client_relevance: 0.5,
    feedback: "Not good enough",
  });
}
