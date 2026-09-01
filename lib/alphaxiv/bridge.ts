// Bridge Alphaxiv research → PraxisOS swarm (LUNA) with safe extracts

import {
  alphaxivAbsUrl,
  getResearchTrack,
  RESEARCH_TRACKS,
} from "@/lib/alphaxiv/catalog";
import {
  askAlphaxivAssistant,
  getAlphaxivOverview,
  getAlphaxivPaper,
  getClosestAlphaxivTopics,
  getSimilarAlphaxivPapers,
  searchAlphaxivPapers,
  searchAlphaxivPapersRich,
} from "@/lib/alphaxiv/client";
import type {
  AlphaxivPaper,
  ResearchFinding,
  ResearchTrackId,
} from "@/lib/alphaxiv/types";

function actionsForTrack(trackId: ResearchTrackId, papers: AlphaxivPaper[]): string[] {
  const base: Record<ResearchTrackId, string[]> = {
    rl_elearning: [
      "Design verifiable-reward quiz items (anatomi/farmakologi) with exact scoring.",
      "Tutor difficulty: prioritize domains where baseline accuracy is weakest (ProRL).",
      "Do not claim clinical coaching without CE / Class IIa review.",
    ],
    agent_swarm: [
      "Keep S-H swarm human-gated (NO_AUTO_MERGE / NO_AUTO_DEPLOY).",
      "Use long-horizon task framing for research→plan→PR cycles only.",
      "Reject unattended production deploy narratives from research chat dumps.",
    ],
    foot_scanner: [
      "Prioritize watertight mesh + SPRG-grounded findings over photoreal cosmetics.",
      "Keep lesion outputs as clinician-reviewed candidates (ai_generated=true).",
      "Port scanner schemas behind feature flags; freeze diagnostic claims.",
    ],
    nail_materials: [
      "Treat MASS/SSS/Hand-4DGS as Atelier visual track — separate from MDR clinical.",
      "Do not block clinic-ops shipping on nail photorealism.",
    ],
    vlm_detection: [
      "Compose SAM/MedSAM segment → lift → VLM findings → SPRG check.",
      "Never auto-diagnose eczema/warts; require human confirmation UI.",
    ],
    mdr_safety: [
      "Wire shadow-mode kappa + drift/CUSUM before any clinical pilot.",
      "Presafe / PRRC / Patient-Zero remain human-owned blockers.",
    ],
  };

  const cites = papers
    .slice(0, 5)
    .map((p) => `${p.arxivId} (${p.title.slice(0, 60)})`);
  return [
    ...base[trackId],
    ...(cites.length
      ? [`Citations: ${cites.join(" · ")}`]
      : ["No live papers returned — used catalog seeds only."]),
  ];
}

async function resolveSeedPapers(ids: string[]): Promise<AlphaxivPaper[]> {
  const out: AlphaxivPaper[] = [];
  for (const id of ids.slice(0, 6)) {
    const p = await getAlphaxivPaper(id);
    if (p) out.push(p);
    else {
      out.push({
        id,
        arxivId: id,
        title: `Seed ${id}`,
        url: alphaxivAbsUrl(id),
        source: "catalog",
      });
    }
  }
  return out;
}

/** Run a curated track or free-text query into a structured finding. */
export async function runResearchHarvest(input: {
  trackId?: ResearchTrackId | string;
  query?: string;
  limit?: number;
}): Promise<ResearchFinding> {
  const track = input.trackId ? getResearchTrack(input.trackId) : undefined;
  const query =
    input.query?.trim() ||
    track?.query ||
    RESEARCH_TRACKS[0]!.query;
  const trackId = (track?.id ?? "rl_elearning") as ResearchTrackId;
  const limit = Math.min(12, Math.max(1, input.limit ?? 6));

  const rich = await searchAlphaxivPapersRich(query, limit);
  const live = rich.papers.length
    ? rich
    : await searchAlphaxivPapers(query, limit);
  let papers = live.papers;

  if (papers.length === 0 && track?.seedArxivIds.length) {
    papers = await resolveSeedPapers(track.seedArxivIds);
  }

  // Expand frontier: similar papers from first seed (not-yet-in-product ideas)
  if (papers[0]?.arxivId) {
    const similar = await getSimilarAlphaxivPapers(papers[0].arxivId, 4);
    const seen = new Set(papers.map((p) => p.arxivId));
    for (const s of similar) {
      if (!seen.has(s.arxivId)) {
        papers.push(s);
        seen.add(s.arxivId);
      }
    }
    papers = papers.slice(0, limit + 4);
  }

  return {
    track: trackId,
    query,
    papers,
    extractedActions: actionsForTrack(trackId, papers),
    at: new Date().toISOString(),
    live: live.live && live.papers.length > 0,
  };
}

/**
 * Deep research interaction for not-yet-built ideas:
 * topics + harvest + optional Alphaxiv Assistant (API key).
 */
export async function runDeepResearchAsk(input: {
  question: string;
  trackId?: ResearchTrackId | string;
  useAssistant?: boolean;
}): Promise<{
  question: string;
  topics: string[];
  finding: ResearchFinding;
  overview?: string | null;
  assistant?: { ok: boolean; text: string; live: boolean; error?: string };
  safety: string;
}> {
  const question = input.question.trim().slice(0, 2000);
  const topics = await getClosestAlphaxivTopics(question);
  const finding = await runResearchHarvest({
    trackId: input.trackId,
    query: question,
    limit: 8,
  });

  let overview: string | null = null;
  if (finding.papers[0]?.arxivId) {
    overview = await getAlphaxivOverview(finding.papers[0].arxivId);
  }

  let assistant:
    | { ok: boolean; text: string; live: boolean; error?: string }
    | undefined;
  if (input.useAssistant !== false) {
    assistant = await askAlphaxivAssistant({
      message: [
        "You are advising PraxisOS (Danish clinic SaaS). Focus on research that is NOT yet shipped.",
        "Never claim code is production-ready. Cite arXiv/Alphaxiv IDs.",
        "Respect MDR: no auto-diagnosis; no unattended auto-merge.",
        `Question: ${question}`,
        topics.length ? `Closest topics: ${topics.join(", ")}` : "",
        `Seed papers: ${finding.papers
          .slice(0, 5)
          .map((p) => p.arxivId)
          .join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  return {
    question,
    topics,
    finding,
    overview,
    assistant,
    safety:
      "NO_AUTO_MERGE · research citations only · Class IIa features stay frozen without CE",
  };
}

export function formatFindingForJournal(finding: ResearchFinding): string {
  const paperLine = finding.papers
    .slice(0, 5)
    .map((p) => `${p.arxivId}: ${p.title}`)
    .join(" | ");
  const actions = finding.extractedActions.join(" · ");
  return `Alphaxiv/${finding.track} · live=${finding.live} · q="${finding.query}" · ${paperLine} · NEXT: ${actions}`;
}

export function listResearchTracks() {
  return RESEARCH_TRACKS;
}
