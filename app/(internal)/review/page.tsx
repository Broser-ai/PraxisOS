import Link from "next/link";
import { B2B_CATEGORIES, B2B_FEATURES } from "@/lib/b2b-catalog";
import { PLANS, formatPlanPrice } from "@/lib/plans";

const startHere = [
  {
    kicker: "1 · Master",
    title: "Denne side",
    desc: "Bookmark dette link. Herfra kan du åbne hele programmet — staff, admin, klinik og B2B-salg.",
    href: "/review",
    badge: "START",
    color: "var(--color-signal)",
  },
  {
    kicker: "2 · Staff",
    title: "Klinik-overblik",
    desc: "Daglig drift: bookinger, belægning, Aria. Det behandlerne ser.",
    href: "/dashboard",
    badge: "PROGRAM",
    color: "var(--color-accent)",
  },
  {
    kicker: "3 · Klinik",
    title: "by Pilar · kunde-flade",
    desc: "White-label: ydelser, booking, klippekort, portal — uden PraxisOS-brand.",
    href: "/t/bypilar",
    badge: "KUNDE",
    color: "var(--color-clay)",
  },
  {
    kicker: "4 · B2B",
    title: "Sælg licens",
    desc: "Funktioner → priser → signup → setup. Det andre fodplejere køber.",
    href: "/funktioner",
    badge: "SALG",
    color: "var(--color-amber)",
  },
  {
    kicker: "5 · Embed",
    title: "Demo · bypilar.dk",
    desc: "Mock af website med booking-modal (én script-linje).",
    href: "/demo/bypilar-website",
    badge: "HEADLESS",
    color: "var(--color-clay)",
  },
  {
    kicker: "6 · Login",
    title: "Log ind (demo)",
    desc: "Adgangskode: demo. Sender dig tilbage hertil efter login.",
    href: "/login",
    badge: "ADGANG",
    color: "var(--color-signal)",
  },
];

const staffModules = [
  { kicker: "Praktiserende", title: "Overblik", href: "/dashboard" },
  { kicker: "Praktiserende", title: "Kalender", href: "/kalender" },
  { kicker: "Praktiserende", title: "Klienter", href: "/klienter" },
  { kicker: "Praktiserende", title: "Bookings", href: "/bookings" },
  { kicker: "Klinisk AI", title: "AR/CV-journal", href: "/klienter/mette" },
  { kicker: "Klinisk AI", title: "AI Scribe", href: "/scribe" },
  { kicker: "Klinisk AI", title: "Aria · agent", href: "/agent" },
  { kicker: "Klinisk AI", title: "Samlet chat", href: "/chat" },
  { kicker: "Physical AI", title: "Fod-scan · rapport", href: "/scan" },
  { kicker: "Physical AI", title: "Fod-scan · live", href: "/scan/start" },
  { kicker: "Drift", title: "Felt-service", href: "/felt" },
  { kicker: "Drift", title: "Indstillinger", href: "/indstillinger" },
];

const clinicSurfaces = [
  { title: "by Pilar · forsiden", href: "/t/bypilar", desc: "Ydelser + book" },
  { title: "Book tid", href: "/t/bypilar/book", desc: "Online booking-flow" },
  { title: "Klippekort", href: "/t/bypilar/klippekort", desc: "Køb/brug klip" },
  { title: "Gavekort", href: "/t/bypilar/gavekort", desc: "Gavekort-køb" },
  { title: "Min side · portal", href: "/t/bypilar/portal", desc: "Patient-login (MitID-demo)" },
  { title: "Bliv kunde", href: "/t/bypilar/onboarding", desc: "Ny klient-onboarding" },
  { title: "Nordlys · andet brand", href: "/t/nordlys", desc: "Multi-tenant bevis" },
  { title: "Embed-demo", href: "/demo/bypilar-website", desc: "Website + modal" },
];

