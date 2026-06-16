import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgent, MOOD_COLOR, AGENTS } from "@/lib/agents";

const RECENT_LOG: Record<string, { at: string; lvl: string; msg: string }[]> = {
  aria: [
    { at: "lige nu", lvl: "ok", msg: "Bekræftede Mette L.'s ombooking · torsdag 14:00" },
    { at: "4 min", lvl: "action", msg: "Patient afsluttede chat · score 5/5" },
    { at: "12 min", lvl: "ok", msg: "Sendte tilbud om reserve-tid til 3 patienter på venteliste" },
    { at: "26 min", lvl: "escalate", msg: "Eskalerede til Dr. Krarup · patient spurgte om medicin-konflikt" },
    { at: "1t", lvl: "ok", msg: "Booking #bk_a7 · oprettet via embed · DAWA-verificeret adresse" },
  ],
  niels: [
    { at: "3 min", lvl: "writing", msg: "SOAP-udkast for Mette L. (session 5/8) · 247 ord · venter på review" },
    { at: "1t", lvl: "ok", msg: "Behandler godkendte note · 0 rettelser" },
    { at: "2t", lvl: "writing", msg: "Tolkning af fod-scan #scan_x1 · 6 biomarkers identificeret" },
    { at: "4t", lvl: "ok", msg: "Foreslog ICD-10 L70.0 + L70.8 · begge bekræftet" },
  ],
  sigrid: [
    { at: "12 min", lvl: "ok", msg: "Indberetning til Aarhus Kommune · ack modtaget · 495 kr refunderet" },
    { at: "47 min", lvl: "calc", msg: "Beregnet bedste tilskud for Per S. · valgte Diabetes-tilskud (100% dækning)" },
    { at: "2t", lvl: "ok", msg: "EDI-besked til Sygesikringen «danmark» · 238 kr · sendt" },
    { at: "1d", lvl: "warn", msg: "Sag rpt_005 afvist · medlemskab udløbet · sendt notifikation til klinik" },
  ],
  magnus: [
    { at: "2t", lvl: "ok", msg: "6-måneders recall til 14 klienter · 4 har allerede booket" },
    { at: "5t", lvl: "ok", msg: "Review-anmodning til 8 nyligt behandlede · 5 svar (4.9★ snit)" },
    { at: "1d", lvl: "create", msg: "Skrev kampagne-tekst til 'forberedelse til sommer' · ejer godkendte" },
  ],
  frej: [
    { at: "47 min", lvl: "alert", msg: "Blokerede 6 mislykkede logins fra TOR-exit-node 185.220.101.45" },
    { at: "3t", lvl: "ok", msg: "Skannet 1.247 audit-events · 0 anomalies" },
    { at: "1d", lvl: "warn", msg: "Notificerede ejer om ny enhed der loggede ind med Pilars konto (verificeret OK)" },
  ],
  vega: [
    { at: "1t", lvl: "ok", msg: "Venlig påmindelse sendt til 3 klienter med faktura > 14 dage" },
    { at: "4t", lvl: "ok", msg: "Matched 12 indkomne betalinger · auto-bogført til e-conomic" },
    { at: "1d", lvl: "forecast", msg: "30d cash-flow-prognose: +12% · sendt til ejer" },
  ],
  bjorn: [
    { at: "3t", lvl: "ok", msg: "Re-optimerede rute · skiftede rækkefølge · sparet 14 min" },
    { at: "1d", lvl: "ok", msg: "Tilgængeligheds-tjek for ny klient · 2. sal uden elevator · noteret" },
  ],
  liv: [
    { at: "5t", lvl: "ok", msg: "Sendte midt-i-forløb-besked til Amira · «hvordan har dagen været?» · 8/10" },
    { at: "1d", lvl: "escalate", msg: "Eskalerede Per S. til Dr. Krarup · øget smerte rapporteret" },
  ],
  atlas: [
    { at: "1d", lvl: "code", msg: "Genskrev ingress-shader · −14% memory · skygge-mode (afventer review)" },
    { at: "2d", lvl: "tests", msg: "Genererede 23 unit-tests for booking-modul · 100% pass" },
  ],
};

