// FHIR R5 resource-mappers · projicerer PraxisOS internal state til FHIR-svar.
// Kontrakt: HUMANIZED-FRONTIER-BLUEPRINT §2 · STATE-OF-THE-ART §7.5
//
// PRINCIP:
//   Vi rewriter IKKE de eksisterende Postgres-tabeller. FHIR er en FAÇADE
//   over projections. Dette lag mapper vores interne shapes til FHIR R5
//   Observation / DiagnosticReport / ImagingStudy / Media / DocumentReference /
//   DeviceRequest med SNOMED CT + LOINC coding.

// ---------------------------------------------------------------------------
// FHIR core primitives (subset)
// ---------------------------------------------------------------------------

export type FhirCoding = {
  system: string;
  code: string;
  display?: string;
};

export type FhirCodeableConcept = {
  coding: FhirCoding[];
  text?: string;
};

export type FhirReference = {
  reference: string;   // fx "Patient/123", "Encounter/abc"
  display?: string;
};

export type FhirPeriod = {
  start?: string;      // ISO 8601
  end?: string;
};

// ---------------------------------------------------------------------------
// SNOMED CT + LOINC koder for PraxisOS-domænet
// ---------------------------------------------------------------------------

export const SNOMED_SYSTEM = "http://snomed.info/sct";
export const LOINC_SYSTEM = "http://loinc.org";
export const ICD10_SYSTEM = "http://hl7.org/fhir/sid/icd-10";

/**
 * Top-20 SNOMED CT-DK koder for fod/podiatri (Menz + Landorf reference
 * vocabulary). Denne map skal udvides til ~800 concepts i Sprint 3.
 */
export const SNOMED_FOOT_FINDINGS: Record<string, FhirCoding> = {
  hallux_valgus: { system: SNOMED_SYSTEM, code: "111324006", display: "Hallux valgus" },
  hallux_rigidus: { system: SNOMED_SYSTEM, code: "202968000", display: "Hallux rigidus" },
  hammertoe: { system: SNOMED_SYSTEM, code: "88379009", display: "Hammer toe" },
  pes_planus: { system: SNOMED_SYSTEM, code: "203564001", display: "Pes planus" },
  pes_cavus: { system: SNOMED_SYSTEM, code: "203565000", display: "Pes cavus" },
  plantar_fasciitis: { system: SNOMED_SYSTEM, code: "202856004", display: "Plantar fasciitis" },
  callus: { system: SNOMED_SYSTEM, code: "111181009", display: "Callosity of skin" },
  hyperkeratosis: { system: SNOMED_SYSTEM, code: "17573007", display: "Hyperkeratosis" },
  corn: { system: SNOMED_SYSTEM, code: "422107006", display: "Clavus of foot" },
  verruca_plantaris: { system: SNOMED_SYSTEM, code: "266016005", display: "Verruca plantaris" },
  diabetic_foot_ulcer: {
    system: SNOMED_SYSTEM,
    code: "371087003",
    display: "Diabetic foot ulcer",
  },
  charcot_arthropathy: {
    system: SNOMED_SYSTEM,
    code: "203099009",
    display: "Charcot's arthropathy",
  },
  neuropathy_diabetic: {
    system: SNOMED_SYSTEM,
    code: "230572002",
    display: "Diabetic neuropathy",
  },
  pad_lower_extremity: {
    system: SNOMED_SYSTEM,
    code: "399957001",
    display: "Peripheral arterial disease",
  },
  metatarsalgia: { system: SNOMED_SYSTEM, code: "202855000", display: "Metatarsalgia" },
  morton_neuroma: {
    system: SNOMED_SYSTEM,
    code: "234143008",
    display: "Morton's metatarsalgia",
  },
  achilles_tendinopathy: {
    system: SNOMED_SYSTEM,
    code: "202889001",
    display: "Achilles tendinopathy",
  },
  posterior_tibial_dysfunction: {
    system: SNOMED_SYSTEM,
    code: "429044009",
    display: "Posterior tibial tendon dysfunction",
  },
  ingrown_toenail: { system: SNOMED_SYSTEM, code: "12615002", display: "Ingrown toenail" },
  fungal_nail: { system: SNOMED_SYSTEM, code: "414941008", display: "Onychomycosis" },
};