const admin = [
  { title: "Tenants", href: "/admin/tenants", desc: "Multi-tenant control plane" },
  { title: "Ny tenant", href: "/admin/new-tenant", desc: "Onboarding-wizard" },
  { title: "Ydelses-katalog", href: "/admin/services", desc: "Rediger ydelser pr. tenant" },
  { title: "Behandlere", href: "/admin/staff", desc: "Staff, roller, vagter" },
  { title: "Plan & fakturering", href: "/admin/plan", desc: "License + invoices" },
  { title: "PraxisOS Pay", href: "/admin/payments", desc: "Pay-engine · risk · settlement" },
  { title: "Klippekort & gavekort", href: "/admin/vouchers", desc: "Voucher-katalog" },
  { title: "Tilskudsordninger", href: "/admin/subsidies", desc: "Sygesikring / kommunal / forsikring" },
  { title: "Indberetning", href: "/admin/reporting", desc: "EDI · MedCom · KOMBIT" },
  { title: "Universal API", href: "/admin/api", desc: "Keys, endpoints, webhooks" },
  { title: "Sikkerhed & adgang", href: "/admin/security", desc: "Sessioner, audit, brute-force" },
  { title: "NemSMS", href: "/admin/nemsms", desc: "Officiel sundheds-SMS" },
  { title: "Agent-team", href: "/admin/agents", desc: "9 humaniserede AI-agenter" },
  { title: "Sundhed.dk", href: "/admin/sundhed-dk", desc: "SSO + FMK-bro" },
  { title: "MedCom", href: "/admin/medcom", desc: "Henvisninger & epikriser" },
  { title: "MCP-server", href: "/admin/mcp", desc: "Cursor/Claude tools" },
  { title: "Niels pipeline", href: "/admin/agents/niels/pipeline", desc: "Audio → SOAP → ICD-10" },
  { title: "Sigrid-engine", href: "/admin/agents/sigrid/engine", desc: "Tilskuds-pipeline" },
  { title: "Frej-engine", href: "/admin/agents/frej/engine", desc: "Compliance-pipeline" },
  { title: "Marketplace", href: "/admin/marketplace", desc: "Modulær prismodel" },
  { title: "DK Data", href: "/admin/dk-data", desc: "DAWA / MitID / CPR / CVR" },
  { title: "Database", href: "/admin/database", desc: "Supabase EU · RLS" },
  { title: "System-status", href: "/admin/health", desc: "Go-live checklist" },
  { title: "Integration · bypilar", href: "/admin/integration/bypilar", desc: "Dev-docs til klinik" },
];

const b2bSales = [
  { title: "Landing", href: "/", desc: "PraxisOS B2B-forside (på platform-host)" },
  { title: "Funktioner", href: "/funktioner", desc: "Fuldt katalog med live-links" },
  { title: "Priser", href: "/pricing", desc: "Starter → Clinic" },
  { title: "Signup · Practice", href: "/signup?plan=practice", desc: "CVR → plan → tenant" },
  { title: "Om", href: "/about", desc: "Platform-historie" },
];

const api = [
  { method: "GET", path: "/api/v1/bypilar/services", desc: "Ydelser" },
  { method: "GET", path: "/api/v1/bypilar/availability?service=fod-med&days=5", desc: "Ledige tider" },
  { method: "POST", path: "/api/v1/bypilar/bookings", desc: "Opret booking" },
  { method: "GET", path: "/embed/v1/bypilar", desc: "Embed-snippet" },
];

