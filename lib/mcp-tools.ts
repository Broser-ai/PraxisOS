// MCP tool-definitioner · PraxisOS-platformen eksponeret som tools til Claude Code & andre agenter
//
// Følger Model Context Protocol (modelcontextprotocol.io) — JSON-RPC 2.0 over HTTP.
// Tools er pure-functions med JSON-Schema input/output.

export type McpTool = {
  name: string;
  description: string;
  category: "bookings" | "clients" | "journal" | "subsidies" | "vouchers" | "payments" | "agents" | "admin";
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
  outputSample?: any;
  requiresScope: string;
};

export const MCP_TOOLS: McpTool[] = [
  // Bookings
  {
    name: "list_bookings",
    description: "Liste over bookings for en tenant, filtreret efter status, klient eller datointerval.",
    category: "bookings",
    requiresScope: "read:bookings",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug (fx 'bypilar')" },
        status: { type: "string", description: "Filtrer efter status", enum: ["confirmed", "completed", "pending", "noshow", "cancelled"] },
        clientId: { type: "string", description: "Filtrer efter klient-ID (valgfri)" },
        limit: { type: "number", description: "Maks antal resultater (default: 25)" },
      },
      required: ["tenant"],
    },
    outputSample: { count: 9, bookings: [{ id: "bk_a1", clientName: "Mette L.", service: "Hudanalyse", startsAt: "2026-06-12T14:00:00" }] },
  },
  {
    name: "create_booking",
    description: "Opret en ny booking. Returnerer kvitterings-URL og Aria-bekræftelses-besked.",
    category: "bookings",
    requiresScope: "write:bookings",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug" },
        serviceId: { type: "string", description: "Ydelses-ID (fx 'fod-med')" },
        startsAt: { type: "string", description: "ISO-8601 starttidspunkt" },
        clientName: { type: "string", description: "Klientens navn" },
        clientEmail: { type: "string", description: "Klientens e-mail" },
        clientPhone: { type: "string", description: "Klientens telefon (E.164)" },
        modality: { type: "string", description: "Klinik / Hjemmebesøg / Video", enum: ["Klinik", "Hjemmebesøg", "Video"] },
      },
      required: ["tenant", "serviceId", "startsAt", "clientName", "clientEmail"],
    },
    outputSample: { id: "bk_xxx", status: "confirmed", receiptUrl: "/r/bk_xxx" },
  },
  {
    name: "reschedule_booking",
    description: "Ombook en eksisterende booking til ny tid. Sender automatisk NemSMS-notifikation.",
    category: "bookings",
    requiresScope: "write:bookings",
    inputSchema: {
      type: "object",
      properties: {
        bookingId: { type: "string", description: "Booking-ID" },
        newStartsAt: { type: "string", description: "Nyt ISO-8601 starttidspunkt" },
        reason: { type: "string", description: "Begrundelse (synlig i audit-log)" },
      },
      required: ["bookingId", "newStartsAt"],
    },
  },
  {
    name: "cancel_booking",
    description: "Aflys en booking. Hvis betalingen var pre-authorized, refunderes automatisk.",
    category: "bookings",
    requiresScope: "write:bookings",
    inputSchema: {
      type: "object",
      properties: {
        bookingId: { type: "string", description: "Booking-ID" },
        reason: { type: "string", description: "Begrundelse" },
        refund: { type: "boolean", description: "Refunder betaling (default: true)" },
      },
      required: ["bookingId"],
    },
  },

  // Clients
  {
    name: "list_clients",
    description: "Liste over klienter for en tenant, med søgning og kategori-filter.",
    category: "clients",
    requiresScope: "read:clients",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug" },
        search: { type: "string", description: "Søg på navn eller e-mail" },
        tag: { type: "string", description: "Filter på kategori (Æstetik, Acne, Fodpleje, Sårpleje, Filler)" },
      },
      required: ["tenant"],
    },
  },
  {
    name: "get_client",
    description: "Hent fuld klient-profil inkl. samtykke, forløb, tilskuds-ordninger.",
    category: "clients",
    requiresScope: "read:clients",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Klient-ID" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "create_client",
    description: "Opret ny klient (kræver MitID-verificeret CPR-hash).",
    category: "clients",
    requiresScope: "write:clients",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug" },
        name: { type: "string", description: "Fuldt navn" },
        email: { type: "string", description: "E-mail" },
        phone: { type: "string", description: "Telefon" },
        cprHash: { type: "string", description: "CPR-Match hash" },
        consentLevel: { type: "string", description: "Samtykkeniveau", enum: ["Almindelig", "Sundhedsdata", "Forskning"] },
      },
      required: ["tenant", "name", "email", "cprHash"],
    },
  },

  // Subsidies
  {
    name: "calculate_subsidy",
    description: "Beregn alle berettigede tilskud for en klient + ydelse. Returnerer ordnet liste efter beløb.",
    category: "subsidies",
    requiresScope: "read:subsidies",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Klient-ID" },
        serviceId: { type: "string", description: "Ydelses-ID" },
        servicePriceKr: { type: "number", description: "Pris i kroner" },
      },
      required: ["clientId", "serviceId", "servicePriceKr"],
    },
    outputSample: { best: { scheme: "diabetes", subsidyKr: 495 }, all: [{ scheme: "diabetes", subsidyKr: 495 }] },
  },
  {
    name: "submit_subsidy_report",
    description: "Send tilskuds-indberetning til den relevante myndighed (EDI/MedCom/KOMBIT).",
    category: "subsidies",
    requiresScope: "write:bookings",
    inputSchema: {
      type: "object",
      properties: {
        bookingId: { type: "string", description: "Booking-ID" },
        scheme: { type: "string", description: "Tilskuds-ordning" },
      },
      required: ["bookingId", "scheme"],
    },
  },

  // Vouchers
  {
    name: "list_vouchers",
    description: "Liste klippekort og gavekort for en tenant, valgfri filter på type og status.",
    category: "vouchers",
    requiresScope: "read:vouchers",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug" },
        kind: { type: "string", description: "Type", enum: ["clip", "gift"] },
        status: { type: "string", description: "Status", enum: ["active", "depleted", "expired"] },
      },
      required: ["tenant"],
    },
  },
  {
    name: "validate_voucher",
    description: "Validér en voucher-kode, returnér gyldighed + saldo/sessioner tilbage.",
    category: "vouchers",
    requiresScope: "read:vouchers",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Voucher-kode (CLIP-XXX-XXX eller GIFT-XXX-XXX)" },
        serviceId: { type: "string", description: "Hvilken ydelse skal voucher bruges på" },
      },
      required: ["code"],
    },
  },

  // Journal & scan
  {
    name: "draft_soap_note",
    description: "Niels: skriv SOAP-udkast til journalpost (knyttet til booking hvis angivet). Kræver behandler-godkendelse.",
    category: "journal",
    requiresScope: "write:journal",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Klient-ID" },
        bookingId: { type: "string", description: "Booking-ID (valgfri · knytter journal til behandling)" },
        tenant: { type: "string", description: "Tenant-slug" },
        transcript: { type: "string", description: "Konsultations-transcript eller fritekst" },
        sessionId: { type: "string", description: "Optagelses-session-ID (valgfri)" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "list_journal",
    description: "Liste journalposter for tenant/klient — behandlingsrecords med status.",
    category: "journal",
    requiresScope: "read:journal",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug" },
        clientId: { type: "string", description: "Filtrer på klient" },
        limit: { type: "number", description: "Maks antal (default 25)" },
      },
      required: ["tenant"],
    },
  },
  {
    name: "interpret_foot_scan",
    description: "Niels + Sigrid: tolk fod-scan-data, returnér biomarkers, hallux valgus, plantar pressure-zoner.",
    category: "journal",
    requiresScope: "write:journal",
    inputSchema: {
      type: "object",
      properties: {
        scanId: { type: "string", description: "Scan-ID" },
      },
      required: ["scanId"],
    },
  },

  // Payments
  {
    name: "create_payment_intent",
    description: "Opret betalings-intent · PraxisOS Pay. Returnerer client_secret til Drop-in widget.",
    category: "payments",
    requiresScope: "write:payments",
    inputSchema: {
      type: "object",
      properties: {
        bookingId: { type: "string", description: "Booking-ID" },
        amountKr: { type: "number", description: "Beløb i kroner" },
        method: { type: "string", description: "Foreslået betalingsmetode", enum: ["mobilepay", "card", "klarna"] },
      },
      required: ["bookingId", "amountKr"],
    },
  },
  {
    name: "refund_payment",
    description: "Refunder en betaling helt eller delvist.",
    category: "payments",
    requiresScope: "write:payments",
    inputSchema: {
      type: "object",
      properties: {
        paymentId: { type: "string", description: "Betalings-ID" },
        amountKr: { type: "number", description: "Beløb at refundere (undlad for fuld refusion)" },
        reason: { type: "string", description: "Begrundelse" },
      },
      required: ["paymentId"],
    },
  },

  // Agents
  {
    name: "send_message_via_agent",
    description: "Send en agent-besked til klient. Magnus håndterer marketing-respekt for opt-out.",
    category: "agents",
    requiresScope: "write:bookings",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent-ID", enum: ["aria", "magnus", "liv", "sigrid", "vega"] },
        clientId: { type: "string", description: "Klient-ID" },
        topic: { type: "string", description: "Emne · agenten skriver indholdet selv" },
        channel: { type: "string", description: "Kanal", enum: ["nemsms", "sms", "email", "push", "auto"] },
      },
      required: ["agentId", "clientId", "topic"],
    },
  },
  {
    name: "ask_agent",
    description: "Stil et spørgsmål til en specifik agent og få svar i deres stemme. Auto-router hvis agent-ID udelades.",
    category: "agents",
    requiresScope: "read:bookings",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Spørgsmålet" },
        agentId: { type: "string", description: "Specifik agent (valgfri)" },
      },
      required: ["message"],
    },
  },

  // Admin
  {
    name: "get_tenant_info",
    description: "Hent tenant-info: plan, license, moduler, statistik.",
    category: "admin",
    requiresScope: "read:bookings",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug" },
      },
      required: ["tenant"],
    },
  },
  {
    name: "list_audit_events",
    description: "Frej: hent audit-events for compliance-review. Filtrer på bruger, klient, action-type, tid.",
    category: "admin",
    requiresScope: "read:bookings",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug" },
        clientId: { type: "string", description: "Filter: events for denne klient" },
        userId: { type: "string", description: "Filter: events fra denne bruger" },
        since: { type: "string", description: "ISO-8601 fra-dato" },
      },
      required: ["tenant"],
    },
  },
];

export const TOOL_CATEGORIES = [
  { id: "bookings",  label: "Bookings",   color: "var(--color-accent)" },
  { id: "clients",   label: "Klienter",   color: "var(--color-clay)" },
  { id: "journal",   label: "Journal & scan", color: "var(--color-signal)" },
  { id: "subsidies", label: "Tilskud",    color: "var(--color-amber)" },
  { id: "vouchers",  label: "Vouchers",   color: "var(--color-accent)" },
  { id: "payments",  label: "Betaling",   color: "var(--color-clay)" },
  { id: "agents",    label: "Agenter",    color: "var(--color-signal)" },
  { id: "admin",     label: "Admin",      color: "var(--color-faint)" },
] as const;
