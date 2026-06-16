// Indberetning · automatisk rapportering til myndigheder & forsikringsselskaber
//
// Hver gang en behandling med tilskud gennemføres, skal vi indberette:
//   1. Sygesikringen "danmark"  → EDI-format · "danmarkonline.dk" API
//   2. Den offentlige sygesikring → MedCom XML (sygesikringsafregning · "afr01")
//   3. Kommunen                  → JSON / KOMBIT API
//   4. Privat forsikring         → SOAP / REST pr. selskab
//
// PraxisOS gør det automatisk når booking sættes til "completed" + tilskud er valgt.

export type ReportStatus = "queued" | "sending" | "ack_received" | "rejected" | "manual_review";

export type Report = {
  id: string;
  tenant: string;
  bookingId: string;
  clientId: string;
  scheme: string;            // SubsidyScheme
  authority: string;
  format: "EDI_DANMARK" | "MEDCOM" | "KOMMUNAL_API" | "MANUEL" | "FORSIKRING_API";
  amountKr: number;          // tilskuds-beløb
  serviceCode: string;       // ydelseskode pr. myndighed
  status: ReportStatus;
  createdAt: string;
  sentAt?: string;
  ackAt?: string;
  ackReference?: string;     // myndighedens kvittering-id
  errorCode?: string;
  errorMessage?: string;
  payloadPreview?: string;
};

// Service-code mapping pr. ordning
// Hver myndighed har sit eget kode-univers
export const SERVICE_CODE_MAP: Record<string, Record<string, string>> = {
  EDI_DANMARK: {
    "fod-med":  "FP-101",   // fodpleje · medicinsk
    "fod-lux":  "FP-102",
    "fod-scan": "FP-201",   // diagnostisk · sub-mm topologi
  },
  MEDCOM: {
    "fod-med":  "11.91",
    "fod-lux":  "11.92",
    "fod-scan": "13.05",
  },
  KOMMUNAL_API: {
    "fod-med":  "DIA-FOD",  // diabetes-fodpleje
  },
  FORSIKRING_API: {
    "fod-med":  "BEH-FODP-001",
  },
  MANUEL: {},
};

// -----------------------------------------------------------------------------
// SEED · indberetnings-log
// -----------------------------------------------------------------------------

const now = new Date();
const iso = (m: number) => { const d = new Date(now); d.setMinutes(d.getMinutes() - m); return d.toISOString(); };

export const reports: Report[] = [
  {
    id: "rpt_001", tenant: "bypilar", bookingId: "bk_p1", clientId: "mette",
    scheme: "danmark_g1", authority: "Sygeforsikringen \"danmark\"", format: "EDI_DANMARK",
    amountKr: 150, serviceCode: "FP-101", status: "ack_received",
    createdAt: iso(7*60*24), sentAt: iso(7*60*24 - 1), ackAt: iso(7*60*24 - 3),
    ackReference: "DK-ACK-2026-061847",
  },
  {
    id: "rpt_002", tenant: "bypilar", bookingId: "bk_p2", clientId: "per",
    scheme: "diabetes", authority: "Aarhus Kommune · sundhedsforvaltning", format: "KOMMUNAL_API",
    amountKr: 495, serviceCode: "DIA-FOD", status: "ack_received",
    createdAt: iso(7*60*24), sentAt: iso(7*60*24 - 2), ackAt: iso(7*60*24 - 18),
    ackReference: "AAR-2026-DIA-22041",
  },
  {
    id: "rpt_003", tenant: "bypilar", bookingId: "bk_a1", clientId: "mette",
    scheme: "danmark_g1", authority: "Sygeforsikringen \"danmark\"", format: "EDI_DANMARK",
    amountKr: 238, serviceCode: "FP-201", status: "sending",
    createdAt: iso(5), sentAt: iso(3),
  },
  {
    id: "rpt_004", tenant: "bypilar", bookingId: "bk_x9", clientId: "amira",
    scheme: "danmark_g5", authority: "Sygeforsikringen \"danmark\"", format: "EDI_DANMARK",
    amountKr: 200, serviceCode: "FP-101", status: "queued",
    createdAt: iso(1),
  },
  {
    id: "rpt_005", tenant: "bypilar", bookingId: "bk_xa", clientId: "amira",
    scheme: "danmark_g5", authority: "Sygeforsikringen \"danmark\"", format: "EDI_DANMARK",
    amountKr: 200, serviceCode: "FP-101", status: "rejected",
    createdAt: iso(60*24*3), sentAt: iso(60*24*3 - 2), ackAt: iso(60*24*3 - 10),
    errorCode: "DK-E-407", errorMessage: "Medlemskab udløbet 31.05.2026 · ugyldig på behandlingsdato",
  },
];

