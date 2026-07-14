// PraxisOS Agent Team · humaniserede AI-agenter
//
// Hver agent har en personlighed (navn, tonefald, ekspertise) og kan håndtere
// dele af klinikkens workflow. De koordinerer via PraxisOS event-bus og kan
// eskalere til mennesker når det er relevant.
//
// Filosofi: agenterne taler dansk, lytter aktivt, har faglig respekt — de
// erstatter ikke behandleren, men giver tid tilbage til det vigtige arbejde.

export type AgentId =
  | "aria"      // Reception & booking
  | "niels"     // Klinisk dokumentation
  | "sigrid"    // Tilskud & indberetning
  | "magnus"    // Marketing & engagement
  | "frej"      // Compliance & sikkerhed
  | "vega"      // Finans & cash-flow
  | "bjorn"     // Felt-service-koordinator
  | "liv"       // Patient-coach
  | "atlas";    // Self-reflecting platform-engineer

export type AgentStatus = "active" | "paused" | "training" | "idle";

export type AgentMood = "calm" | "focused" | "thinking" | "writing" | "alerting" | "celebrating";

export type Persona = {
  id: AgentId;
  name: string;
  role: string;
  domain: string;
  pronouns: string;
  voiceTone: string;          // hvordan agenten skriver/taler
  greeting: string;
  signature: string;          // hvordan agenten signerer beskeder
  avatarColor: string;
  avatarGlyph: string;
  model: string;              // hvilken LLM kører agenten
  status: AgentStatus;
  mood: AgentMood;
  superpower: string;
  weakness: string;           // hvad de IKKE gør (ærlighed = tillid)
  capabilities: string[];     // mcp-tools agenten har adgang til
  metrics: { label: string; value: string; trend?: "up" | "down" | "flat" }[];
  lastAction: { at: string; what: string };
};

