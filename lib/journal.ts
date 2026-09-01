// PraxisOS journal · treatment records (SOAP) linked to bookings & clients
// System of record for each behandling — draft by Niels, signed by clinician.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bookings, getBooking, type Booking } from "@/lib/bookings";
import { getClient } from "@/lib/clients";
import { publishEvent } from "@/lib/event-bus";

export type JournalStatus = "draft" | "pending_approval" | "signed" | "amended";

export type SoapNote = {
  S: string;
  O: string;
  A: string;
  P: string;
};

export type JournalEntry = {
  id: string;
  tenant: string;
  clientId: string;
  clientName: string;
  bookingId?: string;
  service: string;
  serviceId?: string;
  practitioner: string;
  status: JournalStatus;
  soap: SoapNote;
  codes: string[];
  transcript?: string;
  aiDrafted: boolean;
  draftedBy: "niels" | "clinician" | "import";
  signedBy?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
  visitAt: string;
  amendments?: { at: string; by: string; note: string }[];
};

type Store = { entries: JournalEntry[] };

const g = globalThis as typeof globalThis & { __praxisJournalStore?: Store };

function store(): Store {
  if (!g.__praxisJournalStore) {
    g.__praxisJournalStore = { entries: [] };
    hydrate(g.__praxisJournalStore);
    if (g.__praxisJournalStore.entries.length === 0) {
      g.__praxisJournalStore.entries = seedEntries();
      persist();
    }
  }
  return g.__praxisJournalStore;
}

function dataDir(): string | null {
  return process.env.PRAXIS_DATA_DIR?.trim() || null;
}

function hydrate(s: Store) {
  const dir = dataDir();
  if (!dir) return;
  try {
    const path = join(dir, "journal-store.json");
    if (!existsSync(path)) return;
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<Store>;
    if (Array.isArray(raw.entries)) s.entries = raw.entries;
  } catch {
    // ignore
  }
}

function persist() {
  const dir = dataDir();
  if (!dir) return;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "journal-store.json"), JSON.stringify({ entries: store().entries }, null, 2), "utf8");
  } catch {
    // ignore
  }
}

function nid() {
  return "jr_" + randomBytes(5).toString("hex");
}

function seedEntries(): JournalEntry[] {
  const now = Date.now();
  const completed = bookings.filter((b) => b.status === "completed").slice(0, 6);
  const seeded: JournalEntry[] = completed.map((b, i) => {
    const client = getClient(b.clientId);
    const signed = i < 4;
    return {
      // Stable ids so rebuild/SSG never invents dangling journal links.
      id: `jr_${b.id}`,
      tenant: b.tenant,
      clientId: b.clientId,
      clientName: b.clientName,
      bookingId: b.id,
      service: b.service,
      serviceId: b.serviceId,
      practitioner: b.practitioner,
      status: signed ? "signed" : "pending_approval",
      soap: soapForBooking(b),
      codes: suggestCodes(b.serviceId, client?.tag),
      aiDrafted: true,
      draftedBy: "niels",
      signedBy: signed ? b.practitioner : undefined,
      signedAt: signed ? new Date(now - (i + 1) * 86400_000).toISOString() : undefined,
      createdAt: new Date(Date.parse(b.startsAt) - 3600_000).toISOString(),
      updatedAt: new Date(Date.parse(b.startsAt) + b.durationMin * 60_000).toISOString(),
      visitAt: b.startsAt,
    };
  });

  // One open draft without booking (manual note)
  seeded.unshift({
    id: "jr_draft_per_opfølgning",
    tenant: "bypilar",
    clientId: "per",
    clientName: "Per Sørensen",
    service: "Medicinsk fodpleje · opfølgning",
    serviceId: "fod-med",
    practitioner: "Pilar",
    status: "draft",
    soap: {
      S: "Patient beskriver ømhed under højre forfod efter gang.",
      O: "",
      A: "",
      P: "",
    },
    codes: [],
    aiDrafted: false,
    draftedBy: "clinician",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    visitAt: new Date().toISOString(),
  });

  return seeded;
}

