import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_CLAIMS,
  FANTASY_PATHS,
  alphaxivAbsUrl,
  formatFindingForJournal,
  getResearchTrack,
  listResearchTracks,
  runDeepResearchAsk,
  runResearchHarvest,
} from "@/lib/alphaxiv";

describe("alphaxiv catalog", () => {
  it("exposes curated tracks from Alphaxiv chat", () => {
    const tracks = listResearchTracks();
    expect(tracks.length).toBeGreaterThanOrEqual(5);
    expect(getResearchTrack("rl_elearning")?.seedArxivIds).toContain(
      "2505.24864",
    );
    expect(getResearchTrack("nail_materials")?.seedArxivIds).toContain(
      "2604.08943",
    );
  });

  it("builds alphaxiv abs urls", () => {
    expect(alphaxivAbsUrl("2505.24864v1")).toBe(
      "https://www.alphaxiv.org/abs/2505.24864",
    );
  });
});

describe("alphaxiv harvest (stub mode)", () => {
  beforeEach(() => {
    vi.stubEnv("ALPHAXIV_ENABLED", "0");
  });

  it("falls back to seed catalog when live disabled", async () => {
    const finding = await runResearchHarvest({
      trackId: "rl_elearning",
      limit: 4,
    });
    expect(finding.live).toBe(false);
    expect(finding.papers.length).toBeGreaterThan(0);
    expect(finding.papers[0]!.arxivId).toMatch(/^\d{4}\.\d{4,5}$/);
    expect(finding.extractedActions.some((a) => /verifiable/i.test(a))).toBe(
      true,
    );
    const line = formatFindingForJournal(finding);
    expect(line).toContain("Alphaxiv/rl_elearning");
    expect(line).toContain("live=false");
  });

  it("never suggests auto-merge in agent_swarm actions", async () => {
    const finding = await runResearchHarvest({ trackId: "agent_swarm" });
    const blob = finding.extractedActions.join(" ");
    expect(blob).toMatch(/NO_AUTO_MERGE/);
    expect(blob.toLowerCase()).not.toMatch(/auto-merge to main/);
  });
});

describe("alphaxiv chat-claims registry", () => {
  it("flags fantasy paths from PraxisOS (2).md dumps", () => {
    expect(FANTASY_PATHS).toContain("lib/swarm/singularity-orchestrator.ts");
    expect(FANTASY_PATHS).toContain("DR-NINA.ts");
    expect(CHAT_CLAIMS.some((c) => c.id === "c07" && c.status === "fantasy_dump")).toBe(
      true,
    );
    expect(CHAT_CLAIMS.some((c) => c.status === "human_blocker")).toBe(true);
  });
});

describe("alphaxiv deep ask (stub mode)", () => {
  beforeEach(() => {
    vi.stubEnv("ALPHAXIV_ENABLED", "0");
  });

  it("returns safety banner and harvest without requiring API key", async () => {
    const r = await runDeepResearchAsk({
      question: "verifiable rewards for foot e-learning quizzes",
      trackId: "rl_elearning",
      useAssistant: true,
    });
    expect(r.safety).toMatch(/NO_AUTO_MERGE/);
    expect(r.finding.papers.length).toBeGreaterThan(0);
    expect(r.assistant?.ok).toBe(false);
  });
});