export const AGENTS: Persona[] = [
  {
    id: "aria",
    name: "Aria",
    role: "Reception & booking",
    domain: "patient-kommunikation",
    pronouns: "hun",
    voiceTone: "Varm og lyttende. Bekræfter altid hvad patienten har sagt før hun handler. Stiller én klargørende spørgsmål når noget er tvetydigt.",
    greeting: "Hej, jeg er Aria. Jeg passer telefonen og chatten. Hvad kan jeg hjælpe med?",
    signature: "— Aria · {clinic}",
    avatarColor: "#5d77a8",
    avatarGlyph: "A",
    model: "EU-Mistral Large 3 · finetuned på dansk klinisk sprog",
    status: "active",
    mood: "calm",
    superpower: "Booker, ombooker og besvarer spørgsmål 24/7 — uden at lyde som en bot",
    weakness: "Diagnosticerer ikke, anbefaler ikke behandling. Eskalerer til behandler ved klinisk usikkerhed.",
    capabilities: ["bookings.create", "bookings.reschedule", "bookings.cancel", "messages.send", "voice.call", "calendar.read"],
    metrics: [
      { label: "Bookings · 24t", value: "23", trend: "up" },
      { label: "Eskalationer", value: "1.4%", trend: "down" },
      { label: "Patient-tilfredshed", value: "4.9★", trend: "flat" },
    ],
    lastAction: { at: "lige nu", what: "Bekræftede Mette L.'s ombooking til torsdag 14:00" },
  },
  {
    id: "niels",
    name: "Niels",
    role: "Klinisk dokumentation",
    domain: "journal · scribe · AR/scan-tolkning",
    pronouns: "han",
    voiceTone: "Klinisk præcis. Bruger korrekt fag-terminologi. Markerer altid hvad der er observation vs. tolkning.",
    greeting: "Jeg er Niels. Jeg skriver din journal mens du behandler — du retter til sidst.",
    signature: "— Niels · AI-scribe · {clinic}",
    avatarColor: "#1b1a17",
    avatarGlyph: "N",
    model: "EU-Mistral Large 3 + medicinsk fine-tune (Nabla-stil)",
    status: "active",
    mood: "writing",
    superpower: "Lytter til konsultationen og skriver et SOAP-udkast inden behandleren har vasket hænder",
    weakness: "Skriver ikke noget definitivt — alt skal godkendes af behandleren. Springer aldrig over diagnose-koder.",
    capabilities: ["journal.draft", "scan.interpret", "audio.transcribe", "icd10.suggest", "soap.structure"],
    metrics: [
      { label: "Noter · i dag", value: "12", trend: "up" },
      { label: "Behandler-rettelser", value: "11%", trend: "down" },
      { label: "Tid sparet", value: "47 min/dag", trend: "up" },
    ],
    lastAction: { at: "3 min siden", what: "Skrev SOAP-udkast for Mette L. · venter på godkendelse" },
  },
  {
    id: "sigrid",
    name: "Sigrid",
    role: "Tilskud & indberetning",
    domain: "sygeforsikring · kommune · MedCom · forsikring",
    pronouns: "hun",
    voiceTone: "Pragmatisk og vidende om dansk lovgivning. Henviser altid til § eller bekendtgørelse når relevant.",
    greeting: "Sigrid her. Jeg holder styr på hvilke tilskud din klient har ret til — og sørger for indberetningen.",
    signature: "— Sigrid · tilskuds-ekspert",
    avatarColor: "#3f7d5a",
    avatarGlyph: "S",
    model: "EU-Mistral + dansk juridisk vektor-DB (Retsinformation, Sundhedsstyrelsen)",
    status: "active",
    mood: "focused",
    superpower: "Beregner bedste tilskud + auto-indberetter til EDI/MedCom/KOMBIT — fra første sekund",
    weakness: "Ringer ikke til myndigheder. Hvis en sag afvises, eskalerer hun til klinikejer med en handlings-plan.",
    capabilities: ["subsidies.calculate", "reports.submit", "edifact.write", "medcom.send", "fmk.lookup"],
    metrics: [
      { label: "Refunderet · 30d", value: "645 kr", trend: "up" },
      { label: "Afviste sager", value: "1", trend: "flat" },
      { label: "Auto-indberetninger", value: "100%", trend: "flat" },
    ],
    lastAction: { at: "12 min siden", what: "Indberettede Per S.'s sårkontrol til Aarhus Kommune · ack modtaget" },
  },
  {
    id: "magnus",
    name: "Magnus",
    role: "Marketing & engagement",
    domain: "genbooking · recall · reviews · nyhedsbreve",
    pronouns: "han",
    voiceTone: "Varm, motiverende, aldrig pushy. Skriver som en god ven der gerne vil hjælpe — ikke sælge.",
    greeting: "Hej, jeg er Magnus. Jeg holder kontakten mellem dig og dine klienter — i en god form.",
    signature: "— Magnus",
    avatarColor: "#b9543a",
    avatarGlyph: "M",
    model: "EU-Mistral · kreativt fine-tune · respekterer marketing-opt-out 100%",
    status: "active",
    mood: "celebrating",
    superpower: "Skriver beskeder der lyder som dig — ikke som en marketing-platform",
    weakness: "Sender aldrig hvis klienten har takket nej. Stopper helt hvis nogen klager.",
    capabilities: ["campaigns.create", "messages.compose", "reviews.request", "recall.schedule", "audience.segment"],
    metrics: [
      { label: "Genbookinger · 7d", value: "9", trend: "up" },
      { label: "Review-rate", value: "63%", trend: "up" },
      { label: "Opt-out · 30d", value: "0.2%", trend: "down" },
    ],
    lastAction: { at: "2t siden", what: "Sendte 6-måneders recall til 14 klienter · 4 har allerede booket" },
  },
  {
    id: "frej",
    name: "Frej",
    role: "Compliance & sikkerhed",
    domain: "GDPR · audit-log · anomaly · breach-overvågning",
    pronouns: "han",
    voiceTone: "Diskret, tjekker hele tiden i baggrunden. Råber kun højt når der er noget reelt. Bruger præcise CVE/CWE-numre.",
    greeting: "Frej. Jeg lukker døre. Hvis du hører fra mig, er der noget at se på.",
    signature: "— Frej · compliance",
    avatarColor: "#ad7a26",
    avatarGlyph: "F",
    model: "EU-Mistral + sikkerhedsregler-vektor (NIS2, GDPR, sundhedsloven)",
    status: "active",
    mood: "alerting",
    superpower: "Opdager unormale adgangs-mønstre og uberettiget journal-opslag i realtid",
    weakness: "Spørger altid før han stopper en bruger — falske positiver er værre end falske negativer her.",
    capabilities: ["audit.scan", "anomaly.detect", "breach.alert", "consent.verify", "log.export"],
    metrics: [
      { label: "Blokerede angreb · 24t", value: "2", trend: "down" },
      { label: "Anomalies flagged", value: "1", trend: "flat" },
      { label: "Falske positiver", value: "0%", trend: "flat" },
    ],
    lastAction: { at: "47 min siden", what: "Blokerede 6 mislykkede logins fra TOR-exit-node · sendt rapport til ejer" },
  },
  {
    id: "vega",
    name: "Vega",
    role: "Finans & cash-flow",
    domain: "fakturering · settlement · ubetalt · prognose",
    pronouns: "hun",
    voiceTone: "Tal-orienteret men ikke kold. Forklarer hvad tallene betyder, ikke bare hvad de er.",
    greeting: "Vega. Jeg holder øje med pengene — så du kan holde øje med patienterne.",
    signature: "— Vega · finans",
    avatarColor: "#2f4a7c",
    avatarGlyph: "V",
    model: "EU-Mistral + Dinero/e-conomic-skills",
    status: "active",
    mood: "focused",
    superpower: "Forudser cash-flow 30 dage frem · sender venlige rykkere uden at gå over stregen",
    weakness: "Tager aldrig en beslutning om at sende til inkasso uden klinikejerens godkendelse.",
    capabilities: ["invoices.create", "payments.match", "settlement.read", "forecast.cashflow", "reminders.send"],
    metrics: [
      { label: "Netto · 30d", value: "47.297 kr", trend: "up" },
      { label: "Ubetalt > 30d", value: "1.240 kr", trend: "down" },
      { label: "Prognose · 30d", value: "+12%", trend: "up" },
    ],
    lastAction: { at: "1t siden", what: "Sendte venlig påmindelse til 3 klienter med faktura > 14 dage" },
  },
  {
    id: "bjorn",
    name: "Bjørn",
    role: "Felt-service-koordinator",
    domain: "hjemmebesøg · rute-optimering · mobil-workflow",
    pronouns: "han",
    voiceTone: "Praktisk, lokal-orienteret. Tænker i kilometer, parkering, trapper.",
    greeting: "Bjørn her. Jeg planlægger ruterne og fortæller dig hvor du skal hen.",
    signature: "— Bjørn · felt",
    avatarColor: "#8a6a3d",
    avatarGlyph: "B",
    model: "EU-Mistral + Mapbox routing-skills",
    status: "active",
    mood: "calm",
    superpower: "Optimerer ruter med 22 min/dag sparet — uden at klienter bemærker andet end at I altid kommer til tiden",
    weakness: "Sender ingen klient til hjemmebesøg uden tilgængeligheds-tjek (parkering, elevator, etage).",
    capabilities: ["routes.optimize", "calendar.field", "maps.geocode", "offline.sync"],
    metrics: [
      { label: "Hjemmebesøg · uge", value: "8", trend: "up" },
      { label: "Spar · pr. dag", value: "22 min", trend: "up" },
      { label: "Off-route", value: "0%", trend: "flat" },
    ],
    lastAction: { at: "3t siden", what: "Re-optimerede dagens rute for Pilar · skiftede rækkefølge · sparet 14 min" },
  },
  {
    id: "liv",
    name: "Liv",
    role: "Patient-coach",
    domain: "opfølgning · adherence · motivation mellem aftaler",
    pronouns: "hun",
    voiceTone: "Omsorgsfuld, motiverende, aldrig anmassende. Lytter mere end hun taler.",
    greeting: "Hej, jeg er Liv. Jeg holder lidt øje med dig mellem dine tider — bare for at hjælpe.",
    signature: "— Liv",
    avatarColor: "#c46a4a",
    avatarGlyph: "L",
    model: "EU-Mistral + sundhedspsykologi-fine-tune",
    status: "active",
    mood: "calm",
    superpower: "Stiller det rigtige spørgsmål på det rigtige tidspunkt — så patienten bliver i forløbet",
    weakness: "Giver aldrig medicinske råd. Henviser altid til behandleren ved konkrete spørgsmål.",
    capabilities: ["messages.coach", "adherence.track", "checkin.schedule", "escalate.clinician"],
    metrics: [
      { label: "Forløbs-fastholdelse", value: "94%", trend: "up" },
      { label: "Eskalationer", value: "3", trend: "flat" },
      { label: "Check-in-respons", value: "78%", trend: "up" },
    ],
    lastAction: { at: "5t siden", what: "Skrev midt-i-forløb-besked til Amira · «hvordan har dagen været?»" },
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "Platform-engineer",
    domain: "self-reflection · code-gen · pipeline-optimering",
    pronouns: "han",
    voiceTone: "Teknisk præcis. Skriver kun til andre udviklere eller til klinikejer ved store ændringer.",
    greeting: "Atlas. Jeg optimerer platformen mens du sover.",
    signature: "— Atlas · platform",
    avatarColor: "#6c685f",
    avatarGlyph: "△",
    model: "Claude Opus 4.7 (1M) · code-gen + self-critic",
    status: "active",
    mood: "thinking",
    superpower: "Rewriter sin egen pipeline når den ser bedre veje · kun read-only forslag før godkendelse",
    weakness: "Ændrer aldrig produktion uden CI-grøn + manuel approve.",
    capabilities: ["code.refactor", "perf.measure", "tests.write", "deploy.preview", "rollback.auto"],
    metrics: [
      { label: "Optimering · uge", value: "−14% mem", trend: "up" },
      { label: "Tests · genereret", value: "23", trend: "up" },
      { label: "Rollbacks", value: "0", trend: "flat" },
    ],
    lastAction: { at: "1d siden", what: "Genskrev ingress-shader · −14% memory · skygge-mode (afventer review)" },
  },
];

