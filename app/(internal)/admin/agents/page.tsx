import Link from "next/link";
import { AGENTS, MOOD_COLOR } from "@/lib/agents";

export default function AgentRoster() {
  const active = AGENTS.filter((a) => a.status === "active");
  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Agent-team</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            {active.length} humaniserede AI-agenter driver klinikkens workflow.
            Hver har en personlighed, et fag-domæne og klare grænser for hvad de ikke gør.
          </p>
        </div>
        <Link href="/chat" className="btn btn-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-paper live-dot" /> Åbn samlet chat →
        </Link>
      </div>

      {/* Top-stats */}
      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        {[
          ["9", "agenter aktive"],
          ["47 min", "spar pr. dag"],
          ["100%", "auto-indberetning"],
          ["0", "fejl-eskalationer · 24t"],
        ].map(([n, l]) => (
          <div key={n} className="card p-3">
            <div className="display text-[24px] font-semibold leading-none">{n}</div>
            <div className="mt-1 text-[11px] text-muted">{l}</div>
          </div>
        ))}
      </div>

      {/* Agent-grid */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((a, i) => (
          <Link
            key={a.id}
            href={`/admin/agents/${a.id}`}
            className="card group flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-ink"
            style={{ animationDelay: `${0.06 + i * 0.04}s` }}
          >
            <div className="flex items-start gap-3">
              <span
                className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold text-paper"
                style={{ background: a.avatarColor }}
              >
                {a.avatarGlyph}
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper live-dot"
                  style={{ background: MOOD_COLOR[a.mood] }}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="display text-[18px] font-semibold leading-tight">{a.name}</span>
                  <span className="text-[10.5px] text-faint">· {a.pronouns}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{a.role}</div>
                <div className="mt-0.5 mono text-[10px] text-faint">{a.domain}</div>
              </div>
            </div>

            <p className="text-[12.5px] leading-relaxed text-ink-soft" style={{ fontStyle: "italic" }}>
              "{a.greeting}"
            </p>

            <div className="mt-auto border-t border-line pt-3">
              <div className="kicker !text-[9px] mb-2">Live metrics</div>
              <div className="grid grid-cols-3 gap-2">
                {a.metrics.slice(0, 3).map((m) => (
                  <div key={m.label}>
                    <div className="mono text-[12px] font-semibold">{m.value}</div>
                    <div className="text-[9.5px] text-faint truncate">{m.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 text-[10.5px] text-faint truncate">
                <span className="mono">{a.lastAction.at}</span> · {a.lastAction.what}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-[12px] border border-line bg-paper-2/60 p-5 text-[12.5px] text-ink-soft">
        <div className="kicker">Humanized AI</div>
        <p className="mt-2 max-w-[760px]">
          Hver agent har et eget tonefald, et tydeligt fag-domæne — og <b>klare grænser for hvad den ikke gør</b>.
          De koordinerer via PraxisOS event-bus og eskalerer altid til menneske ved klinisk usikkerhed.
          Patienter taler ikke til "en AI" — de taler til <b>Aria</b>, <b>Niels</b>, <b>Liv</b> osv.
        </p>
      </div>
    </div>
  );
}