/**
 * LOINC koder for foot exam measurements (Boulton IWGDF referencer).
 */
export const LOINC_FOOT_MEASUREMENTS: Record<string, FhirCoding> = {
  swmf_10g_test: { system: LOINC_SYSTEM, code: "80373-9", display: "Foot examination monofilament" },
  abi_right: { system: LOINC_SYSTEM, code: "8877-6", display: "Right ankle-brachial index" },
  abi_left: { system: LOINC_SYSTEM, code: "8878-4", display: "Left ankle-brachial index" },
  vpt_hallux: { system: LOINC_SYSTEM, code: "89246-2", display: "Vibration perception threshold, hallux" },
  temperature_skin: { system: LOINC_SYSTEM, code: "8331-1", display: "Skin temperature" },
  iwgdf_risk_stratification: { system: LOINC_SYSTEM, code: "77606-2", display: "Diabetic foot risk category" },
  wifi_wound_grade: { system: LOINC_SYSTEM, code: "97469-4", display: "WIfI wound grade" },
  wifi_ischemia_grade: { system: LOINC_SYSTEM, code: "97470-2", display: "WIfI ischemia grade" },
  wifi_infection_grade: { system: LOINC_SYSTEM, code: "97471-0", display: "WIfI infection grade" },
};

// ---------------------------------------------------------------------------
// FHIR R5 Observation · foot exam finding
// ---------------------------------------------------------------------------

export type ScannerFindingLike = {
  id: string;
  label: string;
  category: "biomechanical" | "dermatological" | "vascular" | "neurological" | "other";
  confidence: number;
  bbox_2d?: { frame_index: number; x: number; y: number; w: number; h: number };
  severity: "low" | "medium" | "high";
  ai_reasoning?: string;
  icd10_candidates?: string[];
  ai_generated: true;
};

export type FhirObservation = {
  resourceType: "Observation";
  id: string;
  status: "final" | "preliminary" | "amended";
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  performer?: FhirReference[];
  valueCodeableConcept?: FhirCodeableConcept;
  interpretation?: FhirCodeableConcept[];
  note?: Array<{ text: string }>;
  bodySite?: FhirCodeableConcept;
  method?: FhirCodeableConcept;
  // ai_generated → extension per FHIR US Core AI-provenance pattern (Sprint 3)
  extension?: Array<{
    url: string;
    valueBoolean?: boolean;
    valueString?: string;
    valueDecimal?: number;
  }>;
};

const AI_GENERATED_EXTENSION_URL =
  "https://praxisos.dk/fhir/StructureDefinition/ai-generated";
const AI_CONFIDENCE_EXTENSION_URL =
  "https://praxisos.dk/fhir/StructureDefinition/ai-confidence";
const AI_MODEL_VERSION_EXTENSION_URL =
  "https://praxisos.dk/fhir/StructureDefinition/ai-model-version";

/**
 * Map en intern ScannerFinding til FHIR R5 Observation.
 * Bruger SNOMED_FOOT_FINDINGS-mapping når label matches; ellers falls back
 * til free-text `text` field. ICD-10-koder tilføjes som secondary coding.
 */