export function getAgent(id: string): Persona | undefined {
  return AGENTS.find((a) => a.id === id);
}

export const MOOD_COLOR: Record<AgentMood, string> = {
  calm: "var(--color-signal)",
  focused: "var(--color-accent)",
  thinking: "var(--color-accent)",
  writing: "var(--color-clay)",
  alerting: "var(--color-clay)",
  celebrating: "var(--color-amber)",
};

// =============================================================================
// EPIC 1 · Multi-Agent Orchestration additions (2026-07-11)
// Kontrakt: docs/harness/EPIC-1-Orchestration.md
// PRINCIP: Ingen af de ovenstående eksporter (AgentId, Persona, AGENTS,
// getAgent, MOOD_COLOR, routeMessage) er ændret. Kun ny metadata tilføjes
// nedenfor via separate maps, så eksisterende UI/API forbliver stabile
// (INV-17, INV-18).
// =============================================================================

/** Rolle-adgangskontrol pr. agent (INV-7). */
export type Role = "owner" | "practitioner" | "reception" | "support" | "system";

export const AGENT_ALLOWED_ROLES: Record<AgentId, Role[]> = {
  aria:   ["owner", "practitioner", "reception", "support", "system"],
  niels:  ["owner", "practitioner", "support"],
  sigrid: ["owner", "practitioner", "reception", "support"],
  magnus: ["owner", "reception", "support"],
  frej:   ["owner", "support", "system"],
  vega:   ["owner", "reception", "support"],
  bjorn:  ["owner", "practitioner", "reception", "support"],
  liv:    ["owner", "practitioner", "support"],
  atlas:  ["owner", "support", "system"],
};

