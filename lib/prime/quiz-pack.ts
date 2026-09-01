// class_0 RLVR quiz pack · verifiable exact-match rewards
// Anatomi / procedure / compliance — NEVER patient-diagnosis coaching.

import type { QuizItem } from "@/lib/prime/types";

/** Seed pack (~20 items). Expandable; no clinical GT. */
export const RLVR_QUIZ_PACK: QuizItem[] = [
  {
    id: "q_anat_01",
    domain: "anatomy",
    prompt: "Hvad hedder den storetåens MTP-led på latin (forkortelse OK)?",
    answer: "mtp-1",
    aliases: ["1. mtp", "mtp i", "hallux mtp", "første metatarsofalangealled"],
    explanation: "1. MTP (hallux) er storetåens metatarsofalangealled.",
    refs: ["class_0 anatomy"],
  },
  {
    id: "q_anat_02",
    domain: "anatomy",
    prompt: "Hvilken knogle danner hælen?",
    answer: "calcaneus",
    aliases: ["hælben", "calcaneum"],
    explanation: "Calcaneus er hælbenet.",
  },
  {
    id: "q_anat_03",
    domain: "anatomy",
    prompt: "Hvor mange metatarsalknogler har en fod?",
    answer: "5",
    aliases: ["fem", "5 stk"],
    explanation: "Fem metatarsalknogler (I–V).",
  },
  {
    id: "q_anat_04",
    domain: "anatomy",
    prompt: "Hvad kaldes den laterale malleol?",
    answer: "fibula",
    aliases: ["fibulære malleol", "ydre malleol"],
    explanation: "Laterale malleol er den distale ende af fibula.",
  },
  {
    id: "q_anat_05",
    domain: "anatomy",
    prompt: "Hvilken bue løber langs fodens inderside?",
    answer: "mediale længdebue",
    aliases: ["medial longitudinal arch", "indre længdebue"],
    explanation: "Den mediale længdebue er den højeste plantarbue.",
  },
  {
    id: "q_pharm_01",
    domain: "pharmacology",
    prompt: "Hvad er den danske forkortelse for lokalbedøvelse?",
    answer: "la",
    aliases: ["lokal anæstesi", "lokalbedøvelse"],
    explanation: "LA = lokal anæstesi (uddannelsesterm).",
  },
  {
    id: "q_pharm_02",
    domain: "pharmacology",
    prompt: "Hvilken gruppe tilhører ibuprofen (uddannelsesniveau)?",
    answer: "nsaid",
    aliases: ["nsaids", "non-steroid antiinflammatorisk"],
    explanation: "NSAID = non-steroid antiinflammatorisk middel.",
  },
  {
    id: "q_proc_01",
    domain: "procedure",
    prompt: "Hvad er første trin før instrumentel neglebehanding (hygiene)?",
    answer: "håndhygiejne",
    aliases: ["vask hænder", "hånddesinfektion", "hygiene"],
    explanation: "Håndhygiejne før procedure er baseline.",
  },
  {
    id: "q_proc_02",
    domain: "procedure",
    prompt: "Hvad betyder SOAP i klinisk dokumentation?",
    answer: "subjective objective assessment plan",
    aliases: ["s o a p", "subjektiv objektiv vurdering plan"],
    explanation: "SOAP = Subjective, Objective, Assessment, Plan.",
  },
  {
    id: "q_proc_03",
    domain: "procedure",
    prompt: "Må AI i PraxisOS stille definitiv diagnose uden behandler?",
    answer: "nej",
    aliases: ["no", "ikke tilladt", "forbidden"],
    explanation: "AI = suggestions only; human adjudication required.",
  },
  {
    id: "q_comp_01",
    domain: "compliance",
    prompt: "Hvad er PraxisOS-invarianten for auto-merge til main?",
    answer: "no_auto_merge",
    aliases: ["no auto merge", "never auto-merge"],
    explanation: "NO_AUTO_MERGE er locked true i swarm invariants.",
  },
  {
    id: "q_comp_02",
    domain: "compliance",
    prompt: "Må pathology-routing aktiveres før Broser-gates?",
    answer: "nej",
    aliases: ["no", "shadow only", "ikke"],
    explanation: "Pathology forbliver shadow until gates.",
  },
  {
    id: "q_comp_03",
    domain: "compliance",
    prompt: "Hvilken MDR-klasse er e-learning quiz (class_0) ift. device software?",
    answer: "ikke device",
    aliases: ["class_0", "uddannelse", "ikke mdr device"],
    explanation: "class_0 education ≠ MDR device software claim.",
  },
  {
    id: "q_ops_01",
    domain: "ops",
    prompt: "Hvilken S-agent høster Alphaxiv-papers i swarm?",
    answer: "luna_research",
    aliases: ["luna", "luna-research"],
    explanation: "LUNA_RESEARCH harvests research citations.",
  },
  {
    id: "q_ops_02",
    domain: "ops",
    prompt: "Hvilken agent åbner savage worktrees?",
    answer: "atlas_code",
    aliases: ["atlas", "atlas-code"],
    explanation: "ATLAS_CODE manages isolated worktrees.",
  },
  {
    id: "q_ops_03",
    domain: "ops",
    prompt: "Hvad kaldes H-agent broen til clinic personas?",
    answer: "h_bridge",
    aliases: ["h-bridge", "h bridge"],
    explanation: "H_BRIDGE pulses Aria/clinic personas.",
  },
  {
    id: "q_anat_06",
    domain: "anatomy",
    prompt: "Hvad hedder den midterste fodrodsknogle-række (samlet)?",
    answer: "cuneiforme",
    aliases: ["cuneiform", "os cuneiforme", "kileben"],
    explanation: "Cuneiforme (mediale/intermediale/laterale).",
  },
  {
    id: "q_anat_07",
    domain: "anatomy",
    prompt: "Hvilken nerve er typisk relevant ved digiti I sensorik (plantart)?",
    answer: "n. plantaris medialis",
    aliases: ["plantaris medialis", "medial plantar nerve"],
    explanation: "Mediale plantarnerve forsyner bl.a. digiti I–III området.",
  },
  {
    id: "q_proc_04",
    domain: "procedure",
    prompt: "Hvad skal behandleren gøre med AI SOAP-udkast?",
    answer: "godkende",
    aliases: ["review", "rette", "adjudicate", "approve"],
    explanation: "Alt AI-journalindhold kræver human godkendelse.",
  },
  {
    id: "q_comp_04",
    domain: "compliance",
    prompt: "Må Prime RL finetune klinik-LLM med ProRL i denne scaffold?",
    answer: "nej",
    aliases: ["no", "forbidden", "ikke"],
    explanation: "NO_MODEL_TRAINING — quiz rewards only until Broser evals.",
  },
];

export function listQuizItems(domain?: QuizItem["domain"]): QuizItem[] {
  return domain
    ? RLVR_QUIZ_PACK.filter((q) => q.domain === domain)
    : RLVR_QUIZ_PACK.slice();
}

export function getQuizItem(id: string): QuizItem | undefined {
  return RLVR_QUIZ_PACK.find((q) => q.id === id);
}

export function quizPackStats() {
  const byDomain: Record<string, number> = {};
  for (const q of RLVR_QUIZ_PACK) {
    byDomain[q.domain] = (byDomain[q.domain] ?? 0) + 1;
  }
  return { total: RLVR_QUIZ_PACK.length, byDomain };
}
