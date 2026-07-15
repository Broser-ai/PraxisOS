// by Pilar seed-data · komplet test-object per Michael's Sprint-5 mandate.
// Kontrakt: STATE-OF-THE-ART §12 D6 · Patient-Zero eksperiment
//
// PRINCIP:
//   by Pilar (CVR 43947079) er vores trial-tenant. Denne fil giver realistisk
//   klinisk mock-data der driver ALLE ende-til-ende demos:
//   patients → bookings → scans → findings → orthotic-configs → mill-jobs →
//   Sygesikringen-claims → factoring-offers → temperature-monitoring.
//
//   Alle in-memory adaptere fra Sprint 1-4 (mill · sygesikringen · scanner
//   pipeline · voice · gait · surveillance) refererer denne seed når PRAXIS_
//   BYPILAR_SEED=1 er sat.
//
// LICENS-NOTE:
//   Alle patient-navne + CPR er fiktive. Ingen rigtige CPR-numre er brugt.
//   Patient-narrativer er skrevet af os · ingen re-use af faktiske
//   patient-data.

import type { ScannerFindingLike } from "../fhir/resource-mappers";

// ---------------------------------------------------------------------------
// 8 Patients (stratified: IWGDF 0-3 · Fitzpatrick II-VI · alder 32-79 · sprog)
// ---------------------------------------------------------------------------

export type BypilarPatient = {
  id: string;
  cpr_hashed: string;
  cpr_masked: string;
  full_name: string;
  age: number;
  sex: "F" | "M" | "other";
  fitzpatrick: "I" | "II" | "III" | "IV" | "V" | "VI";
  language_at_home: string;
  region_dk: string;
  iwgdf_risk: 0 | 1 | 2 | 3;
  primary_condition: string;
  known_diagnoses: string[];
  activity_level: "low" | "moderate" | "high";
  weight_kg: number;
  narrative: string;
  consent_status: "not_asked" | "verbal_ack" | "dpa_signed";
};

