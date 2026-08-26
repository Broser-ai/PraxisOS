// Curated PraxisOS research tracks distilled from Alphaxiv chat (PraxisOS (2).md)

import type { ResearchTrack } from "@/lib/alphaxiv/types";

/**
 * Seed catalog from the Aurelle/Alphaxiv transcript.
 * These are citation anchors — not claims that code already implements them.
 */
export const RESEARCH_TRACKS: ResearchTrack[] = [
  {
    id: "rl_elearning",
    title: "RLVR · e-learning verifiable rewards",
    query: "reinforcement learning verifiable rewards LLM tutoring medical education",
    purpose:
      "Quiz/anatomi/farmakologi loops with checkable answers (ProRL, Lite PPO lessons).",
    mdrNote: "class_0 education only — no diagnostic coaching claims",
    seedArxivIds: [
      "2505.24864", // ProRL
      "2508.08221", // Tricks or Traps / Lite PPO
      "2508.11408", // On-Policy + Off-Policy
      "2506.19767", // SRFT
      "2506.07527", // Learning What RL Can't
    ],
  },
  {
    id: "agent_swarm",
    title: "Multi-agent / long-horizon agents",
    query: "multi-agent LLM reinforcement learning long-horizon AgentGym MARFT",
    purpose: "Inform S-H swarm design; never justify unattended auto-merge.",
    mdrNote: "ops agents only; clinical H-agents stay gated",
    seedArxivIds: [
      "2509.08755", // AgentGym-RL
      "2504.16129", // MARFT
      "2509.06949", // TraceRL
    ],
  },
  {
    id: "foot_scanner",
    title: "3D foot reconstruction & biomechanics",
    query: "3D foot reconstruction mesh biomechanics Gaussian splatting medical imaging",
    purpose: "Scanner pipeline priors (mesh, watertight, orthotic CAD).",
    mdrNote: "Class IIa when findings suggest diagnosis — frozen without CE",
    seedArxivIds: [
      "2604.13333", // SSD-GS
      "2605.18263", // RT-Splatting
      "2502.14247", // Pandora3D
      "2511.19326",
    ],
  },
  {
    id: "nail_materials",
    title: "Photoreal nail / skin materials",
    query: "nail bed subsurface scattering Gaussian materials Hand-4DGS MASS",
    purpose: "Del Pilar Atelier visual quality — separate from MDR clinical path.",
    mdrNote: "beauty/atelier track — not clinical device software",
    seedArxivIds: [
      "2604.08943", // MASS
      "2606.27604", // Spectral SSS
      "2606.19156", // Hand-4DGS
      "2606.09018", // MaterialClusterGS
      "2606.26715", // Neural materials
    ],
  },
  {
    id: "vlm_detection",
    title: "VLM / segmentation for lesion candidates",
    query: "medical vision language model segmentation MedSAM dermatology detection",
    purpose: "Candidate findings only; clinician confirmation required.",
    mdrNote: "ai_generated=true mandatory; never auto-diagnosis",
    seedArxivIds: ["2602.13760", "2512.21675"],
  },
  {
    id: "mdr_safety",
    title: "Clinical AI safety & shadow evaluation",
    query: "clinical AI shadow mode evaluation bias medical device software MDR",
    purpose: "Shadow-mode kappa, drift/CUSUM, audit completeness.",
    mdrNote: "regulatory scaffolding — Presafe path is human-owned",
    seedArxivIds: [],
  },
];

export function getResearchTrack(id: string): ResearchTrack | undefined {
  return RESEARCH_TRACKS.find((t) => t.id === id);
}

export function alphaxivAbsUrl(arxivId: string): string {
  const bare = arxivId.replace(/v\d+$/i, "");
  return `https://www.alphaxiv.org/abs/${bare}`;
}