export function mapFindingToObservation(input: {
  finding: ScannerFindingLike;
  patientId: string;
  encounterId?: string;
  practitionerId?: string;
  effectiveDateTime?: string;
  vlmModelVersion?: string;
}): FhirObservation {
  const { finding, patientId, encounterId, practitionerId, effectiveDateTime } = input;

  // Match label → SNOMED code (primary)
  const primarySnomed = matchSnomedCode(finding.label);
  const codings: FhirCoding[] = primarySnomed ? [primarySnomed] : [];

  // ICD-10 candidates som secondary coding (billing use only)
  for (const icd of finding.icd10_candidates ?? []) {
    codings.push({ system: ICD10_SYSTEM, code: icd });
  }

  const observation: FhirObservation = {
    resourceType: "Observation",
    id: finding.id,
    status: "preliminary",  // AI-genererede findings er altid preliminary indtil practitioner-sign-off
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: mapCategoryToFhir(finding.category),
            display: finding.category,
          },
        ],
      },
    ],
    code: {
      coding: codings,
      text: finding.label,
    },
    subject: { reference: `Patient/${patientId}` },
    ...(encounterId ? { encounter: { reference: `Encounter/${encounterId}` } } : {}),
    ...(practitionerId
      ? { performer: [{ reference: `Practitioner/${practitionerId}` }] }
      : {}),
    ...(effectiveDateTime ? { effectiveDateTime } : {}),
    interpretation: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
            code: mapSeverityToInterpretation(finding.severity),
            display: finding.severity,
          },
        ],
      },
    ],
    ...(finding.ai_reasoning ? { note: [{ text: finding.ai_reasoning }] } : {}),
    extension: [
      { url: AI_GENERATED_EXTENSION_URL, valueBoolean: true },
      { url: AI_CONFIDENCE_EXTENSION_URL, valueDecimal: finding.confidence },
      ...(input.vlmModelVersion
        ? [{ url: AI_MODEL_VERSION_EXTENSION_URL, valueString: input.vlmModelVersion }]
        : []),
    ],
  };

  return observation;
}

function matchSnomedCode(label: string): FhirCoding | null {
  const lower = label.toLowerCase();
  for (const [key, coding] of Object.entries(SNOMED_FOOT_FINDINGS)) {
    if (lower.includes(key.replace(/_/g, " ")) || (coding.display && lower.includes(coding.display.toLowerCase()))) {
      return coding;
    }
  }
  return null;
}

function mapCategoryToFhir(cat: ScannerFindingLike["category"]): string {
  switch (cat) {
    case "biomechanical":
      return "exam";
    case "dermatological":
      return "exam";
    case "vascular":
      return "vital-signs";
    case "neurological":
      return "exam";
    default:
      return "exam";
  }
}

function mapSeverityToInterpretation(sev: ScannerFindingLike["severity"]): string {
  switch (sev) {
    case "high":
      return "H"; // High
    case "medium":
      return "N"; // Normal (medium is often within normal range but noted)
    case "low":
      return "L"; // Low
  }
}

// ---------------------------------------------------------------------------
// FHIR R5 DiagnosticReport · aggregates observations from one scan session
// ---------------------------------------------------------------------------

export type FhirDiagnosticReport = {
  resourceType: "DiagnosticReport";
  id: string;
  status: "preliminary" | "final" | "amended";
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FhirReference[];
  result?: FhirReference[];  // → Observation/xxx
  imagingStudy?: FhirReference[];  // → ImagingStudy/xxx
  conclusion?: string;
  presentedForm?: Array<{
    contentType: string;
    url: string;
    title?: string;
  }>;
  extension?: FhirObservation["extension"];
};

/**
 * Aggregér findings fra én scan-session til én DiagnosticReport,
 * med links til de individuelle Observation-resources.
 */