export const BYPILAR_PATIENTS: BypilarPatient[] = [
  {
    id: "pt_bypilar_001",
    cpr_hashed: "a".repeat(64),
    cpr_masked: "XXXXXX-1234",
    full_name: "Mette Larsen",
    age: 34, sex: "F", fitzpatrick: "II",
    language_at_home: "Danish",
    region_dk: "Region Midtjylland urban",
    iwgdf_risk: 0,
    primary_condition: "Recreational runner, plantar fasciitis 8 uger",
    known_diagnoses: [],
    activity_level: "high", weight_kg: 62,
    narrative: "Løber 5 gange om ugen, mærker en trækkende smerte under hælen om morgenen.",
    consent_status: "dpa_signed",
  },
  {
    id: "pt_bypilar_002",
    cpr_hashed: "b".repeat(64),
    cpr_masked: "XXXXXX-5678",
    full_name: "Per Sørensen",
    age: 68, sex: "M", fitzpatrick: "III",
    language_at_home: "Danish",
    region_dk: "Region Midtjylland rural",
    iwgdf_risk: 3,
    primary_condition: "Type 2 diabetes 14 år, prior DFU healed 6 mdr siden",
    known_diagnoses: ["Type 2 diabetes", "peripheral neuropathy", "prior_ulcer_left_heel"],
    activity_level: "low", weight_kg: 92,
    narrative: "Jeg fik et sår sidste år som var svært at få lukket. Min kone hjælper mig til kontrol. Jeg mærker ikke rigtig mine fødder længere.",
    consent_status: "dpa_signed",
  },
  {
    id: "pt_bypilar_003",
    cpr_hashed: "c".repeat(64),
    cpr_masked: "XXXXXX-9012",
    full_name: "Fatima Al-Hassan",
    age: 61, sex: "F", fitzpatrick: "V",
    language_at_home: "Arabic + Danish (limited)",
    region_dk: "Region Hovedstaden urban",
    iwgdf_risk: 2,
    primary_condition: "Type 2 diabetes 8 år, ABI 0.75 højre (borderline PAD)",
    known_diagnoses: ["Type 2 diabetes", "PAD borderline"],
    activity_level: "low", weight_kg: 78,
    narrative: "Min datter hjælper mig med at komme til lægen. Jeg har haft sukkersyge længe. Min fod er kold om morgenen.",
    consent_status: "verbal_ack",
  },
  {
    id: "pt_bypilar_004",
    cpr_hashed: "d".repeat(64),
    cpr_masked: "XXXXXX-3456",
    full_name: "Anders Kristiansen",
    age: 52, sex: "M", fitzpatrick: "IV",
    language_at_home: "Danish + English",
    region_dk: "Region Syddanmark",
    iwgdf_risk: 1,
    primary_condition: "Hallux valgus grade 2 begge fødder, overvejer operation",
    known_diagnoses: ["hallux_valgus_bilateral"],
    activity_level: "moderate", weight_kg: 88,
    narrative: "Jeg har haft skæve storetæer i årevis. Kirurg har foreslået operation, men jeg vil gerne prøve indlæg først.",
    consent_status: "dpa_signed",
  },
  {
    id: "pt_bypilar_005",
    cpr_hashed: "e".repeat(64),
    cpr_masked: "XXXXXX-7890",
    full_name: "Ingrid Poulsen",
    age: 79, sex: "F", fitzpatrick: "II",
    language_at_home: "Danish",
    region_dk: "Region Sjælland provinsby",
    iwgdf_risk: 3,
    primary_condition: "Charcot arthropathy suspicion, varm hævet midtfod",
    known_diagnoses: ["Type 2 diabetes 30 år", "peripheral neuropathy severe", "Charcot_suspected"],
    activity_level: "low", weight_kg: 71,
    narrative: "Min fod er hævet og varm. Der er ingen smerter. Min hjemmehjælp sagde jeg skulle til læge.",
    consent_status: "verbal_ack",
  },
  {
    id: "pt_bypilar_006",
    cpr_hashed: "f".repeat(64),
    cpr_masked: "XXXXXX-2345",
    full_name: "Kim Jensen",
    age: 32, sex: "other", fitzpatrick: "III",
    language_at_home: "Danish",
    region_dk: "Region Midtjylland Aarhus",
    iwgdf_risk: 0,
    primary_condition: "Overpronation + lateral ankle sprain recurrence",
    known_diagnoses: [],
    activity_level: "high", weight_kg: 68,
    narrative: "Har vrikket om på venstre ankel 3 gange i år. Løber trail og har brug for indlæg til mine sko.",
    consent_status: "dpa_signed",
  },
  {
    id: "pt_bypilar_007",
    cpr_hashed: "g".repeat(64),
    cpr_masked: "XXXXXX-6789",
    full_name: "Lars-Erik Hansen",
    age: 58, sex: "M", fitzpatrick: "II",
    language_at_home: "Danish",
    region_dk: "Region Nordjylland",
    iwgdf_risk: 1,
    primary_condition: "Pes planus, plantar fasciitis + Achilles-tendinopati",
    known_diagnoses: ["pes_planus_bilateral"],
    activity_level: "moderate", weight_kg: 95,
    narrative: "Jeg står meget på arbejde. Har haft ondt i hælen og bagest på foden i et halvt år.",
    consent_status: "dpa_signed",
  },
  {
    id: "pt_bypilar_008",
    cpr_hashed: "h".repeat(64),
    cpr_masked: "XXXXXX-0123",
    full_name: "Amira Yusuf",
    age: 46, sex: "F", fitzpatrick: "VI",
    language_at_home: "Somali + Danish (limited)",
    region_dk: "Region Hovedstaden suburban",
    iwgdf_risk: 2,
    primary_condition: "Type 2 diabetes 5 år, kroniske calluses metatarsal region",
    known_diagnoses: ["Type 2 diabetes", "hyperkeratosis_MTH_bilateral"],
    activity_level: "low", weight_kg: 82,
    narrative: "Jeg har hårde områder under fødderne som gør ondt. Min læge sagde jeg burde få det tjekket for sukkersyge-relaterede sår.",
    consent_status: "verbal_ack",
  },
];

// ---------------------------------------------------------------------------
// 12 Bookings (blanding af services + practitioners)
// ---------------------------------------------------------------------------

