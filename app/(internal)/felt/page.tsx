const stops = [
  { time: "09:00", name: "Per Sørensen", task: "Sår-kontrol", km: "0 km", status: "Aktuel" },
  { time: "10:15", name: "Inge Mortensen", task: "Kompression", km: "4,2 km", status: "Næste" },
  { time: "11:30", name: "Karl Friis", task: "Medicin-tjek", km: "7,8 km", status: "Planlagt" },
  { time: "13:00", name: "Bodil Hansen", task: "Opfølgning", km: "3,1 km", status: "Planlagt" },
];

export default function Felt() {
  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex items-end justify-between">
        <div>
          <div className="kicker">Mobil · offline-first</div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Ruteplanlægning</h1>
          <p className="mt-2.5 text-[14px] text-muted">ML-optimeret rute · fungerer uden netværk · synker når du er online igen.</p>
        </div>
        <span className="chip !border-amber/40 text-amber">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12h4M18 12h4M5 5l3 3M16 16l3 3"/><circle cx="12" cy="12" r="3"/></svg>
          Offline · 3 ændringer i kø
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
        {/* Map */}
        <section className="card rise relative overflow-hidden p-0" style={{ animationDelay: "0.06s" }}>
          <div className="relative h-[420px] w-full bg-paper-2">
            <div className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            {/* route path */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 420" fill="none">
              <path d="M70 90 C 140 120, 110 220, 200 230 S 320 300, 300 360" stroke="var(--color-accent)" strokeWidth="2.5" strokeDasharray="6 6" />
              {[[70,90,"1"],[200,230,"2"],[300,360,"3"],[150,330,"4"]].map(([x,y,n],i)=>(
                <g key={i}>
                  <circle cx={x as number} cy={y as number} r="13" fill={i===0?"var(--color-clay)":"var(--color-card)"} stroke="var(--color-accent)" strokeWidth="2"/>
                  <text x={x as number} y={(y as number)+4} textAnchor="middle" fontSize="11" fill={i===0?"#fff":"var(--color-ink)"} fontWeight="600">{n}</text>
                </g>
              ))}
            </svg>
            <div className="absolute left-3 top-3 chip !bg-card">Rute · 15,1 km · 4 stop</div>
            <div className="absolute bottom-3 left-3 rounded-[11px] border border-line bg-card px-3 py-2">
              <div className="kicker !text-[9px]">ML-dispatch</div>
              <div className="mt-0.5 text-[12.5px]">Sparet <b>22 min</b> vs. manuel rute</div>
            </div>
          </div>
        </section>

        {/* Stops */}
        <section className="card rise p-5" style={{ animationDelay: "0.12s" }}>
          <h2 className="display text-[16px] font-semibold">Dagens rute</h2>
          <div className="mt-4 flex flex-col">
            {stops.map((s, i) => (
              <div key={s.name} className="flex gap-3.5 border-t border-line py-3 first:border-t-0 first:pt-0">
                <div className="flex flex-col items-center">
                  <div className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${i === 0 ? "bg-clay text-paper" : "bg-paper-2"}`}>{i + 1}</div>
                  {i < stops.length - 1 && <div className="w-px flex-1 bg-line" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="mono text-[12px] text-muted">{s.time}</span>
                    <span className={`chip !py-0.5 ${s.status === "Aktuel" ? "!border-clay/40 text-clay" : "text-faint"}`}>{s.status}</span>
                  </div>
                  <div className="mt-0.5 text-[14px] font-medium">{s.name}</div>
                  <div className="flex items-center gap-2 text-[12px] text-muted">{s.task}<span className="text-line-2">·</span><span className="mono">{s.km}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