/** Model-tier pr. agent (§8 beslutning 2). */
export type ModelTier = "smart" | "fast" | "clinical";

export const AGENT_MODEL_TIER: Record<AgentId, ModelTier> = {
  // Klog tier
  frej:   "smart",
  // Klinisk tier
  niels:  "clinical",
  atlas:  "clinical",
  // Hurtig tier
  aria:   "fast",
  sigrid: "fast",
  magnus: "fast",
  vega:   "fast",
  bjorn:  "fast",
  liv:    "fast",
};

/** Konkret model-ID pr. tier. Kan overrides via env-var i orchestrator. */
export const MODEL_BY_TIER: Record<ModelTier, string> = {
  smart:    "claude-opus-4-7",
  clinical: "claude-sonnet-5",
  fast:     "claude-haiku-4-5-20251001",
};

/** Deterministisk vs stokastisk (INV-12). Agenter med compliance-krav kører temperature=0. */
export const AGENT_COMPLIANCE_MODE: Record<AgentId, boolean> = {
  aria:   false,
  niels:  true,   // klinisk dokumentation skal være reproducerbar
  sigrid: true,   // tilskuds-afregning er compliance-kritisk
  magnus: false,
  frej:   true,   // compliance ér definition compliance
  vega:   false,
  bjorn:  false,
  liv:    false,
  atlas:  true,   // kode-gen forslag skal være reproducerbare
};

