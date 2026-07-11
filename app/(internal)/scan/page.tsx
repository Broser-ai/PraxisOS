import { RealisticFoot } from "@/components/RealisticFoot";
import { SwarmPanel } from "@/components/SwarmPanel";
import { sensorBridge, footMetrics, biomarkers, codeLog, FEATURE_CAD_EXPORT } from "@/lib/scan";

// Sample plantar zones matching the biomech report shape
const LEFT_ZONES = [
  { label: "Hæl",             cx: 0.50, cy: 0.10, radius_mm: 22, peak_kpa: 205 },
  { label: "Lateral midfod",  cx: 0.62, cy: 0.45, radius_mm: 15, peak_kpa: 110 },
  { label: "MTP 1",           cx: 0.32, cy: 0.80, radius_mm: 12, peak_kpa: 175 },
  { label: "Forfods-ballen",  cx: 0.50, cy: 0.78, radius_mm: 18, peak_kpa: 184 },
  { label: "MTP 5",           cx: 0.68, cy: 0.80, radius_mm: 10, peak_kpa: 155 },
  { label: "Hallux",          cx: 0.35, cy: 0.94, radius_mm: 8,  peak_kpa: 120 },
];

const RIGHT_ZONES = [
  { label: "Hæl",             cx: 0.50, cy: 0.10, radius_mm: 22, peak_kpa: 220 },
  { label: "Lateral midfod",  cx: 0.62, cy: 0.45, radius_mm: 15, peak_kpa: 125 },
  { label: "MTP 1",           cx: 0.30, cy: 0.80, radius_mm: 14, peak_kpa: 220 },
  { label: "Forfods-ballen",  cx: 0.50, cy: 0.78, radius_mm: 20, peak_kpa: 242 },
  { label: "MTP 5",           cx: 0.70, cy: 0.80, radius_mm: 11, peak_kpa: 190 },
  { label: "Hallux",          cx: 0.32, cy: 0.94, radius_mm: 9,  peak_kpa: 135 },
];

