import { describe, expect, it } from "vitest";
import {
  createCandidateAdjudicationDraft,
  summarizeAdjudicationPrecision,
} from "@/lib/scanner/adjudication";

describe("ShadowFlywheel clinician adjudication hook", () => {
  it("builds suggestion-only draft with routing OFF", () => {
    const rec = createCandidateAdjudicationDraft({
      scan_ref: "abc123",
      candidate_class: "candidate_open_wound",
      model_id: "broserai/praxisos-foot-candidates/1",
      decision: "agree",
      adjudicator: "Dr. Example",
      slice_tags: ["lighting_ok"],
    });
    expect(rec.schema).toBe("praxisos.candidate_adjudication.v1");
    expect(rec.clinical_status).toBe("suggestion_only");
    expect(rec.approved_for_active_routing).toBe(false);
    expect(rec.used_for_routing).toBe(false);
    expect(rec.decision).toBe("agree");
  });

  it("rejects agent self-label and invalid decision", () => {
    expect(() =>
      createCandidateAdjudicationDraft({
        scan_ref: "x",
        candidate_class: "candidate_open_wound",
        model_id: "m/1",
        decision: "agree",
        adjudicator: "cursor-agent",
      }),
    ).toThrow(/agent_self_label/);

    expect(() =>
      createCandidateAdjudicationDraft({
        scan_ref: "x",
        candidate_class: "candidate_open_wound",
        model_id: "m/1",
        // @ts-expect-error intentional
        decision: "diagnose",
        adjudicator: "Dr. Example",
      }),
    ).toThrow(/invalid_decision/);
  });

  it("summarizes precision proxy without claiming clinical GT", () => {
    const records = [
      createCandidateAdjudicationDraft({
        scan_ref: "1",
        candidate_class: "candidate_open_wound",
        model_id: "m/1",
        decision: "agree",
        adjudicator: "Clinician A",
      }),
      createCandidateAdjudicationDraft({
        scan_ref: "2",
        candidate_class: "candidate_open_wound",
        model_id: "m/1",
        decision: "agree",
        adjudicator: "Clinician A",
      }),
      createCandidateAdjudicationDraft({
        scan_ref: "3",
        candidate_class: "candidate_open_wound",
        model_id: "m/1",
        decision: "disagree",
        adjudicator: "Clinician B",
      }),
    ];
    const summary = summarizeAdjudicationPrecision(records, "candidate_open_wound");
    expect(summary.n).toBe(3);
    expect(summary.precision_proxy).toBeCloseTo(2 / 3, 5);
    expect(summary.meets_default_floor_0_70).toBe(false);
  });
});
