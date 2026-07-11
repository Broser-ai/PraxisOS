// INV-EL-3 max reflexion iterations test
// Kontrakt: docs/harness/EPIC-4-ELearning.md §4

import { describe, it, expect } from "vitest";
import {
  runReflexionLoop,
  createStubTutor,
  createHighScoreReflexion,
  createNeverAcceptReflexion,
  MAX_REFLEXION_ITERATIONS,
} from "@/lib/learning/reflexion-tutor";

describe("INV-EL-3 · max 3 reflexion iterationer", () => {
  it("(a) MAX_REFLEXION_ITERATIONS = 3", () => {
    expect(MAX_REFLEXION_ITERATIONS).toBe(3);
  });

  it("(b) high-score reflexion accepterer på iteration 1", async () => {
    const result = await runReflexionLoop(
      createStubTutor(),
      createHighScoreReflexion(),
      {
        clientQuery: "Hvad er hallux valgus?",
        retrievedContent: [],
        language: "da",
      },
    );
    expect(result.iterations).toBe(1);
    expect(result.acceptedAt).toBe(1);
  });

  it("(c) never-accept reflexion terminerer efter præcis MAX iterations", async () => {
    const result = await runReflexionLoop(
      createStubTutor(),
      createNeverAcceptReflexion(),
      {
        clientQuery: "Hvad er en callus?",
        retrievedContent: [],
        language: "da",
      },
    );
    expect(result.iterations).toBe(MAX_REFLEXION_ITERATIONS);
    expect(result.acceptedAt).toBeNull();
  });

  it("(d) intermediate accept: hardcoded scorer der accept'er på 2. iteration", async () => {
    let call = 0;
    const reflexion = async () => {
      call++;
      return {
        factual_accuracy: call >= 2 ? 0.9 : 0.5,
        evidence_citation: call >= 2 ? 0.9 : 0.5,
        language_accessibility: call >= 2 ? 0.9 : 0.5,
        client_relevance: call >= 2 ? 0.9 : 0.5,
        feedback: "iterating",
      };
    };
    const result = await runReflexionLoop(
      createStubTutor(),
      reflexion,
      {
        clientQuery: "test",
        retrievedContent: [],
        language: "da",
      },
    );
    expect(result.iterations).toBe(2);
    expect(result.acceptedAt).toBe(2);
  });
});
