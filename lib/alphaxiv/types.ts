// Alphaxiv / PraxisOS research types

export type ResearchTrackId =
  | "rl_elearning"
  | "agent_swarm"
  | "foot_scanner"
  | "nail_materials"
  | "vlm_detection"
  | "mdr_safety";

export type ResearchTrack = {
  id: ResearchTrackId;
  title: string;
  query: string;
  purpose: string;
  mdrNote: string;
  seedArxivIds: string[];
};

export type AlphaxivPaper = {
  id: string;
  arxivId: string;
  title: string;
  abstract?: string;
  authors?: string[];
  url: string;
  publishedAt?: string;
  summary?: string;
  source: "alphaxiv" | "catalog" | "stub";
};

export type ResearchFinding = {
  track: ResearchTrackId;
  query: string;
  papers: AlphaxivPaper[];
  extractedActions: string[];
  at: string;
  live: boolean;
};
