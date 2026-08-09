import Link from "next/link";
import { DB_MODE, currentConfig } from "@/lib/supabase";

type Status = "live" | "stub" | "pending" | "down";

const INTEGRATIONS: { name: string; modul: string; status: Status; note: string; href?: string }[] = [
  { name: "Next.js · App Router", modul: "next 16.2.12", status: "live", note: "60 pages + 15 API · build ✓" },
  { name: "Database · Postgres", modul: `Supabase · ${DB_MODE}`, status: DB_MODE === "mock" ? "stub" : "live", note: currentConfig.region, href: "/admin/database" },
  { name: "Row-Level Security", modul: "16/18 tables", status: "live", note: "tenant_isolation enforced" },
  { name: "MitID OIDC", modul: "Signaturgruppen broker", status: "stub", note: "afventer trust-aftale", href: "/login/mitid?mode=patient" },
  { name: "DAWA · adresser", modul: "api.dataforsyningen.dk", status: "live", note: "public · ingen API-key", href: "/admin/dk-data" },
  { name: "CVR · Erhvervsstyrelsen", modul: "cvrapi.dk + cache", status: "live", note: "1000 lookups/dag · 7 dages cache", href: "/admin/dk-data" },
  { name: "Sundhed.dk · FMK", modul: "NSP-bro", status: "pending", note: "trustaftale · 6 uger", href: "/admin/sundhed-dk" },
  { name: "MedCom · EDI", modul: "VANS-routing", status: "stub", note: "EAN + VANS-aftale", href: "/admin/medcom" },
  { name: "Bird.com SMS", modul: "lib/bird + /admin/bird", status: "live", note: "self-host · kræver BIRD_API_KEY", href: "/admin/bird" },
  { name: "NemSMS", modul: "KOMBIT", status: "stub", note: "parkér · Bird i stedet", href: "/admin/nemsms" },
  { name: "Sygesikringen danmark", modul: "EDIFACT D04A", status: "stub", note: "webservice-aftale" },
  { name: "PraxisOS Pay", modul: "egen-built", status: "live", note: "9 metoder · PraxisRisk + Trust 2", href: "/admin/payments" },
  { name: "AI · Aria/Niels/Sigrid", modul: "9 humaniserede agenter", status: "live", note: "mock-svar · OpenAI key for prod", href: "/admin/agents" },
  { name: "MCP-server", modul: "JSON-RPC 2.0", status: "live", note: "19 tools eksponeret", href: "/admin/mcp" },
  { name: "Modul-marketplace", modul: "20 moduler · 7 kategorier", status: "live", note: "aktivering ✓", href: "/admin/marketplace" },
];

export default function HealthPage() {
  const live = INTEGRATIONS.filter((i) => i.status === "live").length;
  const total = INTEGRATIONS.length;
  const score = Math.round((live / total) * 100);

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Admin</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">System-status</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Live-overblik over alle integrationer · go-live checklist for kommerciel lancering.
          </p>
        </div>
        <span className="chip mono !text-[11px] !border-signal/40 text-signal">
          ● {score}% live · {live}/{total}
        </span>
      </div>

      {/* Stats */}
      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Live integrationer" value={live.toString()} color="var(--color-signal)" />
        <Stat label="Stub · klar til kobling" value={INTEGRATIONS.filter((i) => i.status === "stub").length.toString()} color="var(--color-amber)" />
        <Stat label="Pending · afventer aftale" value={INTEGRATIONS.filter((i) => i.status === "pending").length.toString()} />
        <Stat label="Build-status" value="✓ Compiled" color="var(--color-signal)" sub="75 routes · TypeScript OK" />
      </div>

      {/* Integrations */}
      <section className="card rise mt-3 p-5">
        <h2 className="display text-[17px] font-semibold">Integrationer</h2>
        <div className="mt-4 flex flex-col">
          {INTEGRATIONS.map((i) => (
            <div key={i.name} className="grid grid-cols-[16px_1fr_180px_180px_60px] items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 text-[13px]">
              <span className={`h-2 w-2 rounded-full ${
                i.status === "live" ? "bg-signal" :
                i.status === "stub" ? "bg-amber" :
                i.status === "pending" ? "bg-clay" : "bg-faint"
              }`} />
              <span className="font-medium">{i.name}</span>
              <span className="mono text-[11px] text-faint">{i.modul}</span>
              <span className="text-[11.5px] text-muted">{i.note}</span>
              <span className="text-right">
                {i.href ? (
                  <Link href={i.href} className="text-[11px] text-clay hover:underline">se →</Link>
                ) : (
                  <span className="kicker !text-[9px]">—</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Go-live checklist */}
      <section className="card rise mt-3 p-5">
        <h2 className="display text-[17px] font-semibold">Go-live checklist</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Rækkefølge anbefalet — DAWA og CVR kører nu · MitID + MedCom afventer ekstern onboarding.
        </p>
        <div className="mt-4 flex flex-col gap-1.5">
          {CHECKLIST.map((c) => (
            <div key={c.label} className="grid grid-cols-[20px_1fr_120px] gap-3 rounded-[8px] border border-line bg-paper p-2.5 text-[12.5px]">
              <span className={`grid h-4 w-4 place-items-center rounded-full ${c.done ? "bg-signal/20 text-signal" : "bg-paper-2 text-faint"} text-[9px]`}>
                {c.done ? "✓" : "○"}
              </span>
              <span className={c.done ? "" : "text-muted"}>{c.label}</span>
              <span className="mono text-[10px] text-right text-faint">{c.eta}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Trial */}
      <section className="card rise mt-3 border-amber/30 bg-amber/[0.05] p-5">
        <div className="kicker text-amber">Trial-kunder</div>
        <h2 className="display mt-1 text-[17px] font-semibold">by Pilar kører gratis</h2>
        <p className="mt-2 text-[12.5px] text-muted">
          By Pilar (CVR 43947079) er markeret som <code className="mono">trial.unlimited</code> i <code className="mono">lib/tenants.ts</code>.
          Det giver alle moduler aktive · 0 platform-fee · ingen tidsbegrænsning.
          Fjern <code className="mono">trial</code>-blokken når pilot-perioden slutter.
        </p>
      </section>
    </div>
  );
}

const CHECKLIST: { label: string; done: boolean; eta: string }[] = [
  { label: "Build clean · TypeScript pass", done: true, eta: "✓" },
  { label: "Multi-tenant · RLS verificeret", done: true, eta: "✓" },
  { label: "Public landing · /pricing · /signup", done: true, eta: "✓" },
  { label: "404 + error pages", done: true, eta: "✓" },
  { label: "By Pilar trial-flag aktivt", done: true, eta: "✓" },
  { label: "Supabase EU projekt oprettet", done: false, eta: "1 dag" },
  { label: "Migrations pushet til prod", done: false, eta: "1 dag" },
  { label: "Vercel deploy · domæne", done: false, eta: "1 dag" },
  { label: "MitID broker · client_id", done: false, eta: "2 uger" },
  { label: "Trustaftale m. Sundhedsdatastyrelsen", done: false, eta: "6 uger" },
  { label: "MedCom EAN + VANS-aftale", done: false, eta: "8 uger" },
  { label: "Pen-test + ISO 27001-light", done: false, eta: "4 uger" },
  { label: "DPA-skabelon klar til signering", done: false, eta: "1 uge" },
];

function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="card p-3" style={color ? { borderColor: color, background: `color-mix(in srgb, ${color} 5%, var(--color-card))` } : {}}>
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-1 display text-[22px] font-semibold leading-none" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="mono text-[10px] text-faint">{sub}</div>}
    </div>
  );
}