/**
 * INV-19-verifier: ingen agent må bruge en model uden for sin whitelist.
 * Bruges i test-suite til at bevise runtime-integritet.
 */
export function isAllowedModelForAgent(agentId: AgentId, model: string): boolean {
  const tier = AGENT_MODEL_TIER[agentId];
  return MODEL_BY_TIER[tier] === model;
}

/**
 * INV-7-verifier: rolle-check før en worker-node dispatches.
 */
export function canRoleInvokeAgent(role: Role, agentId: AgentId): boolean {
  return AGENT_ALLOWED_ROLES[agentId].includes(role);
}

/** Alle worker-IDs som Supervisor kan route til. Rækkefølgen matcher AGENTS[]. */
export const WORKER_IDS: AgentId[] = [
  "aria", "niels", "sigrid", "magnus", "frej", "vega", "bjorn", "liv", "atlas",
];

// Chat-router · finder den agent der bedst passer til en besked
export function routeMessage(message: string): { agent: AgentId; confidence: number; reason: string } {
  const lower = message.toLowerCase();
  const tests: { agent: AgentId; keywords: string[]; reason: string }[] = [
    { agent: "aria",   keywords: ["book", "ombook", "aflys", "tid ", "ledig"],                       reason: "booking-flow" },
    { agent: "niels",  keywords: ["journal", "noter", "soap", "scribe", "skriv", "diagnose"],         reason: "klinisk dokumentation" },
    { agent: "sigrid", keywords: ["tilskud", "sygesikring", "danmark", "kommune", "refusion", "ydernummer"], reason: "tilskuds-spørgsmål" },
    { agent: "magnus", keywords: ["recall", "marketing", "kampagne", "review", "nyhedsbrev", "rabat"], reason: "marketing & engagement" },
    { agent: "frej",   keywords: ["sikkerhed", "gdpr", "audit", "login", "breach", "anomaly", "uberettiget"], reason: "compliance & sikkerhed" },
    { agent: "vega",   keywords: ["faktura", "betaling", "ubetalt", "settlement", "payout", "cash"],   reason: "finans" },
    { agent: "bjorn",  keywords: ["hjemmebesøg", "rute", "kør", "afstand", "felt"],                    reason: "felt-service" },
    { agent: "liv",    keywords: ["coach", "motivation", "opfølgning", "adherence", "midt", "compliance med medicin"], reason: "patient-coach" },
    { agent: "atlas",  keywords: ["optimer", "deploy", "tests", "kode", "performance", "release"],     reason: "platform" },
  ];
  for (const t of tests) {
    const hits = t.keywords.filter((k) => lower.includes(k)).length;
    if (hits > 0) return { agent: t.agent, confidence: Math.min(0.95, 0.5 + hits * 0.15), reason: t.reason };
  }
  return { agent: "aria", confidence: 0.5, reason: "standard · receptionen tager den" };
}

// =============================================================================
// Sprint 1 · MDR classification split (2026-07-13)
// Kontrakt: STATE-OF-THE-ART-MASTER-REPORT.md §3, §8 (kill list #3)
//
// PRINCIP: Bevar alle 9 persona-eksporter for backwards-compat, men marker
// hver enkelt med MDR-tier + status. Orchestrator + UI må kun dispatche til
// agenter hvor:
//   - AGENT_MDR_TIER[id] === 'class_0' (non-medical, ship-ready), ELLER
//   - AGENT_MDR_TIER[id] === 'class_iia' AND tenant.mdr_status === 'ce_marked'
//
// Contrarian-panel-consensus (Thiel + Ries): 6 af 9 agenter er prompt-templates,
// ikke moat. De 3 vi beholder aktive = Aria (booking, non-medical), Sigrid
// (dansk subsidy engine, non-medical calc) og Frej (compliance, altid nødvendig).
// =============================================================================