export type BypilarBooking = {
  id: string;
  patient_id: string;
  service_id: string;
  practitioner_email: string;
  starts_at: string;
  duration_min: number;
  price_kr: number;
  status: "confirmed" | "completed" | "cancelled" | "noshow";
  modality: "Klinik" | "Hjemmebesøg" | "Video";
  subsidy_group?: "g1" | "g2" | "g5";
};

export const BYPILAR_BOOKINGS: BypilarBooking[] = [
  { id: "bk_001", patient_id: "pt_bypilar_001", service_id: "fod-scan", practitioner_email: "pilar@bypilar.dk",
    starts_at: "2026-07-14T09:00:00", duration_min: 30, price_kr: 595, status: "confirmed", modality: "Klinik" },
  { id: "bk_002", patient_id: "pt_bypilar_002", service_id: "fod-med", practitioner_email: "pilar@bypilar.dk",
    starts_at: "2026-07-14T10:00:00", duration_min: 45, price_kr: 495, status: "completed", modality: "Klinik", subsidy_group: "g5" },
  { id: "bk_003", patient_id: "pt_bypilar_003", service_id: "fod-med", practitioner_email: "pilar@bypilar.dk",
    starts_at: "2026-07-14T11:00:00", duration_min: 45, price_kr: 495, status: "completed", modality: "Klinik", subsidy_group: "g1" },
  { id: "bk_004", patient_id: "pt_bypilar_004", service_id: "fod-scan", practitioner_email: "pilar@bypilar.dk",
    starts_at: "2026-07-14T13:00:00", duration_min: 30, price_kr: 595, status: "completed", modality: "Klinik" },
  { id: "bk_005", patient_id: "pt_bypilar_005", service_id: "fod-med", practitioner_email: "pilar@bypilar.dk",
    starts_at: "2026-07-14T14:00:00", duration_min: 45, price_kr: 495, status: "confirmed", modality: "Hjemmebesøg", subsidy_group: "g1" },
  { id: "bk_006", patient_id: "pt_bypilar_006", service_id: "fod-scan", practitioner_email: "sofie@bypilar.dk",
    starts_at: "2026-07-14T15:00:00", duration_min: 30, price_kr: 595, status: "confirmed", modality: "Klinik" },
  { id: "bk_007", patient_id: "pt_bypilar_007", service_id: "fod-lux", practitioner_email: "pilar@bypilar.dk",
    starts_at: "2026-07-15T09:00:00", duration_min: 75, price_kr: 745, status: "confirmed", modality: "Klinik" },
  { id: "bk_008", patient_id: "pt_bypilar_008", service_id: "fod-scan", practitioner_email: "sofie@bypilar.dk",
    starts_at: "2026-07-15T11:00:00", duration_min: 30, price_kr: 595, status: "completed", modality: "Klinik", subsidy_group: "g2" },
  { id: "bk_009", patient_id: "pt_bypilar_002", service_id: "fod-scan", practitioner_email: "pilar@bypilar.dk",
    starts_at: "2026-07-16T09:00:00", duration_min: 30, price_kr: 595, status: "confirmed", modality: "Klinik" },
  { id: "bk_010", patient_id: "pt_bypilar_005", service_id: "fod-med", practitioner_email: "pilar@bypilar.dk",
    starts_at: "2026-07-17T14:00:00", duration_min: 45, price_kr: 495, status: "confirmed", modality: "Hjemmebesøg", subsidy_group: "g1" },
  { id: "bk_011", patient_id: "pt_bypilar_001", service_id: "fod-med", practitioner_email: "sofie@bypilar.dk",
    starts_at: "2026-07-18T10:00:00", duration_min: 45, price_kr: 495, status: "confirmed", modality: "Klinik" },
  { id: "bk_012", patient_id: "pt_bypilar_008", service_id: "fod-med", practitioner_email: "pilar@bypilar.dk",
    starts_at: "2026-07-21T11:00:00", duration_min: 45, price_kr: 495, status: "confirmed", modality: "Klinik", subsidy_group: "g2" },
];

