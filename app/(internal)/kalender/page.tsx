const days = ["Man 8", "Tir 9", "Ons 10", "Tor 11", "Fre 12", "Lør 13", "Søn 14"];
const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const HOUR_H = 56;

type Ev = { day: number; start: number; dur: number; title: string; sub: string; color: string; risk?: boolean };
const events: Ev[] = [
  { day: 0, start: 9, dur: 1, title: "Mette L.", sub: "Fod-scan", color: "var(--color-accent)" },
  { day: 0, start: 11, dur: 0.75, title: "Per S.", sub: "Medicinsk fodpleje", color: "var(--color-amber)", risk: true },
  { day: 1, start: 8.5, dur: 1, title: "Jonas B.", sub: "Medicinsk fodpleje", color: "var(--color-clay)" },
  { day: 1, start: 13.5, dur: 0.75, title: "Clara W.", sub: "Luksus fodpleje", color: "var(--color-accent)" },
  { day: 2, start: 10, dur: 1.5, title: "Klinik-dag", sub: "3 fodpleje-sessioner", color: "var(--color-signal)" },
  { day: 3, start: 9, dur: 1, title: "Amira H.", sub: "Gel manicure", color: "var(--color-signal)" },
  { day: 3, start: 14, dur: 0.75, title: "Ny patient", sub: "Fodterapeut · konsultation", color: "var(--color-accent)" },
  { day: 4, start: 14, dur: 0.75, title: "Aria foreslår", sub: "Ledig — hold åben", color: "var(--color-faint)" },
];

export default function Kalender() {
  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex items-end justify-between">
        <div>
          <div className="kicker">Uge 24 · 2026</div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Kalender</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-[10px] border border-line-2 bg-card p-0.5">
            {["Dag", "Uge", "Måned"].map((t, i) => (
              <button key={t} className={`rounded-[8px] px-3 py-1.5 text-[12.5px] ${i === 1 ? "bg-ink text-paper" : "text-muted"}`}>{t}</button>
            ))}
          </div>
          <button className="btn btn-primary">+ Aftale</button>
        </div>
      </div>

      <div className="card rise mt-6 overflow-hidden" style={{ animationDelay: "0.08s" }}>
        {/* Day header */}
        <div className="grid border-b border-line" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div />
          {days.map((d, i) => (
            <div key={d} className={`border-l border-line px-3 py-2.5 ${i === 3 ? "bg-accent/[0.05]" : ""}`}>
              <div className="text-[12.5px] font-medium">{d.split(" ")[0]}</div>
              <div className="mono text-[15px] text-muted">{d.split(" ")[1]}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="relative grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          {/* hour labels */}
          <div className="flex flex-col">
            {hours.map((h) => (
              <div key={h} className="relative border-t border-line" style={{ height: HOUR_H }}>
                <span className="absolute -top-2 right-2 mono text-[10.5px] text-faint">{h}:00</span>
              </div>
            ))}
          </div>

          {days.map((d, di) => (
            <div key={d} className={`relative border-l border-line ${di === 3 ? "bg-accent/[0.04]" : ""}`}>
              {hours.map((h) => (
                <div key={h} className="border-t border-line" style={{ height: HOUR_H }} />
              ))}
              {events.filter((e) => e.day === di).map((e, i) => {
                const top = (e.start - hours[0]) * HOUR_H;
                const h = e.dur * HOUR_H;
                const ghost = e.color === "var(--color-faint)";
                return (
                  <div
                    key={i}
                    className="absolute left-1 right-1 overflow-hidden rounded-[9px] px-2 py-1.5"
                    style={{
                      top: top + 1,
                      height: h - 3,
                      background: ghost ? "transparent" : `color-mix(in srgb, ${e.color} 13%, var(--color-card))`,
                      border: ghost ? "1.5px dashed var(--color-line-2)" : `1px solid color-mix(in srgb, ${e.color} 35%, transparent)`,
                      borderLeft: `3px solid ${e.color}`,
                    }}
                  >
                    <div className="flex items-center gap-1 text-[12px] font-semibold leading-tight">
                      {e.title}
                      {e.risk && <span className="h-1.5 w-1.5 rounded-full bg-amber" />}
                    </div>
                    <div className="truncate text-[10.5px] text-muted">{e.sub}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-accent" /> Klinik</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-signal" /> Video / forløb</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-clay" /> Æstetik</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-amber" /> No-show risiko</span>
        <span className="ml-auto flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] border border-dashed border-line-2" /> AI-forslag</span>
      </div>
    </div>
  );
}