function soapForBooking(b: Booking): SoapNote {
  const first = b.clientName.split(" ")[0] ?? "Patienten";
  switch (b.serviceId) {
    case "fod-med":
    case "fod-lux":
      return {
        S: `${first} beskriver trykømhed og ønske om medicinsk fodpleje. Compliance med hjemmetræning varierende.`,
        O: "Hud og negle inspiceret. Let hyperkeratose plantart. Ingen akut infektion. Cirkulation tilfredsstillende.",
        A: "Indikation for medicinsk fodpleje. Stabil tilstand — fortsat forebyggende behandlingsplan.",
        P: "Behandling gennemført. Hjemmeinstruks givet. Kontrol iht. forløb / ved forværring.",
      };
    case "fod-scan":
      return {
        S: `${first} til AR/fod-scan og opfølgning af tidligere fund.`,
        O: "Scan gennemført. Trykfordeling og asymmetri vurderet. Ingen akut rødme.",
        A: "Positiv udvikling ift. baseline hvor relevant. Fortsat observation.",
        P: "Scan arkiveret i journal. Opfølgning planlagt. Eventuel justering af sko/indlæg drøftet.",
      };
    default:
      return {
        S: `${first} til ${b.service}. Beskriver aktuelle gener og forventninger.`,
        O: "Klinisk undersøgelse gennemført. Fund dokumenteret under konsultationen.",
        A: "Behandlingsindikation bekræftet. Ingen akutte røde flag i denne session.",
        P: `Behandling (${b.service}) gennemført. Opfølgning efter behov.`,
      };
  }
}

export function suggestCodes(serviceId?: string, tag?: string): string[] {
  const codes: string[] = [];
  if (serviceId?.startsWith("fod")) codes.push("L84 Callositas");
  if (tag === "Sårpleje") codes.push("E11.9 Type 2-diabetes u. komplikation");
  if (tag === "Acne-forløb" || tag === "Æstetik") codes.push("L70.0 Acne vulgaris");
  if (codes.length === 0) codes.push("Z13.9 Screening uspecificeret");
  return codes;
}

export function listJournal(opts?: {
  tenant?: string;
  clientId?: string;
  bookingId?: string;
  status?: JournalStatus | JournalStatus[];
  limit?: number;
}): JournalEntry[] {
  const statuses = opts?.status
    ? Array.isArray(opts.status)
      ? opts.status
      : [opts.status]
    : null;
  const limit = Math.min(200, opts?.limit ?? 100);
  return store()
    .entries.filter((e) => {
      if (opts?.tenant && e.tenant !== opts.tenant) return false;
      if (opts?.clientId && e.clientId !== opts.clientId) return false;
      if (opts?.bookingId && e.bookingId !== opts.bookingId) return false;
      if (statuses && !statuses.includes(e.status)) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.visitAt) - Date.parse(a.visitAt))
    .slice(0, limit);
}

export function getJournalEntry(id: string): JournalEntry | undefined {
  return store().entries.find((e) => e.id === id);
}

export function getJournalByBooking(bookingId: string): JournalEntry | undefined {
  return store().entries.find((e) => e.bookingId === bookingId);
}