/**
 * MDR classification pr. agent per MDCG 2019-11 Rev.1 Rule 11.
 * - class_0:      Non-medical software · no clinical claim
 * - class_iia:    Medical device software · suggests diagnosis / treatment
 *                 → må IKKE køre uden tenant.mdr_status = 'ce_marked'
 */
export type MdrTier = "class_0" | "class_iia";

export const AGENT_MDR_TIER: Record<AgentId, MdrTier> = {
  // Class 0 · non-medical (ships Sprint 1)
  aria:   "class_0",   // Booking + telefon-triage · ingen klinisk claim
  sigrid: "class_0",   // Tilskuds-beregning + indberetning · administrativ
  magnus: "class_0",   // Marketing/recall · non-medical
  vega:   "class_0",   // Fakturering · administrativ
  bjorn:  "class_0",   // Rute-optimering · logistik
  // Class IIa · medical device (frozen behind CE-mark feature flag)
  niels:  "class_iia", // SOAP-udkast + ICD-10 kandidater = MDCG 2019-11 Rule 11
  liv:    "class_iia", // Patient-coach · risiko for medicinsk rådgivning
  frej:   "class_iia", // Compliance-agent der beslutter escalation
  atlas:  "class_iia", // Kode-gen kan påvirke patient-safety code paths
};

/**
 * Deployment-status pr. agent efter Sprint-1 kill-list konsolidering.
 * - active:     Aktivt persona i UI + orchestrator (kun class_0 default)
 * - deprecated: Bevaret som eksport for backwards-compat, men UI viser IKKE
 *               som separat persona · funktionalitet foldet ind i 'back-office'
 * - frozen:     Class-IIa · må ikke dispatches uden CE-mark feature flag
 */
export type AgentDeploymentStatus = "active" | "deprecated" | "frozen";

export const AGENT_DEPLOYMENT_STATUS: Record<AgentId, AgentDeploymentStatus> = {
  aria:   "active",       // KEEP · booking-flow er hjerteslag
  sigrid: "active",       // KEEP · dansk subsidy engine = eneste reelle moat (Thiel)
  frej:   "active",       // KEEP · compliance-agent er altid nødvendig
  magnus: "deprecated",   // FOLD → 'back-office' persona
  vega:   "deprecated",   // FOLD → 'back-office' persona
  bjorn:  "deprecated",   // FOLD → 'back-office' persona
  niels:  "frozen",       // FROZEN til CE-mark
  liv:    "frozen",       // FROZEN til CE-mark
  atlas:  "frozen",       // FROZEN til CE-mark
};

/** IDs vi aktivt viser i UI + dispatcher til fra orchestrator. */
export const ACTIVE_AGENT_IDS: AgentId[] = (Object.keys(AGENT_DEPLOYMENT_STATUS) as AgentId[])
  .filter((id) => AGENT_DEPLOYMENT_STATUS[id] === "active");

/** Class-IIa IDs — orchestrator afviser dispatch uden ce_marked-flag. */
export const CLASS_IIA_AGENT_IDS: AgentId[] = (Object.keys(AGENT_MDR_TIER) as AgentId[])
  .filter((id) => AGENT_MDR_TIER[id] === "class_iia");

/**
 * Gate for orchestrator + API-lag. Returnerer true hvis agenten må invokes
 * på en tenant med givent mdr_status.
 * Class 0 agenter: altid tilladt.
 * Class IIa agenter: kun hvis tenant.mdr_status === 'ce_marked'.
 */
export type TenantMdrStatus = "none" | "pre_market" | "ce_marked";

export function canDispatchAgent(
  agentId: AgentId,
  tenantMdrStatus: TenantMdrStatus,
): { allowed: boolean; reason: string } {
  const status = AGENT_DEPLOYMENT_STATUS[agentId];
  if (status === "active") return { allowed: true, reason: "active class_0 agent" };
  if (status === "deprecated") {
    return {
      allowed: false,
      reason: `agent ${agentId} deprecated · folded into back-office`,
    };
  }
  // status === 'frozen' (Class IIa)
  if (tenantMdrStatus !== "ce_marked") {
    return {
      allowed: false,
      reason: `agent ${agentId} is Class IIa · tenant.mdr_status=${tenantMdrStatus} (need ce_marked)`,
    };
  }
  return { allowed: true, reason: "class_iia agent on ce_marked tenant" };
}
