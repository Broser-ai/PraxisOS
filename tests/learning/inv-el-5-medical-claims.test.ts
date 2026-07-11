// INV-EL-5 unbacked medical claims test
// Kontrakt: docs/harness/EPIC-4-ELearning.md §4

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  detectUnbackedClaims,
  assertNoUnbackedClaims,
} from "@/lib/learning/medical-claims";

describe("INV-EL-5 · unbacked medical claims", () => {
  it("(a) tekst uden claims → ingen issues", () => {
    const text = "Vi taler i dag om fodpleje generelt.";
    expect(detectUnbackedClaims(text, "da")).toEqual([]);
  });

  it("(b) claim MED reference-marker → OK", () => {
    const text = "Du har diabetes. [ref: DSAM]";
    expect(detectUnbackedClaims(text, "da")).toEqual([]);
  });

  it("(c) claim UDEN reference → issue", () => {
    const text = "Du har diabetes og skal starte behandling.";
    const issues = detectUnbackedClaims(text, "da");
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.hasReference).toBe(false);
  });

  it("(d) behandlings-anbefaling uden ref → issue", () => {
    const text = "Tag 500 mg af dette dagligt.";
    const issues = detectUnbackedClaims(text, "da");
    expect(issues.length).toBeGreaterThan(0);
  });

  it("(e) assertNoUnbackedClaims kaster INV-EL-5", () => {
    expect(() =>
      assertNoUnbackedClaims("Du har diabetes uden reference.", "da"),
    ).toThrow(/INV-EL-5/);
    expect(() =>
      assertNoUnbackedClaims("Sikker tekst. [ref: NICE]", "da"),
    ).not.toThrow();
  });

  it("(f) property-based · syntetiske tekster med/uden ref", async () => {
    await fc.assert(
      fc.property(
        fc.constantFrom(
          "Du har diabetes.",
          "Dette er diabetes.",
          "Tag 500 mg dagligt.",
          "reducerer risikoen for hjertesygdom.",
        ),
        fc.boolean(),
        (claim, addRef) => {
          const text = addRef ? `${claim} [ref: Source]` : claim;
          const issues = detectUnbackedClaims(text, "da");
          if (addRef) {
            expect(issues.length).toBe(0);
          } else {
            expect(issues.length).toBeGreaterThan(0);
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