// ---------------------------------------------------------------------------
// 5 Scans med findings (én pr. patient med scan-booking)
// ---------------------------------------------------------------------------

export type BypilarScan = {
  id: string;
  patient_id: string;
  booking_id: string;
  practitioner_email: string;
  performed_at: string;
  vlm_model_version: string;
  overall_summary_da: string;
  findings: ScannerFindingLike[];
  mesh_url: string;
  quality_score: number;
  watertight: boolean;
};

export const BYPILAR_SCANS: BypilarScan[] = [
  {
    id: "scan_bp_001", patient_id: "pt_bypilar_002", booking_id: "bk_002",
    practitioner_email: "pilar@bypilar.dk",
    performed_at: "2026-07-14T10:15:00Z",
    vlm_model_version: "claude-sonnet-5-2026-01",
    overall_summary_da: "[SPRG: 3/3 ROI-grounded] Prior DFU-arret på venstre hæl fuldt healed. Ingen aktive ulcerationer. Callus under højre MTH2 der bør monitoreres.",
    quality_score: 0.88, watertight: true,
    mesh_url: "stub://scans/mesh/scan_bp_001.glb",
    findings: [
      { id: "f_bp_001_a", label: "Healed DFU scar left heel", category: "dermatological", confidence: 0.94,
        bbox_2d: { frame_index: 0, x: 90, y: 380, w: 70, h: 60 }, severity: "low",
        ai_reasoning: "Well-healed depigmented scar, no active breakdown.", icd10_candidates: ["L98.4"], ai_generated: true },
      { id: "f_bp_001_b", label: "Callus MTH2 right", category: "dermatological", confidence: 0.89,
        bbox_2d: { frame_index: 0, x: 420, y: 300, w: 55, h: 50 }, severity: "medium",
        ai_reasoning: "Focal hyperkeratosis under 2nd metatarsal head — pre-ulcerative i neuropathic foot.", icd10_candidates: ["L84"], ai_generated: true },
      { id: "f_bp_001_c", label: "Peripheral neuropathy signs bilateral", category: "neurological", confidence: 0.82,
        severity: "medium", ai_reasoning: "Visual asymmetri i toe-flare + reduceret hair-growth distal · konfirmeres med SWMF.", icd10_candidates: ["E11.42"], ai_generated: true },
    ],
  },
  {
    id: "scan_bp_002", patient_id: "pt_bypilar_003", booking_id: "bk_003",
    practitioner_email: "pilar@bypilar.dk",
    performed_at: "2026-07-14T11:15:00Z",
    vlm_model_version: "claude-sonnet-5-2026-01",
    overall_summary_da: "[SPRG: 2/2 ROI-grounded] Vaskulær compromise med kølig hud + reduceret hair growth. ABI 0.75 dokumenteret.",
    quality_score: 0.81, watertight: true,
    mesh_url: "stub://scans/mesh/scan_bp_002.glb",
    findings: [
      { id: "f_bp_002_a", label: "Reduced perfusion signs right foot", category: "vascular", confidence: 0.87,
        bbox_2d: { frame_index: 0, x: 300, y: 250, w: 200, h: 200 }, severity: "high",
        ai_reasoning: "Kold hud + pale nail beds + delayed capillary refill. ABI 0.75 borderline PAD — henvis til karkirurg.",
        icd10_candidates: ["I70.201"], ai_generated: true },
      { id: "f_bp_002_b", label: "Diabetic dermopathy", category: "dermatological", confidence: 0.75,
        bbox_2d: { frame_index: 0, x: 380, y: 320, w: 60, h: 55 }, severity: "low",
        ai_reasoning: "Brune atrofiske pletter i shin-region · typisk for langvarig diabetes.", icd10_candidates: ["L98.0"], ai_generated: true },
    ],
  },
  {
    id: "scan_bp_003", patient_id: "pt_bypilar_004", booking_id: "bk_004",
    practitioner_email: "pilar@bypilar.dk",
    performed_at: "2026-07-14T13:15:00Z",
    vlm_model_version: "claude-sonnet-5-2026-01",
    overall_summary_da: "[SPRG: 2/2 ROI-grounded] Bilateral moderat hallux valgus grade 2. Angle estimeret ~22° venstre · ~25° højre.",
    quality_score: 0.91, watertight: true,
    mesh_url: "stub://scans/mesh/scan_bp_003.glb",
    findings: [
      { id: "f_bp_003_a", label: "Moderate hallux valgus bilateral", category: "biomechanical", confidence: 0.93,
        bbox_2d: { frame_index: 0, x: 510, y: 240, w: 90, h: 100 }, severity: "medium",
        ai_reasoning: "Estimeret HVA 22-25° · IMA ~14°. Manchester grade 2. Kandidat til orthotic-intervention før kirurgi.",
        icd10_candidates: ["M20.11", "M20.12"], ai_generated: true },
      { id: "f_bp_003_b", label: "Callus MTH1 lateral", category: "dermatological", confidence: 0.82,
        bbox_2d: { frame_index: 0, x: 470, y: 280, w: 50, h: 45 }, severity: "low",
        ai_reasoning: "Bunion-relateret shoe-friction hyperkeratose.", icd10_candidates: ["L84"], ai_generated: true },
    ],
  },
  {
    id: "scan_bp_004", patient_id: "pt_bypilar_006", booking_id: "bk_006",
    practitioner_email: "sofie@bypilar.dk",
    performed_at: "2026-07-14T15:15:00Z",
    vlm_model_version: "claude-sonnet-5-2026-01",
    overall_summary_da: "[SPRG: 1/1 ROI-grounded] Overpronation begge fødder. Navicular drop test estimeret >10mm. Konsistent med lateral ankle sprain-mønster.",
    quality_score: 0.86, watertight: true,
    mesh_url: "stub://scans/mesh/scan_bp_004.glb",
    findings: [
      { id: "f_bp_004_a", label: "Bilateral overpronation", category: "biomechanical", confidence: 0.85,
        bbox_2d: { frame_index: 0, x: 200, y: 260, w: 240, h: 180 }, severity: "medium",
        ai_reasoning: "Navicular drop >10mm bilateralt · flexible flatfoot. Instabilitet i lateral ankel-kompleks. Anbefaler custom orthotic + prop stability shoe.",
        icd10_candidates: ["M21.4", "S93.4"], ai_generated: true },
    ],
  },
  {
    id: "scan_bp_005", patient_id: "pt_bypilar_008", booking_id: "bk_008",
    practitioner_email: "sofie@bypilar.dk",
    performed_at: "2026-07-15T11:15:00Z",
    vlm_model_version: "claude-sonnet-5-2026-01",
    overall_summary_da: "[SPRG: 3/3 ROI-grounded] Kroniske calluses under alle 5 metatarsalhoveder bilateralt · pre-ulcerative i diabetisk fod. IWGDF risk 2 — hyppig kontrol anbefalet.",
    quality_score: 0.84, watertight: true,
    mesh_url: "stub://scans/mesh/scan_bp_005.glb",
    findings: [
      { id: "f_bp_005_a", label: "Callus MTH1-5 bilateral", category: "dermatological", confidence: 0.92,
        bbox_2d: { frame_index: 0, x: 340, y: 280, w: 260, h: 100 }, severity: "high",
        ai_reasoning: "Multi-focal hyperkeratose forfod bilateralt. I diabetisk fod med LOPS er dette pre-ulcerative — kræver TCC-offloading eller custom orthotic med recess-zones.",
        icd10_candidates: ["L84"], ai_generated: true },
      { id: "f_bp_005_b", label: "Fissures heel bilateral", category: "dermatological", confidence: 0.78,
        bbox_2d: { frame_index: 0, x: 100, y: 400, w: 400, h: 80 }, severity: "medium",
        ai_reasoning: "Dybe hælfissurer · risiko for sekundær infektion. Recommend intensiv urea-behandling + occlusive dressing.",
        icd10_candidates: ["L98.8"], ai_generated: true },
      { id: "f_bp_005_c", label: "Ingrown toenail hallux left", category: "dermatological", confidence: 0.88,
        bbox_2d: { frame_index: 0, x: 190, y: 210, w: 70, h: 80 }, severity: "medium",
        ai_reasoning: "Onychocryptosis venstre hallux · medial side. Konservativ neglepleje eller partiel matricectomy hvis reccurrent.",
        icd10_candidates: ["L60.0"], ai_generated: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// 3 Orthotic-configurations (til scan_bp_001, scan_bp_003, scan_bp_005)
// ---------------------------------------------------------------------------

export type BypilarOrthoticConfig = {
  id: string;
  patient_id: string;
  scan_id: string;
  practitioner_email: string;
  status: "draft" | "reviewed" | "locked" | "sent_to_lab" | "delivered";
  authored_at: string;
  approved_at?: string;
  orthotic_params: Record<string, number>;
  mill_job_id?: string;
  mill_eta_at?: string;
};

export const BYPILAR_ORTHOTIC_CONFIGS: BypilarOrthoticConfig[] = [
  {
    id: "cfg_bp_001", patient_id: "pt_bypilar_002", scan_id: "scan_bp_001",
    practitioner_email: "pilar@bypilar.dk",
    status: "sent_to_lab",
    authored_at: "2026-07-14T10:45:00Z",
    approved_at: "2026-07-14T11:00:00Z",
    mill_job_id: "job_stub_bp_001",
    mill_eta_at: "2026-07-17T15:00:00Z",
    orthotic_params: {
      heel_cup_depth_mm: 24, arch_support_height_mm: 18, metatarsal_pad_offset_mm: 5,
      medial_flare_deg: 3, lateral_flare_deg: 3, forefoot_thickness_mm: 5,
      heel_thickness_mm: 9, shore_a_forefoot: 28, shore_a_heel: 52,
      posting_medial_deg: 1, posting_lateral_deg: 0, hallux_relief_mm: 0,
      plantar_recess_zones: 2, toe_break_position_pct: 68, first_ray_cutout_mm: 0,
      pronation_correction_deg: -1,
    },
  },
  {
    id: "cfg_bp_002", patient_id: "pt_bypilar_004", scan_id: "scan_bp_003",
    practitioner_email: "pilar@bypilar.dk",
    status: "locked",
    authored_at: "2026-07-14T13:45:00Z",
    approved_at: "2026-07-14T14:00:00Z",
    orthotic_params: {
      heel_cup_depth_mm: 20, arch_support_height_mm: 22, metatarsal_pad_offset_mm: 0,
      medial_flare_deg: 6, lateral_flare_deg: 3, forefoot_thickness_mm: 4,
      heel_thickness_mm: 8, shore_a_forefoot: 35, shore_a_heel: 60,
      posting_medial_deg: 4, posting_lateral_deg: 0, hallux_relief_mm: 3,
      plantar_recess_zones: 1, toe_break_position_pct: 70, first_ray_cutout_mm: 2,
      pronation_correction_deg: -3,
    },
  },
  {
    id: "cfg_bp_003", patient_id: "pt_bypilar_008", scan_id: "scan_bp_005",
    practitioner_email: "sofie@bypilar.dk",
    status: "reviewed",
    authored_at: "2026-07-15T11:45:00Z",
    orthotic_params: {
      heel_cup_depth_mm: 22, arch_support_height_mm: 15, metatarsal_pad_offset_mm: 8,
      medial_flare_deg: 2, lateral_flare_deg: 2, forefoot_thickness_mm: 6,
      heel_thickness_mm: 10, shore_a_forefoot: 25, shore_a_heel: 50,
      posting_medial_deg: 1, posting_lateral_deg: 1, hallux_relief_mm: 2,
      plantar_recess_zones: 3, toe_break_position_pct: 68, first_ray_cutout_mm: 0,
      pronation_correction_deg: 0,
    },
  },
];

// ---------------------------------------------------------------------------
// 4 Sygesikringen claims (bookings med subsidy_group)
// ---------------------------------------------------------------------------

export type BypilarClaim = {
  id: string;
  booking_id: string;
  patient_id: string;
  subsidy_group: "g1" | "g2" | "g5";
  amount_oere: number;
  status: "draft" | "submitted" | "acknowledged" | "approved" | "paid" | "rejected";
  submitted_at?: string;
  paid_at?: string;
  factoring_partner?: "aros-finans" | "danske-bank-erhverv" | "stub";
  factoring_advance_oere?: number;
};

export const BYPILAR_CLAIMS: BypilarClaim[] = [
  { id: "clm_bp_001", booking_id: "bk_002", patient_id: "pt_bypilar_002", subsidy_group: "g5",
    amount_oere: 49500, status: "paid", submitted_at: "2026-07-14T18:00:00Z",
    paid_at: "2026-07-15T09:00:00Z", factoring_partner: "aros-finans", factoring_advance_oere: 41008 },
  { id: "clm_bp_002", booking_id: "bk_003", patient_id: "pt_bypilar_003", subsidy_group: "g1",
    amount_oere: 49500, status: "approved", submitted_at: "2026-07-14T18:00:00Z" },
  { id: "clm_bp_003", booking_id: "bk_008", patient_id: "pt_bypilar_008", subsidy_group: "g2",
    amount_oere: 59500, status: "submitted", submitted_at: "2026-07-15T18:00:00Z" },
  { id: "clm_bp_004", booking_id: "bk_005", patient_id: "pt_bypilar_005", subsidy_group: "g1",
    amount_oere: 49500, status: "draft" },
];

// ---------------------------------------------------------------------------
// Temperature-readings (Podimetrics SmartMat-lignende home monitoring)
// ---------------------------------------------------------------------------

export type BypilarTempReading = {
  id: string;
  patient_id: string;
  foot_side: "left" | "right";
  site: "hallux" | "mth1" | "mth3" | "mth5" | "midfoot" | "heel";
  temperature_c: number;
  captured_at: string;
  contralateral_delta_c?: number;
};

/**
 * 30 dages morgen-target for Per Sørensen (pt_bypilar_002) — high-risk
 * post-DFU patient med Podimetrics SmartMat. Dag 21-24 viser suspicious
 * delta > 2.2°C på højre MTH2 = pre-ulcerative advarsel.
 */
export const BYPILAR_TEMP_READINGS: BypilarTempReading[] = [
  ...Array.from({ length: 30 }, (_, i): BypilarTempReading[] => {
    const isDrift = i >= 20 && i <= 23;
    const dayStr = String(i + 1).padStart(2, "0");
    return [
      { id: `temp_${i}_L`, patient_id: "pt_bypilar_002", foot_side: "left", site: "mth3",
        temperature_c: 27.5 + (Math.random() - 0.5) * 0.6,
        captured_at: `2026-06-${dayStr}T07:15:00Z` },
      { id: `temp_${i}_R`, patient_id: "pt_bypilar_002", foot_side: "right", site: "mth3",
        temperature_c: 27.5 + (isDrift ? 2.8 : 0) + (Math.random() - 0.5) * 0.6,
        captured_at: `2026-06-${dayStr}T07:15:00Z`,
        contralateral_delta_c: isDrift ? 2.8 : 0.05 },
    ];
  }).flat(),
];

// ---------------------------------------------------------------------------
// Summary counters — bruges af demo-page + tests
// ---------------------------------------------------------------------------

export const BYPILAR_SEED_STATS = {
  patients: BYPILAR_PATIENTS.length,
  bookings: BYPILAR_BOOKINGS.length,
  scans: BYPILAR_SCANS.length,
  findings: BYPILAR_SCANS.reduce((sum, s) => sum + s.findings.length, 0),
  orthotic_configs: BYPILAR_ORTHOTIC_CONFIGS.length,
  claims: BYPILAR_CLAIMS.length,
  temp_readings: BYPILAR_TEMP_READINGS.length,
  iwgdf_distribution: BYPILAR_PATIENTS.reduce<Record<number, number>>((acc, p) => {
    acc[p.iwgdf_risk] = (acc[p.iwgdf_risk] ?? 0) + 1;
    return acc;
  }, {}),
  fitzpatrick_distribution: BYPILAR_PATIENTS.reduce<Record<string, number>>((acc, p) => {
    acc[p.fitzpatrick] = (acc[p.fitzpatrick] ?? 0) + 1;
    return acc;
  }, {}),
};
