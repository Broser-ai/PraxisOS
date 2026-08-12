import Link from "next/link";

const tour = [
  { kicker: "1 · Start her", title: "Demo · Bypilar.dk med embed", desc: "Mock af bypilar.dk hvor PraxisOS er indsat med én script-linje. Klik «Book» → modal åbner.", href: "/demo/bypilar-website", badge: "MODE A · HEADLESS", color: "var(--color-clay)" },
  { kicker: "2 · Full white-label", title: "Tenant-frontend · /t/bypilar", desc: "Den fulde hostede frontend under bypilar's brand. Hvis kunden ikke vil have eget site.", href: "/t/bypilar", badge: "MODE B · WHITE-LABEL", color: "var(--color-accent)" },
  { kicker: "3 · Patient-portal", title: "Min side · som kunden ser den", desc: "Mette logger ind med MitID og ser sin næste tid, progression, journal og kontakt.", href: "/t/bypilar/portal", badge: "PATIENT-UI", color: "var(--color-signal)" },
  { kicker: "4 · Multi-tenant", title: "Samme kode, andet brand · Nordlys", desc: "Beviser at platformen kan sælges til mange klinikker på én installation.", href: "/t/nordlys", badge: "TENANT 2", color: "var(--color-accent)" },
  { kicker: "5 · Control plane", title: "Tenants · license-matrix", desc: "Operatør-view. Klik et låst modul → upgrade-dialog dukker op.", href: "/admin/tenants", badge: "OPERATØR", color: "var(--color-signal)" },
  { kicker: "6 · API-guide", title: "Integration · bypilar", desc: "Tre integrations-niveauer (snippet, JS, REST) — det vi sender til bypilar's udvikler.", href: "/admin/integration/bypilar", badge: "DEV-DOCS", color: "var(--color-amber)" },
];

const modules = [
  { kicker: "Praktiserende", title: "Overblik", href: "/dashboard" },
  { kicker: "Praktiserende", title: "Kalender", href: "/kalender" },
  { kicker: "Praktiserende", title: "Klienter", href: "/klienter" },
  { kicker: "Praktiserende", title: "Bookings", href: "/bookings" },
  { kicker: "Klinisk AI", title: "AR/CV-journal", href: "/klienter/mette" },
  { kicker: "Klinisk AI", title: "AI Scribe", href: "/scribe" },
  { kicker: "Klinisk AI", title: "Aria · agent", href: "/agent" },
  { kicker: "Physical AI", title: "Fod-scan · rapport", href: "/scan" },
  { kicker: "Physical AI", title: "Fod-scan · live", href: "/scan/start" },
  { kicker: "Drift", title: "Felt-service", href: "/felt" },
];