export default function FodScanPage() {
  return (
    <div className="mx-auto max-w-[1320px]">
      {/* Header */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
            </span>
            Physical AI · Fod-scanning · sub-mm topologi
          </div>
          <h1 className="display mt-2 text-[32px] font-semibold leading-none">Fod-scan</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Mette L. · Session #3 · 3-agent swarm · plantar pressure + termisk + vaskulær
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip mono !text-[10.5px] text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            EDGE · 0.4ms p99
          </span>
          {FEATURE_CAD_EXPORT && <button className="btn btn-ghost">Eksportér til indlæg-producent</button>}
          <a href="/scan/start" className="btn btn-primary">
            <span className="h-2 w-2 rounded-full bg-clay live-dot" /> Nyt scan
          </a>
        </div>
      </div>

      {/* Sensor bridge — 4 sensorer (kun det der er relevant for fod) */}
      <div className="rise mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        {sensorBridge.map((s) => (
          <div key={s.name} className="card flex items-center gap-2.5 p-2.5">
            <span className="h-2 w-2 rounded-full bg-signal live-dot" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] font-medium">{s.name}</div>
              <div className="mono text-[10px] text-faint">{s.latency} · {s.health}%</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Foden — STOR — photorealistic 3D */}
        <section className="card rise p-5" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="display text-[17px] font-semibold">Fod-topologi · fotorealistisk 3D</h2>
              <div className="kicker !text-[9px]">PBR-hud · subsurface · HDR-lys · rigtige anatomiske proportioner</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <div className="kicker mb-2">Venstre fod</div>
              <RealisticFoot
                side="L"
                lengthMm={265}
                forefootWidthMm={100}
                heelWidthMm={65}
                archIndex={0.24}
                halluxValgusDeg={12}
                navicularDropMm={6.1}
                pressureZones={LEFT_ZONES}
                height={360}
              />
            </div>
            <div>
              <div className="kicker mb-2">Højre fod · hallux valgus 18°</div>
              <RealisticFoot
                side="R"
                lengthMm={265}
                forefootWidthMm={102}
                heelWidthMm={65}
                archIndex={0.28}
                halluxValgusDeg={18}
                navicularDropMm={8.4}
                pressureZones={RIGHT_ZONES}
                height={360}
              />
            </div>
          </div>

          {/* Metrics */}
          <div className="mt-5 border-t border-line pt-4">
            <div className="kicker mb-3">Kvantitative parametre · L vs. R</div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {footMetrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between border-b border-line/60 py-1.5 last:border-b-0">
                  <span className="text-[12.5px]">{m.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="mono text-[11.5px] text-faint">{m.left} · {m.right}</span>
                    <span className="mono text-[9.5px] text-clay">{m.flag}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pressure-skala */}
          <div className="mt-4 flex items-center gap-3 text-[10.5px] text-faint">
            <span className="mono">0 kPa</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full"
                 style={{ background: "linear-gradient(90deg, #3f7d5a, #ad7a26, #c46a4a, #b9543a)" }} />
            <span className="mono">250+ kPa</span>
          </div>
        </section>

        <div className="flex flex-col gap-3">
          {/* Klinisk anbefaling */}
          <section className="card rise p-4" style={{ animationDelay: "0.12s" }}>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-clay/14 text-clay">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="display text-[15px] font-semibold leading-tight">Klinisk anbefaling</h2>
                <div className="kicker !text-[9px]">genereret af agent.diag</div>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
              <b>Asymmetrisk overbelastning af højre forfod.</b> Hallux valgus +18°, plantar peak-tryk 242 kPa
              (overbelastet), termisk hotspot MTP 5 (+1.4°C) korrelerer med reduceret mikrocirkulation.
              Foreslår metatarsal-pad + opfølgning om 6 uger.
            </p>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary !py-1.5 !text-[11.5px]">Send til journal</button>
              <button className="btn btn-ghost !py-1.5 !text-[11.5px]">Send til kunde</button>
            </div>
          </section>

          {/* Swarm */}
          <section className="card rise p-4" style={{ animationDelay: "0.16s" }}>
            <div className="flex items-center justify-between">
              <h2 className="display text-[15px] font-semibold">Agent swarm</h2>
              <span className="kicker !text-[9px]">3 aktive</span>
            </div>
            <div className="mt-3">
              <SwarmPanel />
            </div>
          </section>

          {/* Biomarkers */}
          <section className="card rise p-4" style={{ animationDelay: "0.20s" }}>
            <h2 className="display text-[15px] font-semibold">Biomarkers</h2>
            <div className="mt-3 flex flex-col gap-1.5">
              {biomarkers.map((b) => (
                <div key={b.name} className="flex items-center justify-between rounded-[9px] border border-line bg-paper px-3 py-2">
                  <div>
                    <div className="text-[12px] font-medium">{b.name}</div>
                    <div className="text-[10.5px] text-faint">{b.trend}</div>
                  </div>
                  <span className={`mono text-[11px] ${b.status === "warn" ? "text-clay" : "text-signal"}`}>{b.value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 3D-mesh · fri rotation · auto-spin */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.22s" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="display text-[17px] font-semibold">3D-mesh · fri rotation</h2>
            <div className="kicker !text-[9px]">træk for at rotere · scroll for zoom · auto-spin når idle</div>
          </div>
          <span className="chip mono !text-[10px]">three.js · PBR · Environment HDR</span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <RealisticFoot side="L" lengthMm={265} forefootWidthMm={100} heelWidthMm={65}
                         archIndex={0.24} halluxValgusDeg={12} navicularDropMm={6.1}
                         pressureZones={LEFT_ZONES} height={420} autoRotate />
          <RealisticFoot side="R" lengthMm={265} forefootWidthMm={102} heelWidthMm={65}
                         archIndex={0.28} halluxValgusDeg={18} navicularDropMm={8.4}
                         pressureZones={RIGHT_ZONES} height={420} autoRotate />
        </div>
      </section>

      {/* Telemetri */}
      <section className="card rise mt-3 overflow-hidden" style={{ animationDelay: "0.26s" }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <h2 className="display text-[15px] font-semibold">Telemetri · agent-trace</h2>
            <div className="kicker !text-[9px]">MCP-bound tools · kryptografisk sequence-id</div>
          </div>
          <span className="chip mono !text-[10px]">trace · seq 0x7af2…91c</span>
        </div>
        <div className="scrollbar-thin max-h-[180px] overflow-y-auto px-5 py-3 mono text-[11px]">
          {codeLog.map((l, i) => (
            <div key={i} className="grid grid-cols-[120px_140px_1fr] gap-2 py-0.5">
              <span className="text-faint">{l.t}</span>
              <span className={l.lvl.includes("pod") ? "text-clay" : l.lvl === "mcp" ? "text-accent" : "text-amber"}>{l.lvl}</span>
              <span className="text-ink-soft">{l.msg}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
