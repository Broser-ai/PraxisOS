/**
 * Structured claim registry distilled from PraxisOS (2).md (Alphaxiv/Aurelle chat).
 * Use as backlog + anti-fantasy filter — not as proof of implementation.
 */

export type ClaimStatus =
  | "research_only"
  | "partial_in_repo"
  | "fantasy_dump"
  | "human_blocker"
  | "implemented_workspace";

export type ChatClaim = {
  id: string;
  claim: string;
  status: ClaimStatus;
  evidence: string;
  next?: string;
};

/** Fantasy / unsafe paths named in the chat that must NOT be treated as real modules. */
export const FANTASY_PATHS = [
  "lib/nail/rendering/neural-compositor.ts",
  "lib/physics/mono-msk-tensor.ts",
  "lib/physics/mono-msk.ts",
  "lib/rendering/neural-compositor.ts",
  "lib/scanner/alpha-pipeline.ts",
  "lib/scanner/biomechanics.ts",
  "lib/swarm/singularity-orchestrator.ts",
  "lib/swarm/orchestrator.ts",
  "scripts/meta-harness-daemon.ts",
  "lib/worktree/manager.ts",
  "DR-NINA.ts",
  "ARIA-orchestrator.ts",
  "FELIX-self-coder.ts",
  "LUNA-harvester.ts",
  "swarm.sh",
] as const;

export const CHAT_CLAIMS: ChatClaim[] = [
  {
    id: "c01",
    claim: "RL fine-tuning breakthroughs (ProRL, Lite PPO) should power e-learning",
    status: "research_only",
    evidence: "Turns U00–U03 · abs 2505.24864 / 2508.08221",
    next: "Build verifiable-reward quizzes (class_0); no model training yet",
  },
  {
    id: "c02",
    claim: "Foot e-learning + AI humanized tutor on customer feet scenarios",
    status: "partial_in_repo",
    evidence: "U03 · zip lib/learning/* stubs",
    next: "Port medical-claims + path-generator; keep non-diagnostic",
  },
  {
    id: "c03",
    claim: "Existing PraxisOS is incomplete / not good enough",
    status: "implemented_workspace",
    evidence: "U04 — matches FULL-ZIP-AUDIT production score ~34–55",
    next: "Continue clinic-ops + selective Lag B",
  },
  {
    id: "c04",
    claim: "Buyable multi-tenant SaaS + by Pilar + separable product",
    status: "partial_in_repo",
    evidence: "U10 · tenants/signup exist; billing PSP missing",
    next: "Stripe/MobilePay later; keep signup/session path",
  },
  {
    id: "c05",
    claim: "Foot scan detects disease (eczema, wart) + generates orthotics",
    status: "partial_in_repo",
    evidence: "U11 · scanner pipeline + ai_generated; no auto-diagnosis",
    next: "Candidate findings + clinician confirm only",
  },
  {
    id: "c06",
    claim: "EPIC-1 gul/rød mandat + worktree mode",
    status: "partial_in_repo",
    evidence: "U18–U20 · orchestrator + swarm worktrees",
    next: "Keep human gates; no red-mandate auto-accept in prod",
  },
  {
    id: "c07",
    claim: "Meta-harness living organism / God-Mode / auto-accept",
    status: "fantasy_dump",
    evidence: "U22–U26 · NO_AUTO_MERGE in workspace deliberately",
    next: "Reject unattended merge/deploy narratives",
  },
  {
    id: "c08",
    claim: "ARIA / NINA / FELIX / LUNA full autonomous S-H swarm",
    status: "partial_in_repo",
    evidence: "U28 · ARIA/FELIX/LUNA/FREJ/ATLAS exist; NINA does not",
    next: "Keep LUNA→Alphaxiv; never invent NINA as clinical oracle",
  },
  {
    id: "c09",
    claim: "Roboflow + YOLO-World + Replicate compose the scanner",
    status: "research_only",
    evidence: "U37–U41 · 140× Roboflow / 103× Replicate mentions",
    next: "Wire behind flags when keys exist; fail-closed without keys",
  },
  {
    id: "c10",
    claim: "Shells are not code — make complete production code",
    status: "fantasy_dump",
    evidence: "U42–U49 · dumps claimed production-ready",
    next: "Treat dumps as backlog sketches only",
  },
  {
    id: "c11",
    claim: "4D / photoreal REAL nails (MASS, SSS, Hand-4DGS)",
    status: "research_only",
    evidence: "U45–U57 · 74× '4D' · nail track papers",
    next: "Separate Atelier track — not MDR clinical blocker",
  },
  {
    id: "c12",
    claim: "Fully coded S-H swarm + Aunome downloads for Claude Code",
    status: "partial_in_repo",
    evidence: "U58 · workspace swarm + research admin; not Aunome",
    next: "Alphaxiv connector + /admin/research is the safe bridge",
  },
  {
    id: "c13",
    claim: "Presafe / Patient-Zero / Ortos LOI handled by agents",
    status: "human_blocker",
    evidence: "MICHAELS-ACTION-LIST · not automatable",
    next: "Michael-owned only",
  },
];

export function claimsByStatus(status: ClaimStatus): ChatClaim[] {
  return CHAT_CLAIMS.filter((c) => c.status === status);
}
