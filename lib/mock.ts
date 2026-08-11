// Mock data for the PraxisOS prototype. No backend — purely illustrative.

export const clinic = {
  name: "Nordlys Klinik",
  plan: "PraxisOS · Pro",
  region: "EU · Ireland (eu-west-1) · Vercel edge fra1",
};

export const practitioner = {
  name: "Dr. Sofie Krarup",
  role: "Hudlæge & æstetisk behandler",
  initials: "SK",
};

export type Appointment = {
  id: string;
  time: string;
  end: string;
  client: string;
  initials: string;
  type: string;
  modality: "Klinik" | "Video" | "Hjemmebesøg";
  status: "Bekræftet" | "Ankommet" | "Afventer";
  noShowRisk: number; // 0-100
  color: string;
};

export const today: Appointment[] = [
  { id: "a1", time: "08:30", end: "09:00", client: "Mette Lindqvist", initials: "ML", type: "Hudanalyse · opfølgning", modality: "Klinik", status: "Ankommet", noShowRisk: 6, color: "var(--color-accent)" },
  { id: "a2", time: "09:15", end: "10:00", client: "Jonas Brandt", initials: "JB", type: "Botox · konsultation", modality: "Klinik", status: "Bekræftet", noShowRisk: 12, color: "var(--color-clay)" },
  { id: "a3", time: "10:30", end: "11:00", client: "Amira Haddad", initials: "AH", type: "Acne-forløb · session 4", modality: "Video", status: "Bekræftet", noShowRisk: 41, color: "var(--color-signal)" },
  { id: "a4", time: "11:30", end: "12:15", client: "Per Sørensen", initials: "PS", type: "Sår-kontrol", modality: "Hjemmebesøg", status: "Afventer", noShowRisk: 68, color: "var(--color-amber)" },
  { id: "a5", time: "13:30", end: "14:15", client: "Clara Winther", initials: "CW", type: "Filler · genbehandling", modality: "Klinik", status: "Bekræftet", noShowRisk: 9, color: "var(--color-accent)" },
];

export const kpis = [
  { label: "Belægning i dag", value: "86%", delta: "+4", good: true },
  { label: "No-show risiko", value: "1 høj", delta: "håndteret", good: true },
  { label: "Omsætning · uge", value: "48.250 kr", delta: "+11%", good: true },
  { label: "AI-journaler", value: "23", delta: "auto-udkast", good: true },
];

export type Client = {
  id: string;
  name: string;
  initials: string;
  age: number;
  tag: string;
  lastVisit: string;
  trend: "up" | "down" | "flat";
};

export const clients: Client[] = [
  { id: "mette", name: "Mette Lindqvist", initials: "ML", age: 42, tag: "Æstetik", lastVisit: "I dag", trend: "up" },
  { id: "jonas", name: "Jonas Brandt", initials: "JB", age: 51, tag: "Æstetik", lastVisit: "I dag", trend: "flat" },
  { id: "amira", name: "Amira Haddad", initials: "AH", age: 27, tag: "Acne-forløb", lastVisit: "I dag", trend: "up" },
  { id: "per", name: "Per Sørensen", initials: "PS", age: 73, tag: "Sårpleje", lastVisit: "3 dage", trend: "down" },
  { id: "clara", name: "Clara Winther", initials: "CW", age: 38, tag: "Filler", lastVisit: "6 uger", trend: "flat" },
];

// Skin/AR analysis time-series for one client
export const skinParams = [
  { key: "Pletter", now: 71, prev: 58 },
  { key: "Rødme", now: 64, prev: 49 },
  { key: "Tekstur", now: 80, prev: 72 },
  { key: "Porer", now: 66, prev: 61 },
  { key: "UV-skader", now: 75, prev: 70 },
  { key: "Rynker", now: 83, prev: 81 },
];

export const journalEntries = [
  {
    date: "07. jun 2026",
    title: "Hudanalyse · AR-scan #5",
    truSkinAge: 39,
    chronoAge: 42,
    concerns: 14,
    note: "Synlig forbedring i rødme (+15) og pletter (+13) siden forrige forløb. TruSkin Age nu 3 år under kronologisk alder. Anbefaler fortsat LED + retinol-protokol.",
    aiDrafted: true,
  },
  {
    date: "24. maj 2026",
    title: "Opfølgning · session 4",
    truSkinAge: 41,
    chronoAge: 42,
    concerns: 14,
    note: "Patienten rapporterer mindre irritation. Mild peeling som forventet. Justeret koncentration.",
    aiDrafted: true,
  },
  {
    date: "02. maj 2026",
    title: "Baseline-scan",
    truSkinAge: 45,
    chronoAge: 42,
    concerns: 14,
    note: "Indledende kortlægning. Forhøjet pigmentering i zone 3 og 5. Forløb planlagt over 8 uger.",
    aiDrafted: false,
  },
];

// AI scribe transcript fragments (played back to simulate ambient capture)
export const scribeTranscript = [
  { who: "Behandler", text: "Hvordan har huden reageret siden sidst?" },
  { who: "Patient", text: "Meget bedre — mindre rødme, men lidt tørhed om morgenen." },
  { who: "Behandler", text: "Godt. Jeg kan se på scanningen at pigmenteringen i kinden er faldet pænt." },
  { who: "Patient", text: "Ja, og jeg har brugt serummet hver aften." },
  { who: "Behandler", text: "Vi fortsætter protokollen, men trapper retinol op til 0,5 procent." },
];

export const scribeNote = {
  subjective: "Patienten rapporterer reduceret rødme og god compliance med aften-serum. Beskriver mild tørhed om morgenen.",
  objective: "AR-scan viser fald i pigmentering, zone 3 (kind). Rødme +15 vs. baseline. Ingen tegn på irritation.",
  assessment: "Positiv respons på igangværende protokol. Hudbarriere stabil.",
  plan: "Fortsæt LED-protokol. Optrap retinol → 0,5%. Tilføj fugtcreme om morgenen. Genbesøg om 3 uger.",
  codes: ["L70.0 Acne vulgaris", "Forløb: AEST-04"],
};

// AI booking agent conversation seed
export const agentSeed = [
  { role: "agent", text: "Hej 👋 Jeg er Aria, klinikkens AI-assistent. Jeg kan booke, ombooke og svare på spørgsmål. Hvad kan jeg hjælpe med?" },
  { role: "user", text: "Jeg vil gerne booke en hudanalyse, helst torsdag eftermiddag." },
  { role: "agent", text: "Selvfølgelig. Dr. Krarup har ledigt **torsdag 12. juni kl. 14:00** og **15:30**. Begge er 45 min. Hvilken passer dig?" },
  { role: "user", text: "14:00 lyder godt." },
  { role: "agent", text: "Perfekt — jeg har reserveret **torsdag 12. juni kl. 14:00**. Bekræft venligst med MitID, så sender jeg en kvittering og en påmindelse 24 timer før. 🔒" },
];