export default async function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = getAgent(id);
  if (!a) notFound();
  const log = RECENT_LOG[a.id] ?? [];
  const others = AGENTS.filter((x) => x.id !== a.id);

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <Link href="/admin/agents" className="kicker hover:underline mt-1">← Agent-team</Link>
        </div>
      </div>

      {/* Hero */}
      <section className="rise mt-3 overflow-hidden rounded-[16px] border border-line bg-card">
        <div className="grid grid-cols-1 gap-0 md:grid-cols-[280px_1fr]">
          {/* Persona-kort */}
          <div className="border-b border-line p-7 md:border-b-0 md:border-r" style={{ background: `linear-gradient(135deg, ${a.avatarColor}11, transparent)` }}>
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div
                  className="grid h-24 w-24 place-items-center rounded-full text-[40px] font-semibold text-paper"
                  style={{ background: a.avatarColor }}
                >
                  {a.avatarGlyph}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card live-dot"
                  style={{ background: MOOD_COLOR[a.mood] }}
                />
              </div>
              <div className="display mt-4 text-[24px] font-semibold leading-none">{a.name}</div>
              <div className="mt-1 text-[12px] text-muted">{a.role}</div>
              <div className="mt-2 chip mono !text-[10px] !py-0.5">{a.pronouns} · {a.mood}</div>
            </div>
            <div className="mt-5 border-t border-line pt-4 text-[11px]">
              <div className="kicker !text-[9px] mb-1">Model</div>
              <div className="mono text-[10.5px]">{a.model}</div>
            </div>
          </div>

          {/* Greeting + voice */}
          <div className="p-7">
            <div className="kicker !text-[10px]">Sådan taler {a.name}</div>
            <blockquote className="display mt-2 text-[22px] leading-snug" style={{ fontStyle: "italic", color: a.avatarColor }}>
              "{a.greeting}"
            </blockquote>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">{a.voiceTone}</p>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-[10px] border border-signal/30 bg-signal/[0.06] p-3">
                <div className="kicker !text-signal">Superkraft</div>
                <p className="mt-1.5 text-[12.5px] text-ink-soft">{a.superpower}</p>
              </div>
              <div className="rounded-[10px] border border-amber/30 bg-amber/[0.06] p-3">
                <div className="kicker !text-amber">Grænse · gør IKKE</div>
                <p className="mt-1.5 text-[12.5px] text-ink-soft">{a.weakness}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <div className="rise mt-3 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.08s" }}>
        {a.metrics.map((m) => (
          <div key={m.label} className="card p-3">
            <div className="kicker !text-[9px]">{m.label}</div>
            <div className="mt-1 mono text-[22px] font-semibold leading-none">{m.value}</div>
            {m.trend && (
              <div className={`mt-1 text-[10.5px] ${
                m.trend === "up" ? "text-signal" : m.trend === "down" ? "text-clay" : "text-faint"
              }`}>
                {m.trend === "up" ? "↑ stigende" : m.trend === "down" ? "↓ faldende" : "→ stabil"}
              </div>
            )}
          </div>
        ))}
        <div className="card p-3" style={{ background: `${a.avatarColor}08`, borderColor: a.avatarColor + "40" }}>
          <div className="kicker !text-[9px]" style={{ color: a.avatarColor }}>Status</div>
          <div className="mt-1 text-[13px] font-semibold" style={{ color: a.avatarColor }}>{a.status}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Aktivitet */}
        <section className="card rise p-5" style={{ animationDelay: "0.12s" }}>
          <div className="flex items-center justify-between">
            <h2 className="display text-[17px] font-semibold">Live aktivitet</h2>
            <span className="chip mono !text-[10px] text-signal">
              <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
              streaming
            </span>
          </div>
          <div className="mt-4 flex flex-col">
            {log.map((l, i) => (
              <div key={i} className="grid grid-cols-[70px_70px_1fr] gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <span className="mono text-[11px] text-faint">{l.at}</span>
                <span className={`mono text-[10px] ${
                  l.lvl === "ok" ? "text-signal" :
                  l.lvl === "alert" || l.lvl === "warn" ? "text-clay" :
                  l.lvl === "escalate" ? "text-amber" :
                  l.lvl === "writing" || l.lvl === "create" ? "text-accent" :
                  "text-faint"
                }`}>● {l.lvl}</span>
                <span className="text-[12.5px] text-ink-soft">{l.msg}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities + controls */}
        <section className="card rise p-5" style={{ animationDelay: "0.16s" }}>
          <h2 className="display text-[17px] font-semibold">Capabilities</h2>
          <p className="mt-1 text-[11px] text-muted">MCP-tools agenten kan kalde · ingen andre</p>
          <div className="mt-4 flex flex-col gap-1.5">
            {a.capabilities.map((c) => (
              <div key={c} className="flex items-center justify-between rounded-[8px] border border-line bg-paper px-3 py-2">
                <code className="mono text-[11px]">{c}</code>
                <span className="text-[9.5px] text-signal">● enabled</span>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div className="kicker mb-2">Kontroller</div>
            <div className="flex flex-col gap-1.5">
              <button className="btn btn-ghost justify-between">
                <span>Pause agent</span>
                <span className="mono text-[10px] text-faint">midlertidigt</span>
              </button>
              <button className="btn btn-ghost justify-between">
                <span>Skift model</span>
                <span className="mono text-[10px] text-faint">aktuelt: {a.model.split(" ·")[0]}</span>
              </button>
              <Link href="/chat" className="btn btn-primary justify-center mt-1">
                <span className="mr-1">💬</span> Chat direkte med {a.name}
              </Link>
              {a.id === "niels" && (
                <Link href="/admin/agents/niels/pipeline" className="btn btn-ghost justify-center">
                  🔬 Se hele pipelinen →
                </Link>
              )}
              {a.id === "sigrid" && (
                <Link href="/admin/agents/sigrid/engine" className="btn btn-ghost justify-center">
                  ⚙️ Se tilskuds-engine →
                </Link>
              )}
              {a.id === "frej" && (
                <Link href="/admin/agents/frej/engine" className="btn btn-ghost justify-center">
                  🛡️ Se compliance-engine →
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Team navigation */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.20s" }}>
        <h2 className="display text-[15px] font-semibold">Andre i teamet</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {others.map((o) => (
            <Link
              key={o.id}
              href={`/admin/agents/${o.id}`}
              className="flex items-center gap-2.5 rounded-[10px] border border-line bg-paper p-2.5 hover:bg-paper-2"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold text-paper" style={{ background: o.avatarColor }}>
                {o.avatarGlyph}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium">{o.name}</div>
                <div className="text-[10px] text-muted truncate">{o.role}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