// -----------------------------------------------------------------------------
// Payload-generator · prototype-version af de faktiske EDI/MedCom-formater
// -----------------------------------------------------------------------------

export function buildPayload(r: Report): string {
  switch (r.format) {
    case "EDI_DANMARK":
      // Sygeforsikringen "danmark" EDI-format (simplificeret)
      return `UNH+1+SYGFO_AFR:01:001:DK'
BGM+340+${r.id}+9'
DTM+137:${r.sentAt ?? new Date().toISOString().slice(0,10).replace(/-/g,"")}:102'
NAD+PR+${r.scheme.toUpperCase()}'
NAD+PT+${r.clientId}'
RFF+ACE:${r.bookingId}'
INV+${r.serviceCode}+1+${r.amountKr.toFixed(2)}+DKK'
UNT+8+1'`;

    case "MEDCOM":
      // MedCom XML standard "afr01"
      return `<?xml version="1.0" encoding="ISO-8859-1"?>
<Letter version="afr01" id="${r.id}">
  <LetterHeader>
    <Sender ean="5790000123456"/>
    <Receiver ean="5790001234567"/>
    <Date>${r.sentAt?.slice(0,10) ?? ""}</Date>
  </LetterHeader>
  <Settlement>
    <PatientReference>${r.clientId}</PatientReference>
    <ServiceCode>${r.serviceCode}</ServiceCode>
    <Amount currency="DKK">${r.amountKr.toFixed(2)}</Amount>
  </Settlement>
</Letter>`;

    case "KOMMUNAL_API":
      return JSON.stringify({
        version: "kombit-v2.1",
        municipality: "Aarhus",
        scheme: r.scheme,
        booking: r.bookingId,
        client_id_masked: "********-" + r.clientId.slice(-4),
        service_code: r.serviceCode,
        amount_kr: r.amountKr,
        signed_by: { ean: "5790000567890", role: "fodterapeut" },
      }, null, 2);

    case "FORSIKRING_API":
      return JSON.stringify({
        insurer: r.authority,
        treatment_code: r.serviceCode,
        amount_kr: r.amountKr,
        booking_ref: r.bookingId,
      }, null, 2);

    default:
      return "(manuel indberetning · ingen automatisk payload)";
  }
}

// -----------------------------------------------------------------------------
// Beregnings-funktioner til admin-side
// -----------------------------------------------------------------------------

export function reportStats(tenant: string) {
  const t = reports.filter((r) => r.tenant === tenant);
  return {
    total: t.length,
    queued: t.filter((r) => r.status === "queued").length,
    sending: t.filter((r) => r.status === "sending").length,
    ack: t.filter((r) => r.status === "ack_received").length,
    rejected: t.filter((r) => r.status === "rejected").length,
    needsAttention: t.filter((r) => r.status === "rejected" || r.status === "manual_review").length,
    totalReimbursedKr: t.filter((r) => r.status === "ack_received").reduce((s, r) => s + r.amountKr, 0),
  };
}

export const STATUS_LABEL: Record<ReportStatus, { label: string; color: string }> = {
  queued:        { label: "I kø",            color: "var(--color-amber)" },
  sending:       { label: "Sender",          color: "var(--color-accent)" },
  ack_received:  { label: "Kvitteret",       color: "var(--color-signal)" },
  rejected:      { label: "Afvist",          color: "var(--color-clay)" },
  manual_review: { label: "Manuel review",   color: "var(--color-clay)" },
};
