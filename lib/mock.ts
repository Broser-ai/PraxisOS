// Mock data for the PraxisOS prototype. No backend — purely illustrative.

export const clinic = {
  name: "by Pilar",
  plan: "PraxisOS · Fodpleje",
  region: "EU · Hetzner · app.bypilar.dk",
};

export const practitioner = {
  name: "Pilar Hernández",
  role: "Fodterapeut · negle & fodpleje",
  initials: "PH",
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
  { id: "a1", time: "08:30", end: "09:00", client: "Mette Lindqvist", initials: "ML", type: "Fod-scan · opfølgning", modality: "Klinik", status: "Ankommet", noShowRisk: 6, color: "var(--color-accent)" },
  { id: "a2", time: "09:15", end: "10:00", client: "Jonas Brandt", initials: "JB", type: "Medicinsk fodpleje", modality: "Klinik", status: "Bekræftet", noShowRisk: 12, color: "var(--color-clay)" },
  { id: "a3", time: "10:30", end: "11:15", client: "Amira Haddad", initials: "AH", type: "Gel manicure", modality: "Klinik", status: "Bekræftet", noShowRisk: 41, color: "var(--color-signal)" },
  { id: "a4", time: "11:30", end: "12:15", client: "Per Sørensen", initials: "PS", type: "Medicinsk fodpleje", modality: "Hjemmebesøg", status: "Afventer", noShowRisk: 68, color: "var(--color-amber)" },
  { id: "a5", time: "13:30", end: "14:45", client: "Clara Winther", initials: "CW", type: "Luksus fodpleje", modality: "Klinik", status: "Bekræftet", noShowRisk: 9, color: "var(--color-accent)" },
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
  { id: "mette", name: "Mette Lindqvist", initials: "ML", age: 42, tag: "Fodpleje", lastVisit: "I dag", trend: "up" },
  { id: "jonas", name: "Jonas Brandt", initials: "JB", age: 51, tag: "Fodpleje", lastVisit: "I dag", trend: "flat" },
  { id: "amira", name: "Amira Haddad", initials: "AH", age: 27, tag: "Negle", lastVisit: "I dag", trend: "up" },
  { id: "per", name: "Per Sørensen", initials: "PS", age: 73, tag: "Fodpleje", lastVisit: "3 dage", trend: "down" },
  { id: "clara", name: "Clara Winther", initials: "CW", age: 38, tag: "Fodpleje", lastVisit: "6 uger", trend: "flat" },
];

// Fod-parametre (plantar / klinisk) — tidsserie for én klient
export const skinParams = [
  { key: "Plantar tryk", now: 71, prev: 58 },
  { key: "Hyperkeratose", now: 64, prev: 49 },
  { key: "Negle-tilstand", now: 80, prev: 72 },
  { key: "Cirkulation", now: 66, prev: 61 },
  { key: "Mobilitet", now: 75, prev: 70 },
  { key: "Smerte (VAS)", now: 83, prev: 81 },
];

export const journalEntries = [
  {
    date: "07. jun 2026",
    title: "Fod-scan · opfølgning #5",
    truSkinAge: 39,
    chronoAge: 42,
    concerns: 4,
    note: "Synlig forbedring af plantar trykfordeling og mindre hyperkeratose plantart. Anbefaler fortsat medicinsk fodpleje + hjemmetræning.",
    aiDrafted: true,
  },
  {
    date: "24. maj 2026",
    title: "Medicinsk fodpleje · session 4",
    truSkinAge: 41,
    chronoAge: 42,
    concerns: 5,
    note: "Patienten rapporterer mindre smerte ved gang. Let peeling som forventet efter fjernelse af hård hud.",
    aiDrafted: true,
  },
  {
    date: "02. maj 2026",
    title: "Baseline fod-scan",
    truSkinAge: 45,
    chronoAge: 42,
    concerns: 6,
    note: "Indledende kortlægning. Forhøjet tryk under 1. metatarsalhoved. Forløb planlagt over 8 uger.",
    aiDrafted: false,
  },
];

// AI scribe transcript fragments (played back to simulate ambient capture)
export const scribeTranscript = [
  { who: "Behandler", text: "Hvordan har fødderne haft det siden sidst?" },
  { who: "Patient", text: "Meget bedre — mindre smerte når jeg går, men stadig lidt ømt under forfoden." },
  { who: "Behandler", text: "Godt. Scanningen viser, at trykket under storetåens led er faldet pænt." },
  { who: "Patient", text: "Ja, og jeg har brugt indlægssålerne hver dag." },
  { who: "Behandler", text: "Vi fortsætter medicinsk fodpleje og justerer indlægget en smule." },
];

export const scribeNote = {
  subjective: "Patienten rapporterer reduceret smerte ved gang og god compliance med indlægssåler. Beskriver mild ømhed plantart.",
  objective: "Fod-scan viser forbedret plantar trykfordeling. Hyperkeratose reduceret. Ingen tegn på infektion.",
  assessment: "Positiv respons på medicinsk fodpleje. Cirkulation tilfredsstillende.",
  plan: "Fortsæt medicinsk fodpleje. Justér indlæg. Hjemmetræning. Genbesøg om 3 uger.",
  codes: ["L84 Ligtorne og callositeter", "Forløb: FOD-04"],
};

// AI booking agent conversation seed
export const agentSeed = [
  { role: "agent", text: "Hej — jeg er Aria, klinikkens AI-assistent hos by Pilar. Jeg kan booke fodpleje, fod-scan og negle. Hvad kan jeg hjælpe med?" },
  { role: "user", text: "Jeg vil gerne booke medicinsk fodpleje, helst torsdag eftermiddag." },
  { role: "agent", text: "Selvfølgelig. Pilar har ledigt **torsdag 12. juni kl. 14:00** og **15:30**. Begge er 45 min. Hvilken passer dig?" },
  { role: "user", text: "14:00 lyder godt." },
  { role: "agent", text: "Perfekt — jeg har reserveret **medicinsk fodpleje · torsdag 12. juni kl. 14:00**. Du får SMS-påmindelse 24 timer før." },
];