export function mapScanSessionToDiagnosticReport(input: {
  scanId: string;
  patientId: string;
  encounterId?: string;
  practitionerId?: string;
  effectiveDateTime?: string;
  overallSummary?: string;
  findingIds: string[];
  imagingStudyId?: string;
  vlmModelVersion?: string;
}): FhirDiagnosticReport {
  return {
    resourceType: "DiagnosticReport",
    id: input.scanId,
    status: "preliminary",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0074",
            code: "OT",
            display: "Other",
          },
        ],
      },
    ],
    code: {
      coding: [
        { system: LOINC_SYSTEM, code: "72104-3", display: "Foot examination" },
      ],
      text: "PraxisOS foot scan",
    },
    subject: { reference: `Patient/${input.patientId}` },
    ...(input.encounterId ? { encounter: { reference: `Encounter/${input.encounterId}` } } : {}),
    ...(input.effectiveDateTime ? { effectiveDateTime: input.effectiveDateTime } : {}),
    ...(input.practitionerId
      ? { performer: [{ reference: `Practitioner/${input.practitionerId}` }] }
      : {}),
    result: input.findingIds.map((id) => ({ reference: `Observation/${id}` })),
    ...(input.imagingStudyId
      ? { imagingStudy: [{ reference: `ImagingStudy/${input.imagingStudyId}` }] }
      : {}),
    ...(input.overallSummary ? { conclusion: input.overallSummary } : {}),
    extension: [
      { url: AI_GENERATED_EXTENSION_URL, valueBoolean: true },
      ...(input.vlmModelVersion
        ? [{ url: AI_MODEL_VERSION_EXTENSION_URL, valueString: input.vlmModelVersion }]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// FHIR R5 DeviceRequest · orthotic prescription
// ---------------------------------------------------------------------------

export type FhirDeviceRequest = {
  resourceType: "DeviceRequest";
  id: string;
  status: "draft" | "active" | "completed";
  intent: "proposal" | "plan" | "order";
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  parameter?: Array<{
    code: FhirCodeableConcept;
    valueQuantity?: { value: number; unit: string; system?: string; code?: string };
  }>;
  reasonReference?: FhirReference[];  // → DiagnosticReport/xxx
  extension?: FhirObservation["extension"];
};

/**
 * Map 16-parameter orthotic-vektor til FHIR DeviceRequest med per-parameter
 * FHIR-parameter entries. Bruges når practitioner har godkendt konfigurationen
 * og laboratoriet skal producere indlægget.
 */
export function mapOrthoticConfigToDeviceRequest(input: {
  configurationId: string;
  patientId: string;
  encounterId?: string;
  practitionerId?: string;
  orthoticParams: Record<string, number>;
  linkedDiagnosticReportId?: string;
  status?: FhirDeviceRequest["status"];
}): FhirDeviceRequest {
  const parameters = Object.entries(input.orthoticParams).map(([key, value]) => ({
    code: {
      coding: [
        {
          system: "https://praxisos.dk/fhir/CodeSystem/orthotic-parameter",
          code: key,
          display: key.replace(/_/g, " "),
        },
      ],
    },
    valueQuantity: paramValueQuantity(key, value),
  }));

  return {
    resourceType: "DeviceRequest",
    id: input.configurationId,
    status: input.status ?? "draft",
    intent: "proposal",
    code: {
      coding: [
        { system: SNOMED_SYSTEM, code: "704708004", display: "Foot orthosis" },
      ],
    },
    subject: { reference: `Patient/${input.patientId}` },
    ...(input.encounterId ? { encounter: { reference: `Encounter/${input.encounterId}` } } : {}),
    ...(input.practitionerId
      ? { requester: { reference: `Practitioner/${input.practitionerId}` } }
      : {}),
    authoredOn: new Date().toISOString(),
    parameter: parameters,
    ...(input.linkedDiagnosticReportId
      ? { reasonReference: [{ reference: `DiagnosticReport/${input.linkedDiagnosticReportId}` }] }
      : {}),
    extension: [
      { url: AI_GENERATED_EXTENSION_URL, valueBoolean: true },
    ],
  };
}

function paramValueQuantity(
  key: string,
  value: number,
): { value: number; unit: string; system?: string; code?: string } {
  const ucum = "http://unitsofmeasure.org";
  if (key.endsWith("_mm")) return { value, unit: "mm", system: ucum, code: "mm" };
  if (key.endsWith("_deg")) return { value, unit: "deg", system: ucum, code: "deg" };
  if (key.endsWith("_pct")) return { value, unit: "%", system: ucum, code: "%" };
  if (key.startsWith("shore_a")) return { value, unit: "Shore A" };
  return { value, unit: "count" };
}
