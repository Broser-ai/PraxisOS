import Link from "next/link";
import { today, kpis, practitioner } from "@/lib/mock";

function RiskTone(risk: number) {
  if (risk >= 55) return { label: "Høj", cls: "text-amber", bg: "bg-amber" };
  if (risk >= 30) return { label: "Mellem", cls: "text-clay", bg: "bg-clay" };
  return { label: "Lav", cls: "text-signal", bg: "bg-signal" };
}

export default function Dashboard() {
  const first = practitioner.name.split(" ")[1] ?? practitioner.name;
  return (
    <div className="mx-auto max-w-[1180px]">
      {/* Header */}
      <div className="rise flex items-end justify-between">
        <div>
          <div className="kicker">Lørdag · 7. juni 2026</div>
          <h1 className="display mt-2 text-[34px] font-semibold leading-none">
            God morgen, {first}.
          </h1>
          <p className="mt-2.5 text-[14px] text-muted">
            5 aftaler i dag · Aria håndterede 1 no-show-risiko mens du sov.
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Link href="/scribe" className="btn btn-ghost">Start scribe</Link>
          <Link href="/kalender" className="btn btn-primary">Ny aftale</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="stagger mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-[12px] text-muted">{k.label}</div>
            <div className="display mt-2 text-[26px] font-semibold leading-none">{k.value}</div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" />
              <span className="mono text-[11px] text-faint">{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Schedule */}
        <section className="card rise p-5 lg:col-span-2" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between">
            <h2 className="display text-[17px] font-semibold">I dag</h2>
            <Link href="/kalender" className="mono text-[11px] text-accent hover:underline">
              Se hele ugen →
            </Link>
          </div>
          <div className="mt-4 flex flex-col">
            {today.map((a, i) => {
              const r = RiskTone(a.noShowRisk);
              return (
                <div
                  key={a.id}
                  className="group flex items-center gap-4 border-t border-line py-3 first:border-t-0"
                >
                  <div className="w-[52px] shrink-0">
                    <div className="mono text-[13px] font-medium">{a.time}</div>
                    <div className="mono text-[10.5px] text-faint">{a.end}</div>
                  </div>
                  <div className="h-9 w-[3px] rounded-full" style={{ background: a.color }} />
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper-2 text-[11px] font-semibold">
                    {a.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{a.client}</div>
                    <div className="truncate text-[12px] text-muted">{a.type}</div>
                  </div>
                  <span className="chip hidden sm:inline-flex">{a.modality}</span>
                  <div className="hidden w-[78px] items-center gap-1.5 md:flex">
                    <span className={`h-1.5 w-1.5 rounded-full ${r.bg}`} />
                    <span className={`mono text-[11px] ${r.cls}`}>{a.noShowRisk}%</span>
                  </div>
                  <span
                    className={`chip ${
                      a.status === "Ankommet" ? "!border-signal/40 text-signal" : "text-muted"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* AI column */}
        <div className="flex flex-col gap-3">
          <section className="card rise p-5" style={{ animationDelay: "0.16s" }}>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-signal/14 text-signal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l2.4 5 5.6.6-4 4 1 5.4L12 19l-5 2.6 1-5.4-4-4 5.6-.6z"/></svg>
              </span>
              <h2 className="display text-[16px] font-semibold">Aria · natten over</h2>
            </div>
            <div className="mt-3.5 rounded-[11px] border border-amber/30 bg-amber/[0.06] p-3.5">
              <div className="flex items-center justify-between">
                <span className="kicker !text-amber">No-show risiko 68%</span>
                <span className="mono text-[11px] text-faint">06:12</span>
              </div>
              <p className="mt-2 text-[13px] text-ink-soft">
                <b>Per Sørensen</b> (11:30, hjemmebesøg) flaggede højrisiko. Aria sendte en venlig SMS,
                bekræftede adressen og tilbød reservetid.
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-signal">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Patienten bekræftede kl. 06:40
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-[13px]">
              {[
                ["3 påmindelser sendt", "via SMS + e-mail"],
                ["2 journaler forberedt", "AI-scribe udkast klar"],
                ["1 efterbooking", "fra venteliste"],
              ].map(([a, b]) => (
                <div key={a} className="flex items-center gap-2.5 border-t border-line pt-2 first:border-t-0 first:pt-0">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-paper-2 text-signal">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
                  </span>
                  <span className="font-medium">{a}</span>
                  <span className="ml-auto text-[12px] text-faint">{b}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card rise p-5" style={{ animationDelay: "0.22s" }}>
            <h2 className="display text-[16px] font-semibold">Genveje</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["AI Scribe", "/scribe", "M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3"],
                ["AR-scan", "/klienter/mette", "M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M8 12h8"],
                ["Spørg Aria", "/agent", "M5 4h14v11H8l-3 3z"],
                ["Felt-rute", "/felt", "M3 7l9-4 9 4-9 4-9-4z"],
              ].map(([label, href, d]) => (
                <Link key={label} href={href} className="flex flex-col gap-2.5 rounded-[11px] border border-line bg-paper p-3 transition-colors hover:bg-paper-2">
                  <span className="text-accent">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d as string}/></svg>
                  </span>
                  <span className="text-[12.5px] font-medium">{label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