const admin = [
  { title: "Tenants", href: "/admin/tenants", desc: "Multi-tenant control plane" },
  { title: "Ydelses-katalog", href: "/admin/services", desc: "Rediger ydelser pr. tenant" },
  { title: "Behandlere", href: "/admin/staff", desc: "Staff-mgmt, roller, vagter" },
  { title: "Plan & fakturering", href: "/admin/plan", desc: "License + invoices" },
  { title: "PraxisOS Pay", href: "/admin/payments", desc: "Egen pay-engine · risk · trust · settlement" },
  { title: "Klippekort & gavekort", href: "/admin/vouchers", desc: "Voucher-katalog + balance-tracking" },
  { title: "Webshop-produkter", href: "/admin/products", desc: "Creme · udstyr · B2B engros + forbruger" },
  { title: "Tilskudsordninger", href: "/admin/subsidies", desc: "Sygesikring, kommunal støtte, forsikring" },
  { title: "Indberetning", href: "/admin/reporting", desc: "EDI · MedCom XML · KOMBIT API" },
  { title: "Universal API", href: "/admin/api", desc: "API-keys, endpoints, webhooks, SDK-eksempler" },
  { title: "Sikkerhed & adgang", href: "/admin/security", desc: "Sessioner, login-forsøg, audit-log, brute-force" },
  { title: "NemSMS", href: "/admin/nemsms", desc: "Officiel sundheds-SMS · KOMBIT-godkendt afsender · 1.843 borgere" },
  { title: "Agent-team · 9 agenter", href: "/admin/agents", desc: "Aria, Niels, Sigrid, Magnus, Frej, Vega, Bjørn, Liv, Atlas — humaniserede AI-agenter" },
  { title: "Samlet chat", href: "/chat", desc: "Skriv en besked og bliv routed til den rette agent automatisk" },
  { title: "Sundhed.dk · federation", href: "/admin/sundhed-dk", desc: "SSO + FMK-bro · trustaftale i gang" },
  { title: "MedCom", href: "/admin/medcom", desc: "Henvisninger, epikriser, afregning · Sundhedsdatanettet" },
  { title: "MCP-server", href: "/admin/mcp", desc: "Claude Code & Cursor kan styre PraxisOS · 19 tools eksponeret" },
  { title: "Niels pipeline · deep dive", href: "/admin/agents/niels/pipeline", desc: "Audio → transkription → NER → SOAP → ICD-10 · ende-til-ende-flow" },
  { title: "Sigrid · tilskuds-engine", href: "/admin/agents/sigrid/engine", desc: "9-trins · lookup → eligibility → EDI/KOMBIT → ack → settlement" },
  { title: "Module Marketplace", href: "/admin/marketplace", desc: "20+ moduler · modulær prismodel · prøveperiode · klinikker vælger selv" },
  { title: "DK Data · DAWA/MitID/CPR/CVR", href: "/admin/dk-data", desc: "Alle DK-offentlige data-integrationer · 8 kilder · juridisk grundlag" },
  { title: "Database · Supabase EU", href: "/admin/database", desc: "18 tabeller · RLS multi-tenant · pgvector · 4 migrations · klar til Postgres" },
  { title: "Frej · compliance-engine", href: "/admin/agents/frej/engine", desc: "8-trins sikkerheds-pipeline · 4 scenarier · PraxisRisk + Trust + anomaly" },
  { title: "Modul-aktiverings-wizard", href: "/admin/marketplace/ai-niels/activate", desc: "5-trins flow · afhængigheder · konfiguration · prøveperiode" },
  { title: "Ny tenant", href: "/admin/new-tenant", desc: "Onboarding-wizard" },
  { title: "Integration · bypilar", href: "/admin/integration/bypilar", desc: "Dev-docs" },
  { title: "Indstillinger", href: "/indstillinger", desc: "Connectors + compliance" },
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
      <div className="rise">
        <div className="kicker flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
          </span>
          Localhost · alt bygget færdigt · {new Date().toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}
        </div>
        <h1 className="display mt-3 text-[42px] font-semibold leading-[1.05]" style={{ maxWidth: 760 }}>
          PraxisOS — komplet review.
        </h1>
        <p className="mt-3 max-w-[640px] text-[15px] text-muted">
          Native udkast af et komplet klinisk operativsystem. Multi-tenant fra dag ét — kan både være
          backend for bypilar.dk og sælges separat som white-label software.
          Tryk <kbd className="rounded-[5px] border border-line-2 bg-paper-2 px-1.5 py-0.5 mono text-[10px]">⌘K</kbd> for søg.
        </p>
      </div>

      <div className="mt-9">
        <div className="kicker mb-3">6 ting du skal klikke gennem</div>
        <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tour.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              target={s.href.startsWith("/demo") || s.href.startsWith("/t/") ? "_blank" : undefined}
              className="card group flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-ink"
            >
              <div className="flex items-center justify-between">
                <span className="kicker !text-[9.5px]" style={{ color: s.color }}>{s.kicker}</span>
                <span className="chip mono !text-[9.5px]">{s.badge}</span>
              </div>
              <h3 className="display text-[18px] font-semibold leading-tight">{s.title}</h3>
              <p className="text-[12.5px] leading-relaxed text-muted">{s.desc}</p>
              <div className="mt-auto flex items-center gap-1.5 text-[12px] font-medium" style={{ color: s.color }}>
                Åbn
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="kicker mb-3">10 interne moduler · staff-UI</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="rounded-[12px] border border-line bg-card p-3 transition-colors hover:bg-paper-2">
              <div className="kicker !text-[9px]">{m.kicker}</div>
              <div className="mt-1 text-[13px] font-semibold leading-tight">{m.title}</div>
              <div className="mt-1 mono text-[10px] text-faint">{m.href}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="kicker mb-3">7 admin-sider · control plane</div>
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
        <div className="kicker mb-3">API-endpoints · klar til bypilar.dk</div>
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
                  background: a.method === "GET" ? "color-mix(in srgb, var(--color-signal) 14%, transparent)" : "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                  color: a.method === "GET" ? "var(--color-signal)" : "var(--color-accent)",
                }}
              >
                {a.method}
              </span>
              <span className="mono flex-1 text-[12.5px]">{a.path}</span>
              <span className="hidden text-[12px] text-faint md:inline">{a.desc}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-faint"><path d="M7 17L17 7M9 7h8v8"/></svg>
            </a>
          ))}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["13", "moduler bygget"], ["25+", "ruter live"], ["2", "seedede tenants"], ["3", "integrations-niveauer"]].map(([n, l]) => (
          <div key={n as string} className="card p-4">
            <div className="display text-[28px] font-semibold leading-none">{n}</div>
            <div className="mt-1.5 text-[11.5px] text-muted">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-[12px] border border-line bg-paper-2/60 p-5 text-[13px] text-ink-soft">
        <div className="kicker">Klar til Supabase</div>
        <p className="mt-2 max-w-[760px]">
          UI'et er nu komplet. Næste skridt er at koble på Supabase EU så data persisteres — datamodellen
          er allerede defineret i <code>02-arkitektur-og-byggeplan.md</code>.
        </p>
      </div>
    </div>
  );
}