export async function createJournalEntry(input: {
  tenant?: string;
  clientId: string;
  bookingId?: string;
  service?: string;
  serviceId?: string;
  practitioner?: string;
  soap?: Partial<SoapNote>;
  transcript?: string;
  draftedBy?: JournalEntry["draftedBy"];
  aiDrafted?: boolean;
}): Promise<JournalEntry> {
  const booking = input.bookingId ? getBooking(input.bookingId) : undefined;
  if (input.bookingId && getJournalByBooking(input.bookingId)) {
    throw new Error("journal_exists_for_booking");
  }
  const client = getClient(input.clientId);
  const entry: JournalEntry = {
    id: nid(),
    tenant: input.tenant ?? booking?.tenant ?? "bypilar",
    clientId: input.clientId,
    clientName: client?.name ?? booking?.clientName ?? input.clientId,
    bookingId: input.bookingId,
    service: input.service ?? booking?.service ?? "Konsultation",
    serviceId: input.serviceId ?? booking?.serviceId,
    practitioner: input.practitioner ?? booking?.practitioner ?? "Pilar",
    status: "draft",
    soap: {
      S: input.soap?.S ?? "",
      O: input.soap?.O ?? "",
      A: input.soap?.A ?? "",
      P: input.soap?.P ?? "",
    },
    codes: suggestCodes(input.serviceId ?? booking?.serviceId, client?.tag),
    transcript: input.transcript,
    aiDrafted: Boolean(input.aiDrafted),
    draftedBy: input.draftedBy ?? "clinician",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    visitAt: booking?.startsAt ?? new Date().toISOString(),
  };
  store().entries.unshift(entry);
  persist();
  await publishEvent({
    type: "journal.created",
    tenant: entry.tenant,
    data: { journalId: entry.id, clientId: entry.clientId, bookingId: entry.bookingId },
    source: "journal",
  });
  return entry;
}

export async function ensureJournalForBooking(bookingId: string): Promise<JournalEntry> {
  const existing = getJournalByBooking(bookingId);
  if (existing) return existing;
  const b = getBooking(bookingId);
  if (!b) throw new Error("booking_not_found");
  return createJournalEntry({
    tenant: b.tenant,
    clientId: b.clientId,
    bookingId: b.id,
    service: b.service,
    serviceId: b.serviceId,
    practitioner: b.practitioner,
    soap: soapForBooking(b),
    aiDrafted: true,
    draftedBy: "niels",
  });
}

export function updateJournalEntry(
  id: string,
  patch: {
    soap?: Partial<SoapNote>;
    codes?: string[];
    transcript?: string;
    status?: JournalStatus;
    service?: string;
    practitioner?: string;
  },
): JournalEntry | undefined {
  const e = getJournalEntry(id);
  if (!e) return undefined;
  if (e.status === "signed") {
    throw new Error("journal_locked_signed");
  }
  if (patch.soap) e.soap = { ...e.soap, ...patch.soap };
  if (patch.codes) e.codes = patch.codes;
  if (patch.transcript !== undefined) e.transcript = patch.transcript;
  if (patch.status) e.status = patch.status;
  if (patch.service) e.service = patch.service;
  if (patch.practitioner) e.practitioner = patch.practitioner;
  e.updatedAt = new Date().toISOString();
  persist();
  return e;
}

export async function draftSoapForEntry(
  id: string,
  opts?: { transcript?: string },
): Promise<JournalEntry> {
  const e = getJournalEntry(id);
  if (!e) throw new Error("journal_not_found");
  if (e.status === "signed") throw new Error("journal_locked_signed");

  const transcript = opts?.transcript ?? e.transcript ?? "";
  const soap = await generateSoapDraft({
    clientName: e.clientName,
    service: e.service,
    serviceId: e.serviceId,
    transcript,
  });

  e.soap = soap;
  e.transcript = transcript || e.transcript;
  e.aiDrafted = true;
  e.draftedBy = "niels";
  e.status = "pending_approval";
  e.codes = e.codes.length ? e.codes : suggestCodes(e.serviceId, getClient(e.clientId)?.tag);
  e.updatedAt = new Date().toISOString();
  persist();

  await publishEvent({
    type: "ai.scribe_drafted",
    tenant: e.tenant,
    data: { journalId: e.id, clientId: e.clientId, bookingId: e.bookingId },
    source: "journal:niels",
  });

  return e;
}

