// PraxisOS · persona-fixture loader for vitest test-suite.
// Bruges til bias-audit + adversarial-tests jf. HUMANIZED-FRONTIER-BLUEPRINT §7.
//
// Persona-metodologien er lånt fra Tencent persona-hub (MIT-kode); alle personas
// vi loader herfra er GENERERET AF OS (se prototype/scripts/generate-clinical-personas.py)
// og er derfor PraxisOS IP — ingen brug af Tencent's CC BY-NC-SA-data.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export type PatientPersona = {
  id: string;
  tier: "patient";
  iwgdf_risk: 0 | 1 | 2 | 3;
  fitzpatrick: "I" | "II" | "III" | "IV" | "V" | "VI";
  age_band: "18-29" | "30-44" | "45-59" | "60-74" | "75+";
  sex: "F" | "M" | "other";
  language_at_home: string;
  region_dk: string;
  primary_condition: string;
  tech_comfort: "digital-native" | "comfortable" | "hesitant" | "smartphone-help-needed";
  narrative: string;
  risk_flags?: string[];
  consent_readiness: "clear" | "needs-explanation" | "needs-relative-present";
};

export type PractitionerPersona = {
  id: string;
  tier: "practitioner";
  role: string;
  years_experience: number;
  clinic_type: string;
  attitude_to_ai: string;
  language: string;
  narrative: string;
  typical_workload: string;
  documentation_preference: "voice" | "type" | "hybrid";
  billing_channels: string[];
};

export type AdversarialPersona = {
  id: string;
  tier: "adversarial";
  attack_pattern: string;
  sophistication: "naive" | "moderate" | "advanced-pentester";
  scenario_description: string;
  input_payload_sample: string;
  expected_defense: string;
  invariants_tested: string[];
};

export type AnyPersona = PatientPersona | PractitionerPersona | AdversarialPersona;

const FIXTURE_ROOT = resolve(__dirname, "..", "..", "tests", "fixtures", "personas");

function loadJsonl<T extends AnyPersona>(fileName: string): T[] {
  const p = resolve(FIXTURE_ROOT, fileName);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf-8");
  return raw
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

/** Load all patient personas from tests/fixtures/personas/patient.jsonl */
export function loadPatientPersonas(): PatientPersona[] {
  return loadJsonl<PatientPersona>("patient.jsonl");
}

/** Load practitioner personas. */
export function loadPractitionerPersonas(): PractitionerPersona[] {
  return loadJsonl<PractitionerPersona>("practitioner.jsonl");
}

/** Load adversarial-test personas. */
export function loadAdversarialPersonas(): AdversarialPersona[] {
  return loadJsonl<AdversarialPersona>("adversarial.jsonl");
}

/**
 * Filter patients by IWGDF risk stratum — used to guarantee coverage
 * per Armstrong DFU recommendation (each stratum tested independently).
 */
export function patientsByRiskStratum(personas: PatientPersona[]): Record<0 | 1 | 2 | 3, PatientPersona[]> {
  const out: Record<number, PatientPersona[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const p of personas) out[p.iwgdf_risk].push(p);
  return out as Record<0 | 1 | 2 | 3, PatientPersona[]>;
}

/**
 * Filter patients by Fitzpatrick skin type — used for bias-audit
 * per HUMANIZED-FRONTIER-BLUEPRINT §7 (Model Card stratification).
 */
export function patientsByFitzpatrick(personas: PatientPersona[]): Record<PatientPersona["fitzpatrick"], PatientPersona[]> {
  const out: Record<string, PatientPersona[]> = { I: [], II: [], III: [], IV: [], V: [], VI: [] };
  for (const p of personas) out[p.fitzpatrick].push(p);
  return out as Record<PatientPersona["fitzpatrick"], PatientPersona[]>;
}

/**
 * Filter adversarial personas by the invariant they attack.
 * Bruges når en test-suite fokuserer på fx INV-3 eller INV-CS-6.
 */
export function adversarialForInvariant(
  personas: AdversarialPersona[],
  invariant: string,
): AdversarialPersona[] {
  return personas.filter((p) => p.invariants_tested.includes(invariant));
}