export default function Review() {
  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise rounded-[16px] border border-ink/15 bg-ink px-6 py-7 text-paper md:px-8">
        <div className="kicker !text-paper/55">Dit master-link · bookmark denne side</div>
        <h1 className="display mt-2 text-[34px] font-semibold leading-[1.05] md:text-[42px]">
          PraxisOS — tjek ALT herfra.
        </h1>
        <p className="mt-3 max-w-[640px] text-[14.5px] text-paper/75">
          Åbn programmet, klinik-fladen, admin og B2B-salg fra ét sted. Login med e-mail + adgangskode{" "}
          <span className="mono text-paper">demo</span>.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-[10px] bg-paper px-4 py-2.5 text-[13px] font-medium text-ink hover:opacity-90"
          >
            Åbn programmet →
          </Link>
          <Link
            href="/admin/packaging"
            className="rounded-[10px] border border-paper/30 px-4 py-2.5 text-[13px] font-medium text-paper hover:bg-paper/10"
          >
            Produktpakke · udkast
          </Link>
          <Link
            href="/funktioner"
            className="rounded-[10px] border border-paper/30 px-4 py-2.5 text-[13px] font-medium text-paper hover:bg-paper/10"
          >
            Alle funktioner
          </Link>
          <Link
            href="/login"
            className="rounded-[10px] border border-paper/30 px-4 py-2.5 text-[13px] font-medium text-paper hover:bg-paper/10"
          >
            Log ind
          </Link>
          <code className="hidden items-center rounded-[10px] border border-paper/20 px-3 py-2.5 mono text-[11px] text-paper/70 sm:inline-flex">
            /review
          </code>
        </div>
      </div>

      <div className="mt-9">
        <div className="kicker mb-3">Start her · 6 genveje</div>
        <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {startHere.map((s) => (
            <Link
              key={s.href + s.title}
              href={s.href}
              target={s.href.startsWith("/demo") || s.href.startsWith("/t/") ? "_blank" : undefined}
              className="card group flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-ink"
            >
              <div className="flex items-center justify-between">
                <span className="kicker !text-[9.5px]" style={{ color: s.color }}>
                  {s.kicker}
                </span>
                <span className="chip mono !text-[9.5px]">{s.badge}</span>
              </div>
              <h3 className="display text-[18px] font-semibold leading-tight">{s.title}</h3>
              <p className="text-[12.5px] leading-relaxed text-muted">{s.desc}</p>
              <div className="mt-auto flex items-center gap-1.5 text-[12px] font-medium" style={{ color: s.color }}>
                Åbn
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform group-hover:translate-x-0.5">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="kicker">Alle funktioner · klik og se live</div>
          <Link href="/funktioner" className="text-[12px] font-medium text-ink underline-offset-2 hover:underline">
            Åbn funktioner-katalog →
          </Link>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {B2B_CATEGORIES.map((c) => (
            <span key={c.id} className="chip mono !text-[9.5px]">
              {c.label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {B2B_FEATURES.map((f) => (
            <Link
              key={f.slug}
              href={f.demoHref}
              className="rounded-[12px] border border-line bg-card p-3.5 transition-colors hover:border-ink/30 hover:bg-paper-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13.5px] font-semibold leading-tight">{f.title}</div>
                <span
                  className={`chip mono !text-[9px] ${
                    f.status === "live" ? "!border-signal/30 text-signal" : "!border-amber/30 text-amber"
                  }`}
                >
                  {f.status === "live" ? "live" : "proto"}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11.5px] text-muted">{f.summary}</p>
              <div className="mt-2 mono text-[10px] text-faint">{f.demoHref}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="kicker mb-3">B2B-salg · licens til andre klinikker</div>
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {PLANS.map((p) => (
            <Link
              key={p.id}
              href={`/signup?plan=${p.id}`}
              className="rounded-[12px] border border-line bg-card p-3 transition-colors hover:border-ink/30"
            >
              <div className="text-[13px] font-semibold">{p.name}</div>
              <div className="mt-1 text-[15px] font-semibold">
                {formatPlanPrice(p)}
                <span className="text-[11px] font-normal text-muted">/md</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          {b2bSales.map((a) => (
            <Link key={a.href} href={a.href} className="rounded-[12px] border border-line bg-card p-3.5 transition-colors hover:bg-paper-2">
              <div className="text-[13.5px] font-semibold">{a.title}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">{a.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="kicker mb-3">Klinik-flader · white-label</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          {clinicSurfaces.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              target="_blank"
              className="rounded-[12px] border border-line bg-card p-3.5 transition-colors hover:bg-paper-2"
            >
              <div className="text-[13.5px] font-semibold">{a.title}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">{a.desc}</div>
              <div className="mt-1 mono text-[10px] text-faint">{a.href}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="kicker mb-3">Staff-UI · det daglige program</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {staffModules.map((m) => (
            <Link key={m.href} href={m.href} className="rounded-[12px] border border-line bg-card p-3 transition-colors hover:bg-paper-2">
              <div className="kicker !text-[9px]">{m.kicker}</div>
              <div className="mt-1 text-[13px] font-semibold leading-tight">{m.title}</div>
              <div className="mt-1 mono text-[10px] text-faint">{m.href}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="kicker mb-3">Admin · control plane</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {admin.map((a) => (
            <Link key={a.href} href={a.href} className="rounded-[12px] border border-line bg-card p-3.5 transition-colors hover:bg-paper-2">
              <div className="text-[13.5px] font-semibold">{a.title}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">{a.desc}</div>
              <div className="mt-1 mono text-[10px] text-faint">{a.href}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="kicker mb-3">API · klar til klinik-website</div>
        <div className="card overflow-hidden">
          {api.map((a, i) => (
            <a
              key={a.path}
              href={a.path}
              target="_blank"
              className={`flex items-center gap-3 border-line px-5 py-3 transition-colors hover:bg-paper-2 ${i > 0 ? "border-t" : ""}`}
            >
              <span
                className="mono w-12 shrink-0 rounded-[6px] px-2 py-0.5 text-center text-[10.5px] font-semibold"
                style={{
                  background:
                    a.method === "GET"
                      ? "color-mix(in srgb, var(--color-signal) 14%, transparent)"
                      : "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                  color: a.method === "GET" ? "var(--color-signal)" : "var(--color-accent)",
                }}
              >
                {a.method}
              </span>
              <span className="mono flex-1 text-[12.5px]">{a.path}</span>
              <span className="hidden text-[12px] text-faint md:inline">{a.desc}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-faint">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          ))}
        </div>
      </div>

      <div className="mt-10 rounded-[12px] border border-line bg-paper-2/60 p-5 text-[13px] text-ink-soft">
        <div className="kicker">Bookmark</div>
        <p className="mt-2 max-w-[760px]">
          Brug altid <strong className="text-ink">https://app.bypilar.dk/review</strong> som indgang til at
          gennemgå hele PraxisOS. Forsiden `/` er klinik/B2B afhængig af host — denne side er din samlede menu.
        </p>
      </div>
    </div>
  );
}
