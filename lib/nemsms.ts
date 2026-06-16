// NemSMS · Sundhedsdatanettet/Digitaliseringsstyrelsen
//
// Offentlig SMS-tjeneste til borgere. Modtagelse er gratis for borgeren,
// afsender betaler ~0.50 DKK pr. SMS. Kræver godkendt sender-ID via KOMBIT/MedCom.
//
// For PraxisOS: hver tenant kan registrere en sender-ID og sende NemSMS for:
//  - booking-bekræftelser
//  - påmindelser (24t / 1t før)
//  - aflysninger / ombooking
//  - recept-fornyelser
//  - kritiske sundheds-notifikationer
//
// Borgeren skal eksplicit opt-in pr. tenant (kan til enhver tid trække tilbage på borger.dk).

export type NemSmsCategory =
  | "booking_confirm"
  | "reminder_24h"
  | "reminder_1h"
  | "cancellation"
  | "prescription"
  | "treatment_results"
  | "marketing";       // ikke tilladt under NemSMS — skal være alm. SMS

export type NemSmsTenantConfig = {
  tenant: string;
  enabled: boolean;
  senderId: string;            // godkendt 11-tegns alfanumerisk afsender
  senderIdStatus: "approved" | "pending" | "rejected";
  approvedAt?: string;
  kombitId: string;            // intern KOMBIT-registrerings-ID
  sundhedsdatanettetEnabled: boolean;
  monthlyVolume: number;       // antal sendte sidste 30 dage
  monthlyCapKr: number;        // klinikkens månedlige loft
  costPerSmsOere: number;      // 50 = 0.50 kr
  citizensSubscribed: number;  // antal borgere der har opt-in'et
};

export const NEMSMS_CONFIG: Record<string, NemSmsTenantConfig> = {
  bypilar: {
    tenant: "bypilar",
    enabled: true,
    senderId: "BY PILAR",
    senderIdStatus: "approved",
    approvedAt: "2025-09-12",
    kombitId: "KMD-NSMS-2025-87341",
    sundhedsdatanettetEnabled: true,
    monthlyVolume: 287,
    monthlyCapKr: 500,
    costPerSmsOere: 50,
    citizensSubscribed: 1843,
  },
  nordlys: {
    tenant: "nordlys",
    enabled: false,
    senderId: "NORDLYS",
    senderIdStatus: "pending",
    kombitId: "KMD-NSMS-2026-00112",
    sundhedsdatanettetEnabled: false,
    monthlyVolume: 0,
    monthlyCapKr: 1000,
    costPerSmsOere: 50,
    citizensSubscribed: 0,
  },
};

// Message-templates pr. kategori
export const NEMSMS_TEMPLATES: Record<NemSmsCategory, { title: string; body: string; allowed: boolean }> = {
  booking_confirm: {
    title: "Booking bekræftet",
    body: "Hej {name}. Din tid hos {clinic} er bekræftet: {date} kl. {time}, {service}. Tilskud er beregnet automatisk. Se kvittering: {link}",
    allowed: true,
  },
  reminder_24h: {
    title: "Påmindelse · i morgen",
    body: "Hej {name}. Husk din tid hos {clinic} i morgen kl. {time}. Brug for at ombooke? {link}",
    allowed: true,
  },
  reminder_1h: {
    title: "Påmindelse · om 1 time",
    body: "Din tid hos {clinic} starter om 1 time, kl. {time}. Vi ses i {address}.",
    allowed: true,
  },
  cancellation: {
    title: "Aflysning",
    body: "Hej {name}. Vi har aflyst din tid {date} kl. {time}. Find ny tid her: {link}",
    allowed: true,
  },
  prescription: {
    title: "Recept klar",
    body: "Din recept fra {clinic} er klar på apoteket. Gyldig til {expiresAt}.",
    allowed: true,
  },
  treatment_results: {
    title: "Resultater klar",
    body: "Resultater fra din behandling hos {clinic} er klar at se på Min Side: {link}",
    allowed: true,
  },
  marketing: {
    title: "Marketing (kun via alm. SMS)",
    body: "—",
    allowed: false,   // NemSMS må ikke bruges til marketing
  },
};

// Borgerens opt-in-status pr. kategori (default-værdier ved første gang)
export const DEFAULT_OPT_IN: Record<NemSmsCategory, boolean> = {
  booking_confirm: true,
  reminder_24h: true,
  reminder_1h: false,    // mange foretrækker e-mail/push i stedet
  cancellation: true,
  prescription: true,
  treatment_results: true,
  marketing: false,
};

// Mock sendte NemSMS — til admin-konsol
export type NemSmsLog = {
  id: string;
  tenant: string;
  category: NemSmsCategory;
  to: string;            // maskeret CPR
  recipientName: string;
  bookingId?: string;
  sentAt: string;
  status: "queued" | "sent" | "delivered" | "failed";
  costOere: number;
  errorCode?: string;
};

const t = (offset: number) => new Date(Date.now() - offset * 1000).toISOString();

export const nemsmsLog: NemSmsLog[] = [
  { id: "nsms_001", tenant: "bypilar", category: "booking_confirm", to: "********-1024", recipientName: "Mette L.",  bookingId: "bk_a1", sentAt: t(60),   status: "delivered", costOere: 50 },
  { id: "nsms_002", tenant: "bypilar", category: "reminder_24h",    to: "********-3309", recipientName: "Per S.",    bookingId: "bk_a4", sentAt: t(600),  status: "delivered", costOere: 50 },
  { id: "nsms_003", tenant: "bypilar", category: "booking_confirm", to: "********-2841", recipientName: "Amira H.",  bookingId: "bk_a3", sentAt: t(1800), status: "delivered", costOere: 50 },
  { id: "nsms_004", tenant: "bypilar", category: "treatment_results", to: "********-1024", recipientName: "Mette L.",                  sentAt: t(7200), status: "delivered", costOere: 50 },
  { id: "nsms_005", tenant: "bypilar", category: "reminder_24h",    to: "********-1456", recipientName: "Clara W.",  bookingId: "bk_a5", sentAt: t(86400), status: "delivered", costOere: 50 },
  { id: "nsms_006", tenant: "bypilar", category: "cancellation",    to: "********-2841", recipientName: "Amira H.",  bookingId: "bk_p5", sentAt: t(172800), status: "delivered", costOere: 50 },
  { id: "nsms_007", tenant: "bypilar", category: "booking_confirm", to: "********-9001", recipientName: "Test User", sentAt: t(259200), status: "failed", costOere: 0, errorCode: "NSMS-E-204 · borger ikke opt-in" },
];

export const CATEGORY_LABEL: Record<NemSmsCategory, string> = {
  booking_confirm: "Booking-bekræftelse",
  reminder_24h: "Påmindelse · 24t før",
  reminder_1h: "Påmindelse · 1t før",
  cancellation: "Aflysning",
  prescription: "Recept klar",
  treatment_results: "Resultater klar",
  marketing: "Marketing (ikke tilladt)",
};
