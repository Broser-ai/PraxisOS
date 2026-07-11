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
    description: "Niels: lyt til konsultations-lyd og generer SOAP-udkast. Returnerer S/O/A/P + foreslåede ICD-10-koder.",
    category: "journal",
    requiresScope: "write:journal",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Optagelses-session-ID" },
        clientId: { type: "string", description: "Klient-ID" },
      },
      required: ["sessionId", "clientId"],
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

  // -------- Physical AI · Foot-scanner (broer til Python-engine) -------- //
  {
    name: "foot_scan.new_session",
    description: "Start ny fod-scan-session for en klient. Returnerer session_id og optageguide.",
    category: "journal",
    requiresScope: "write:journal",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug" },
        clientId: { type: "string", description: "Klient-ID" },
        side: { type: "string", description: "Fod-side", enum: ["L", "R"] },
        source: { type: "string", description: "Optagelseskilde", enum: ["phone_video", "phone_photos", "structured_light", "laser", "pressure_mat"] },
        markerType: { type: "string", description: "Skala-reference", enum: ["a4", "letter", "aruco", "sam_shoe"] },
      },
      required: ["tenant", "clientId", "side"],
    },
    outputSample: { id: "fs_abc123", status: "capturing", frame_count: 0 },
  },
  {
    name: "foot_scan.ingest_video",
    description: "Slice en smartphone-video til keyframes (skarphedsvægtet, IMU-varieret vinkler).",
    category: "journal",
    requiresScope: "write:journal",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session-ID" },
        videoPath: { type: "string", description: "Absolut sti eller signed-upload-url" },
      },
      required: ["sessionId", "videoPath"],
    },
    outputSample: { session_id: "fs_abc123", frames_ingested: 27, total: 27 },
  },
  {
    name: "foot_scan.calibrate_scale",
    description: "Kør A4 / ArUco / SAM-baseret skala-detektion på første frame. Returnerer mm/px.",
    category: "journal",
    requiresScope: "write:journal",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session-ID" },
        markerType: { type: "string", description: "Reference-metode", enum: ["a4", "letter", "aruco", "sam_shoe"] },
      },
      required: ["sessionId"],
    },
    outputSample: { mm_per_px: 0.412, method: "a4_contour", marker_confidence: 0.92 },
  },
  {
    name: "foot_scan.reconstruct_mesh",
    description: "Kør COLMAP + Open3D (eller NeuralMeshing / Gaussian Splat) på keyframes. Returnerer mesh-URI + stats.",
    category: "journal",
    requiresScope: "write:journal",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session-ID" },
        engine: { type: "string", description: "Rekonstruktions-engine", enum: ["colmap+open3d", "neural_meshing", "gaussian_splat", "hybrid"] },
        voxelSizeMm: { type: "number", description: "Voxel-størrelse i mm (default 0.5)" },
        maxPoints: { type: "number", description: "Max punkt-antal (default 400000)" },
        fillHoles: { type: "boolean", description: "Anatomisk hul-udfyldning (default true)" },
      },
      required: ["sessionId"],
    },
    outputSample: {
      session_id: "fs_abc123",
      engine: "colmap+open3d",
      duration_ms: 84321,
      mesh_uri: "file:///var/lib/praxisos/foot-scanner/fs_abc123/mesh.ply",
      stats: { vertex_count: 312487, face_count: 618203, watertight: true, volume_ml: 486.2, bbox_mm: [102, 265, 78] },
    },
  },
  {
    name: "foot_scan.biomechanical_report",
    description: "Analysér 3D-mesh og generer arch-index, hallux valgus, plantar pressure-zoner + kliniske anbefalinger.",
    category: "journal",
    requiresScope: "write:journal",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session-ID" },
      },
      required: ["sessionId"],
    },
    outputSample: {
      arch_type: "low",
      arch_index: 0.28,
      hallux_valgus_deg: 18.4,
      navicular_drop_mm: 8.4,
      recommendations: ["Medial arch-support 8–10 mm", "Metatarsal-pad + toe-splint"],
      icd10_suggestions: ["M20.1", "M21.4"],
    },
  },
  {
    name: "foot_scan.generate_orthotic",
    description: "Emit parametrisk OpenSCAD + STL indlæg tilpasset scanningens biomekanik. Kræver FEATURE_CAD_EXPORT for tenant.",
    category: "journal",
    requiresScope: "write:journal",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session-ID" },
        material: { type: "string", description: "Materiale", enum: ["EVA_shore45", "EVA_shore55", "TPU_95A", "PLA_matte"] },
        archSupportMm: { type: "number", description: "Arch-dome-højde i mm (default 8)" },
        heelCupMm: { type: "number", description: "Hælskål-højde i mm (default 12)" },
        metatarsalPad: { type: "boolean", description: "Metatarsal-pad on/off" },
        heelWedgeDeg: { type: "number", description: "Hælkile i grader (medial +)" },
        forefootWedgeDeg: { type: "number", description: "Forfodskile i grader" },
        topCover: { type: "string", description: "Overside-materiale", enum: ["none", "leather", "poron", "cambrelle"] },
        printStyle: { type: "string", description: "Produktionsmetode", enum: ["fdm", "sla", "cnc_mill", "vacuum_form"] },
      },
      required: ["sessionId"],
    },
    outputSample: {
      stl_uri: "file:///var/lib/praxisos/foot-scanner/fs_abc123/orthotic/fs_abc123_orthotic.stl",
      scad_uri: "file:///var/lib/praxisos/foot-scanner/fs_abc123/orthotic/fs_abc123_orthotic.scad",
      estimated_print_hours: 3.4,
    },
  },
  {
    name: "foot_scan.list_sessions",
    description: "List fod-scan-sessioner for en tenant (og evt. specifik klient).",
    category: "journal",
    requiresScope: "read:clients",
    inputSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant-slug" },
        clientId: { type: "string", description: "Klient-ID (valgfri)" },
      },
      required: ["tenant"],
    },
    outputSample: { count: 3, sessions: [{ id: "fs_abc123", side: "R", status: "ready", frame_count: 27 }] },
  },
  {
    name: "foot_scan.get_session",
    description: "Hent fuld session-status: frames, mesh-uri, report-uri, orthotic-uri.",
    category: "journal",
    requiresScope: "read:clients",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session-ID" },
      },
      required: ["sessionId"],
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
