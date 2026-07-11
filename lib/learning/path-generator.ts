// Path generator: fra scan-findings til læringssti.
// Kontrakt: docs/harness/EPIC-4-ELearning.md §2, §3

import { findContentByTags } from "./content-corpus";
import type { Language, PathStep } from "./schema";
import type { ScannerFindings } from "../scanner/findings-schema";
import type { ClientProfile } from "../configurator/schema";
import { redactPII } from "../redact";

export type PathGenerationInput = {
  findings?: ScannerFindings;
  clientProfile: ClientProfile;
  language: Language;
};

export type GeneratedPath = {
  steps: PathStep[];
  language: Language;
};

/**
 * Deterministisk stigenerator: mapper findings + profil til content-IDs
 * via tag-matching.
 *
 * Trigger-tags:
 *   - "hallux valgus"       → hallux_valgus + biomekanik
 *   - "callus"              → callus + hyperkeratose
 *   - "diabet" i profil     → diabetes + fodpleje
 *   - "arch" / "pes planus" → biomekanik + gang
 */
export function generateLearningPath(input: PathGenerationInput): GeneratedPath {
  const tags = new Set<string>(["basis"]);

  if (input.findings) {
    for (const f of input.findings.findings) {
      const label = f.label.toLowerCase();
      if (label.includes("hallux") || label.includes("valgus")) {
        tags.add("hallux_valgus");
        tags.add("biomekanik");
      }
      if (label.includes("callus") || label.includes("hyperkerat")) {
        tags.add("callus");
        tags.add("hyperkeratose");
      }
      if (label.includes("arch") || label.includes("pes planus")) {
        tags.add("biomekanik");
        tags.add("gang");
      }
    }
  }

  const diagnoses = (input.clientProfile.knownDiagnoses ?? []).join(" ").toLowerCase();
  if (diagnoses.includes("diabet")) {
    tags.add("diabetes");
    tags.add("fodpleje");
    tags.add(input.language === "da" ? "forebyggelse" : "prevention");
  }

  // INV-EL-4: klient-profilen kan indeholde CPR — redakter før input's json bruges
  // (den redagterede version er alligevel kun brugt til tag-inference)
  redactPII(input.clientProfile);

  const matches = findContentByTags(Array.from(tags), input.language);

  const steps: PathStep[] = matches.map((c, idx) => ({
    content_id: c.id,
    order: idx,
    status: "pending" as const,
  }));

  return { steps, language: input.language };
}

/**
 * INV-EL-7: monotont voksende progress guard i application-lag.
 * Kaster hvis newProgress < currentProgress.
 */
export function assertProgressMonotone(current: number, next: number): void {
  if (next < current) {
    throw new Error(
      `INV-EL-7 violation: progress cannot decrease (was ${current}, got ${next})`,
    );
  }
}
