// Medical claims detector for INV-EL-5.
// Kontrakt: docs/harness/EPIC-4-ELearning.md §4 INV-EL-5

/**
 * Meget simple regex-heuristik der fanger klare medicinske claims:
 * - Diagnose-verber ("du har X", "dette er X")
 * - Behandlings-anbefalinger ("tag Y", "brug Z")
 * - Kvantitative claims ("50% chance", "reducerer risiko med")
 *
 * Alle sådanne skal have `[ref: ...]` markering ellers regnes de som ubelagte.
 */

const MEDICAL_VERBS_DA = [
  /\b(du har|har du)\s+(diabetes|hallux valgus|arthrose|neuropati|iskemi)/i,
  /\b(diagnosen? er|dette er|det er)\s+(diabetes|artrose|hallux valgus|pes planus)/i,
  /\b(tag|brug|indtag)\s+\d+\s*(mg|g|kapsler?)/i,
  /\b(reducerer|nedsætter|forbedrer)\s+(risikoen|risikoen for|sandsynligheden)/i,
  /\b\d{1,3}\s*%\s+(af patienter|chance|risiko|sandsynlighed)/i,
];

const MEDICAL_VERBS_EN = [
  /\byou have\s+(diabetes|hallux valgus|arthritis|neuropathy)/i,
  /\btake\s+\d+\s*(mg|g|capsules?)/i,
  /\b(reduces|decreases|improves)\s+the\s+(risk|likelihood|chance)/i,
];

const REFERENCE_MARKER = /\[ref:\s*[^\]]+\]/i;

export type ClaimIssue = {
  pattern: string;
  matchedText: string;
  hasReference: boolean;
};

/**
 * Returnerer liste af medicinske claims der IKKE har `[ref: ...]` i nærheden.
 * Tom liste = ingen problemer.
 */
export function detectUnbackedClaims(text: string, language: "da" | "en"): ClaimIssue[] {
  const patterns = language === "da" ? MEDICAL_VERBS_DA : MEDICAL_VERBS_EN;
  const issues: ClaimIssue[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Kig efter [ref:] inden for 200 tegn efter match
      const window = text.substring(match.index ?? 0, (match.index ?? 0) + 300);
      const hasRef = REFERENCE_MARKER.test(window);
      if (!hasRef) {
        issues.push({
          pattern: pattern.source,
          matchedText: match[0]!,
          hasReference: false,
        });
      }
    }
  }
  return issues;
}

/**
 * INV-EL-5 håndhæver: throw hvis unbacked claims findes.
 */
export function assertNoUnbackedClaims(text: string, language: "da" | "en"): void {
  const issues = detectUnbackedClaims(text, language);
  if (issues.length > 0) {
    throw new Error(
      `INV-EL-5 violation: unbacked medical claim: "${issues[0]!.matchedText}"`,
    );
  }
}