async function generateSoapDraft(input: {
  clientName: string;
  service: string;
  serviceId?: string;
  transcript: string;
}): Promise<SoapNote> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey && input.transcript.trim()) {
    try {
      const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
      const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Du er Niels, AI-scribe i PraxisOS. Skriv dansk SOAP-journal (S,O,A,P) som JSON-objekt med nøglerne S,O,A,P. Markér observation vs tolkning. Ingen definitive diagnoser uden forbehold. Kort og klinisk.",
            },
            {
              role: "user",
              content: `Klient: ${input.clientName}\nYdelse: ${input.service}\nTranscript:\n${input.transcript.slice(0, 6000)}`,
            },
          ],
        }),
      });
      const raw: any = await res.json().catch(() => null);
      const text = raw?.choices?.[0]?.message?.content;
      if (res.ok && text) {
        const parsed = JSON.parse(text);
        return {
          S: String(parsed.S ?? parsed.subjective ?? ""),
          O: String(parsed.O ?? parsed.objective ?? ""),
          A: String(parsed.A ?? parsed.assessment ?? ""),
          P: String(parsed.P ?? parsed.plan ?? ""),
        };
      }
    } catch {
      // fall through to heuristic
    }
  }

  const t = input.transcript.trim();
  const first = input.clientName.split(" ")[0] ?? "Patienten";
  if (!t) {
    const b = { service: input.service, serviceId: input.serviceId, clientName: input.clientName } as Booking;
    return soapForBooking({
      ...b,
      id: "",
      tenant: "bypilar",
      clientId: "",
      clientInitials: "",
      practitioner: "",
      startsAt: new Date().toISOString(),
      durationMin: 45,
      modality: "Klinik",
      status: "completed",
      priceKr: 0,
      paid: true,
      noShowRisk: 0,
      source: "admin",
    });
  }

  return {
    S: `${first} rapporterer: ${t.slice(0, 280)}${t.length > 280 ? "…" : ""}`,
    O: "Klinisk observation baseret på konsultation — afventer behandler-bekræftelse af objektive fund.",
    A: `Vurdering i relation til ${input.service}. AI-udkast — kræver faglig godkendelse.`,
    P: "Plan foreslået ud fra samtalen. Behandler justerer og signerer før journalen låses.",
  };
}

export async function signJournalEntry(
  id: string,
  opts?: { signedBy?: string; soap?: Partial<SoapNote> },
): Promise<JournalEntry> {
  const e = getJournalEntry(id);
  if (!e) throw new Error("journal_not_found");
  if (e.status === "signed") throw new Error("already_signed");

  if (opts?.soap) e.soap = { ...e.soap, ...opts.soap };
  if (!e.soap.S.trim() && !e.soap.O.trim()) {
    throw new Error("soap_empty");
  }

  e.status = "signed";
  e.signedBy = opts?.signedBy?.trim() || e.practitioner || "Behandler";
  e.signedAt = new Date().toISOString();
  e.updatedAt = e.signedAt;
  persist();

  await publishEvent({
    type: "journal.note_signed",
    tenant: e.tenant,
    data: {
      journalId: e.id,
      clientId: e.clientId,
      bookingId: e.bookingId,
      signedBy: e.signedBy,
    },
    source: "journal",
  });

  return e;
}

export function journalStats(tenant = "bypilar") {
  const all = listJournal({ tenant, limit: 200 });
  return {
    total: all.length,
    draft: all.filter((e) => e.status === "draft").length,
    pending: all.filter((e) => e.status === "pending_approval").length,
    signed: all.filter((e) => e.status === "signed").length,
    aiDrafted: all.filter((e) => e.aiDrafted).length,
  };
}

export const statusLabel: Record<JournalStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Kladde", color: "var(--color-faint)", bg: "var(--color-paper-2)" },
  pending_approval: {
    label: "Afventer godkendelse",
    color: "var(--color-amber)",
    bg: "color-mix(in srgb, var(--color-amber) 12%, transparent)",
  },
  signed: {
    label: "Signeret",
    color: "var(--color-signal)",
    bg: "color-mix(in srgb, var(--color-signal) 12%, transparent)",
  },
  amended: {
    label: "Ændret",
    color: "var(--color-accent)",
    bg: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
  },
};
