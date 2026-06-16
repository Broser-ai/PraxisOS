"use client";

import { useState } from "react";
import { plantarZones } from "@/lib/scan";

type ViewMode = "top" | "side" | "bottom";

function colorAt(intensity: number) {
  if (intensity < 0.35) return "#3f7d5a";
  if (intensity < 0.55) return "#ad7a26";
  if (intensity < 0.78) return "#c46a4a";
  return "#b9543a";
}

type Hover =
  | { kind: "zone"; side: "L" | "R"; idx: number; x: number; y: number; intensity: number; kPa: number; label: string }
  | { kind: "marker"; side: "L" | "R"; x: number; y: number; label: string; value: string }
  | null;

export function FootScan() {
  const [view, setView] = useState<ViewMode>("bottom");
  const [hover, setHover] = useState<Hover>(null);

  return (
    <div className="relative">
      {/* View-tabs */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-[10px] border border-line-2 bg-paper p-0.5 text-[11.5px]">
          {([
            ["top", "Top · dorsal"],
            ["side", "Side · profil"],
            ["bottom", "Bund · plantar"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => { setView(k); setHover(null); }}
              className="rounded-[8px] px-3 py-1.5"
              style={{
                background: view === k ? "var(--color-ink)" : "transparent",
                color: view === k ? "var(--color-paper)" : "var(--color-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto mono text-[10.5px] text-faint">
          {view === "top" && "vaskulær · termisk · negle"}
          {view === "side" && "arch profile · hallux valgus · navicular drop"}
          {view === "bottom" && "plantar pressure · MTP-zoner"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(["L", "R"] as const).map((side) => {
          const peak = side === "L" ? 184 : 242;
          return (
            <div key={side} className="relative">
              <div className="mb-2.5 flex items-center justify-between text-[11px] text-muted">
                <span className="kicker !text-[9.5px]">{side === "L" ? "Venstre fod" : "Højre fod"}</span>
                {view === "bottom" && (
                  <span className="mono text-[11.5px] font-medium" style={{ color: side === "L" ? "var(--color-signal)" : "var(--color-clay)" }}>
                    peak {peak} kPa
                  </span>
                )}
                {view === "side" && (
                  <span className="mono text-[11.5px] font-medium" style={{ color: side === "L" ? "var(--color-signal)" : "var(--color-clay)" }}>
                    valgus {side === "L" ? "12°" : "18°"}
                  </span>
                )}
                {view === "top" && (
                  <span className="mono text-[11.5px] font-medium" style={{ color: side === "L" ? "var(--color-signal)" : "var(--color-clay)" }}>
                    {side === "L" ? "normal" : "+1.4°C MTP 5"}
                  </span>
                )}
              </div>

              <div
                className="relative aspect-[1/1.9] w-full overflow-hidden rounded-[14px] border border-line bg-paper-2"
                style={view === "side" ? { aspectRatio: "1.9 / 1" } : {}}
              >
                {view === "top" && <TopView side={side} hover={hover} setHover={setHover} />}
                {view === "side" && <SideView side={side} hover={hover} setHover={setHover} />}
                {view === "bottom" && <BottomView side={side} hover={hover} setHover={setHover} peak={peak} />}

                {/* Tooltip */}
                {hover?.side === side && (
                  <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[8px] border border-line-2 bg-ink px-2.5 py-1.5 text-paper shadow-lg"
                    style={{ left: `${hover.x}%`, top: `${hover.y}%`, marginTop: -8 }}
                  >
                    <div className="text-[10.5px] font-medium leading-tight">{hover.label}</div>
                    <div className="mono text-[10px] text-paper/70">
                      {hover.kind === "zone" ? `${hover.kPa} kPa` : hover.value}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live status under fødderne */}
      <div className="mt-3 flex items-center justify-between text-[10.5px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
          {hover ? (
            hover.kind === "zone" ? `${hover.label} · ${hover.kPa} kPa` : `${hover.label} · ${hover.value}`
          ) : `Hover for detaljer · ${view === "top" ? "12 referencepunkter" : view === "side" ? "6 målinger" : "6 zoner · 4096 sensorer"}`}
        </span>
        <span className="mono">
          {view === "top" && "8-14μm termisk · 12 Hz"}
          {view === "side" && "Struktureret lys · 0.3mm præcision"}
          {view === "bottom" && "Pressure pad · 4096 sensorer · 12 Hz"}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Bottom view (plantar pressure heatmap)
// =============================================================================
function BottomView({ side, hover, setHover, peak }: { side: "L" | "R"; hover: Hover; setHover: (h: Hover) => void; peak: number }) {
  return (
    <svg viewBox="0 0 100 200" className="h-full w-full select-none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id={`blur-bot-${side}`}><feGaussianBlur stdDeviation="1.4" /></filter>
      </defs>

      {/* Fod-silhuet (plantar) */}
      <path
        d="M50 8 C 68 8 78 28 78 60 C 78 90 72 110 70 140 C 68 170 60 192 50 192 C 40 192 32 170 30 140 C 28 110 22 90 22 60 C 22 28 32 8 50 8 Z"
        fill="var(--color-card)" stroke="var(--color-line-2)" strokeWidth="0.8"
      />

      {/* Grid */}
      <g stroke="var(--color-line)" strokeWidth="0.4" opacity="0.55">
        {[40, 80, 120, 160].map((y) => <line key={y} x1="22" y1={y} x2="78" y2={y} strokeDasharray="2 3" />)}
        <line x1="50" y1="8" x2="50" y2="192" strokeDasharray="2 3" />
      </g>

      {/* Pressure-zoner */}
      <g filter={`url(#blur-bot-${side})`}>
        {plantarZones.map((z, i) => {
          const adj = side === "R" ? Math.min(1, z.intensity * 1.15) : z.intensity;
          const c = colorAt(adj);
          return (
            <g key={i}>
              <circle cx={z.cx} cy={z.cy * 2} r={z.r * 1.8} fill={c} opacity={0.3} />
              <circle cx={z.cx} cy={z.cy * 2} r={z.r * 1.2} fill={c} opacity={0.55} />
              <circle cx={z.cx} cy={z.cy * 2} r={z.r * 0.6} fill={c} opacity={0.85} />
            </g>
          );
        })}
      </g>

      {/* Iso-linjer */}
      <g fill="none" stroke="var(--color-ink)" strokeWidth="0.35" opacity="0.2">
        <ellipse cx="50" cy="36" rx="22" ry="14" />
        <ellipse cx="50" cy="156" rx="18" ry="20" />
      </g>

      {/* Klikbare zoner */}
      {plantarZones.map((z, i) => {
        const adj = side === "R" ? Math.min(1, z.intensity * 1.15) : z.intensity;
        const kPa = Math.round(adj * peak * 1.05);
        const cy2 = z.cy * 2;
        const isHover = hover?.kind === "zone" && hover.side === side && hover.idx === i;
        return (
          <g key={`hit-${i}`}
             onMouseEnter={() => setHover({ kind: "zone", side, idx: i, x: z.cx, y: (cy2 / 200) * 100, intensity: adj, kPa, label: z.label })}
             onMouseLeave={() => setHover(null)}
             style={{ cursor: "pointer" }}>
            <circle cx={z.cx} cy={cy2} r={z.r * 1.4} fill="transparent" />
            <circle cx={z.cx} cy={cy2} r={isHover ? 3.2 : 1.8}
                    fill="var(--color-card)" stroke={colorAt(adj)} strokeWidth={isHover ? 1.4 : 0.8}
                    style={{ transition: "all 0.15s" }} />
          </g>
        );
      })}

      {/* Scan-linje */}
      <line x1="22" y1="0" x2="78" y2="0" stroke="var(--color-signal)" strokeWidth="1.2" opacity="0.7">
        <animate attributeName="y1" values="10;190;10" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="y2" values="10;190;10" dur="3.6s" repeatCount="indefinite" />
      </line>

      <g fontFamily="var(--font-mono)" fontSize="3.4" fill="var(--color-ink-soft)" opacity="0.55">
        <text x="33" y="42">hæl</text>
        <text x="32" y="160">forfods-ballen</text>
      </g>
    </svg>
  );
}

// =============================================================================
// Top view (dorsal — vaskulær + termisk + negle)
// =============================================================================
function TopView({ side, hover, setHover }: { side: "L" | "R"; hover: Hover; setHover: (h: Hover) => void }) {
  // Hot-spot ved højre fod ved MTP 5
  const thermalCx = 58;
  const thermalCy = 145;
  const hasHotspot = side === "R";

  // Anatomiske referencepunkter
  const markers = [
    { x: 50, y: 24, label: "Hallux nail", value: "Klar" },
    { x: 42, y: 22, label: "Negl 2", value: "Klar" },
    { x: 37, y: 23, label: "Negl 3", value: "Klar" },
    { x: 33, y: 25, label: "Negl 4", value: "Klar" },
    { x: 30, y: 28, label: "Negl 5", value: "Klar" },
    { x: 50, y: 100, label: "Dorsal arch", value: "Normal" },
    ...(hasHotspot ? [{ x: thermalCx, y: thermalCy, label: "Termisk hotspot", value: "+1.4°C" }] : []),
  ];

  // Vene-linjer (simuleret)
  const veins = side === "L"
    ? "M 50 20 Q 48 60 50 100 Q 52 140 50 180 M 38 30 Q 42 70 46 115 Q 48 150 46 180 M 62 30 Q 58 70 54 115 Q 52 150 54 180"
    : "M 50 20 Q 52 60 50 100 Q 48 140 50 180 M 38 30 Q 42 70 46 115 Q 48 150 46 180 M 62 30 Q 58 70 54 115 Q 52 150 54 180";

  return (
    <svg viewBox="0 0 100 200" className="h-full w-full select-none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={`heat-${side}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#b9543a" stopOpacity="0.85" />
          <stop offset="40%" stopColor="#c46a4a" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#c46a4a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`skin-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d9c8" />
          <stop offset="100%" stopColor="#dfc1a8" />
        </linearGradient>
      </defs>

      {/* Fod-silhuet (top view — lidt smallere end plantar) */}
      <path
        d="M50 14 C 64 14 72 32 72 62 C 72 92 66 112 64 145 C 62 175 58 192 50 192 C 42 192 38 175 36 145 C 34 112 28 92 28 62 C 28 32 36 14 50 14 Z"
        fill={`url(#skin-${side})`}
        stroke="var(--color-line-2)" strokeWidth="0.8"
      />

      {/* Negle */}
      {markers.slice(0, 5).map((m, i) => {
        const w = i === 0 ? 6 : 4;
        const h = i === 0 ? 5 : 3.5;
        return (
          <ellipse key={i} cx={m.x} cy={m.y} rx={w} ry={h}
                   fill="#fff" opacity="0.65" stroke="var(--color-line-2)" strokeWidth="0.3" />
        );
      })}

      {/* Vener (subtile blå linjer) */}
      <path d={veins} fill="none" stroke="#2f4a7c" strokeWidth="0.6" opacity="0.35" />

      {/* Termisk hotspot */}
      {hasHotspot && (
        <>
          <circle cx={thermalCx} cy={thermalCy} r="14" fill={`url(#heat-${side})`} />
          <circle cx={thermalCx} cy={thermalCy} r="3" fill="#b9543a" opacity="0.7">
            <animate attributeName="r" values="2.5;5;2.5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.85;0.3;0.85" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Termisk skala (subtil baggrund) */}
      <g opacity="0.18">
        {[30, 80, 130, 170].map((y) => <line key={y} x1="28" y1={y} x2="72" y2={y} stroke="var(--color-ink)" strokeWidth="0.3" strokeDasharray="1 3" />)}
      </g>

      {/* Klikbare markører */}
      {markers.map((m, i) => {
        const isHover = hover?.kind === "marker" && hover.side === side && hover.x === m.x;
        return (
          <g key={`m-${i}`}
             onMouseEnter={() => setHover({ kind: "marker", side, x: m.x, y: (m.y / 200) * 100, label: m.label, value: m.value })}
             onMouseLeave={() => setHover(null)}
             style={{ cursor: "pointer" }}>
            <circle cx={m.x} cy={m.y} r="3" fill="transparent" />
            <circle cx={m.x} cy={m.y} r={isHover ? 2 : 1.2}
                    fill={m.label.includes("Termisk") ? "#b9543a" : "var(--color-ink)"}
                    stroke="var(--color-card)" strokeWidth="0.4"
                    style={{ transition: "all 0.15s" }} />
          </g>
        );
      })}

      {/* Scan-linje */}
      <line x1="28" y1="0" x2="72" y2="0" stroke="var(--color-signal)" strokeWidth="1.2" opacity="0.7">
        <animate attributeName="y1" values="14;192;14" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="y2" values="14;192;14" dur="3.6s" repeatCount="indefinite" />
      </line>

      {/* Etiketter */}
      <g fontFamily="var(--font-mono)" fontSize="3.2" fill="var(--color-ink-soft)" opacity="0.55">
        <text x="74" y="22">tæer</text>
        <text x="74" y="102">vrist</text>
        <text x="74" y="180">ankel</text>
      </g>
    </svg>
  );
}

// =============================================================================
// Side view (medial profil — arch + hallux valgus + navicular drop)
// =============================================================================
function SideView({ side, hover, setHover }: { side: "L" | "R"; hover: Hover; setHover: (h: Hover) => void }) {
  // Mirror højre fod (vises som spejlbillede så hælen er på højre side for begge billeder)
  const flip = side === "R";
  const archDepth = side === "L" ? 28 : 22; // højre fod har lavere arch
  const valgus = side === "L" ? 12 : 18;
  const navDrop = side === "L" ? 6.1 : 8.4;

  const markers = [
    { x: 30, y: 52, label: "Ankel", value: "Normal mobilitet" },
    { x: 50, y: 38, label: "Navicular drop", value: `${navDrop} mm` },
    { x: 65, y: 50, label: "Cuneiform", value: "Stabil" },
    { x: 130, y: 52, label: "MTP 1", value: `Hallux valgus ${valgus}°` },
    { x: 155, y: 65, label: "Hallux IP", value: "Normal" },
    { x: 20, y: 75, label: "Hæl", value: "Calcaneus normal" },
  ];

  return (
    <svg viewBox="0 0 180 100" className="h-full w-full select-none" preserveAspectRatio="xMidYMid meet" style={flip ? { transform: "scaleX(-1)" } : {}}>
      <defs>
        <linearGradient id={`skin-side-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d9c8" />
          <stop offset="100%" stopColor="#dfc1a8" />
        </linearGradient>
      </defs>

      {/* Gulv-linje */}
      <line x1="5" y1="85" x2="175" y2="85" stroke="var(--color-ink)" strokeWidth="0.5" opacity="0.35" strokeDasharray="2 2" />

      {/* Fod-side-profil */}
      <path
        d={`
          M 10 85
          Q 8 75 12 65
          Q 16 50 30 42
          L 50 ${42 + (28 - archDepth)}
          Q 75 ${50 + (28 - archDepth)} 100 ${52 + (28 - archDepth) / 2}
          Q 130 50 155 55
          L 170 70
          L 165 85
          Z
        `}
        fill={`url(#skin-side-${side})`}
        stroke="var(--color-line-2)" strokeWidth="0.8"
      />

      {/* Arch-profil (intern struktur) */}
      <path
        d={`M 25 70 Q 55 ${50 + (28 - archDepth)} 90 ${60 + (28 - archDepth) / 2} Q 130 65 160 72`}
        fill="none" stroke="var(--color-accent)" strokeWidth="0.8" opacity="0.4" strokeDasharray="3 2"
      />

      {/* Navicular drop indikator */}
      <line x1="50" y1="42" x2="50" y2={42 + navDrop * 1.2} stroke="var(--color-clay)" strokeWidth="0.8" />
      <text x="52" y={45 + navDrop * 1.2 / 2} fontSize="3" fill="var(--color-clay)" fontFamily="var(--font-mono)" style={flip ? { transform: "scaleX(-1)", transformOrigin: "52px 45px" } : {}}>
        {navDrop}mm
      </text>

      {/* Hallux valgus vinkel */}
      <g transform="translate(130, 55)">
        <line x1="0" y1="0" x2="20" y2="-2" stroke="var(--color-accent)" strokeWidth="0.6" />
        <path d={`M 0 0 L 20 ${-Math.sin(valgus * Math.PI / 180) * 20} L 20 -2 Z`} fill="var(--color-clay)" opacity="0.3" />
        <text x="22" y="-3" fontSize="3" fill="var(--color-clay)" fontFamily="var(--font-mono)" style={flip ? { transform: "scaleX(-1) translate(-44px, 0)" } : {}}>
          {valgus}°
        </text>
      </g>

      {/* Anatomi-grid */}
      <g stroke="var(--color-line)" strokeWidth="0.3" opacity="0.5">
        {[20, 40, 60, 80].map((y) => <line key={y} x1="5" y1={y} x2="175" y2={y} strokeDasharray="1 3" />)}
      </g>

      {/* Klikbare markører */}
      {markers.map((m, i) => {
        const isHover = hover?.kind === "marker" && hover.side === side && hover.x === m.x;
        return (
          <g key={`s-${i}`}
             onMouseEnter={() => setHover({ kind: "marker", side, x: flip ? 100 - (m.x / 180) * 100 : (m.x / 180) * 100, y: (m.y / 100) * 100, label: m.label, value: m.value })}
             onMouseLeave={() => setHover(null)}
             style={{ cursor: "pointer" }}>
            <circle cx={m.x} cy={m.y} r="4" fill="transparent" />
            <circle cx={m.x} cy={m.y} r={isHover ? 2.4 : 1.6}
                    fill={m.label.includes("valgus") || m.label.includes("Navicular") ? "var(--color-clay)" : "var(--color-ink)"}
                    stroke="var(--color-card)" strokeWidth="0.5"
                    style={{ transition: "all 0.15s" }} />
          </g>
        );
      })}

      {/* Scan-linje (horisontal sweep) */}
      <line x1="0" y1="0" x2="0" y2="100" stroke="var(--color-signal)" strokeWidth="1.2" opacity="0.7">
        <animate attributeName="x1" values="10;170;10" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="x2" values="10;170;10" dur="3.6s" repeatCount="indefinite" />
      </line>

      {/* Labels */}
      <g fontFamily="var(--font-mono)" fontSize="3" fill="var(--color-ink-soft)" opacity="0.6">
        <text x="18" y="93" style={flip ? { transform: "scaleX(-1)", transformOrigin: "20px 93px" } : {}}>hæl</text>
        <text x="148" y="93" style={flip ? { transform: "scaleX(-1)", transformOrigin: "155px 93px" } : {}}>tæ</text>
      </g>
    </svg>
  );
}
