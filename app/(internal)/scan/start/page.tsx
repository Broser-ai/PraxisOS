"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Stage = 0 | 1 | 2 | 3 | 4;
const STAGES = [
  { label: "Klargør patient", desc: "Patient barfodet på pad · neutral stilling" },
  { label: "Kalibrér sensorer", desc: "Pressure-pad nul-justering · IR-kamera tracking lock" },
  { label: "Live scanning", desc: "Struktureret lys · 12 frames/s · 312k punkter" },
  { label: "AI-analyse", desc: "3-agent swarm syntese · klinisk plausibilitet" },
  { label: "Klinisk rapport", desc: "Resultater klar · gem til journal eller send til kunde" },
];

export default function FodScanStart() {
  const [stage, setStage] = useState<Stage>(0);
  const [progress, setProgress] = useState(0);
  const [auto, setAuto] = useState(false);
  const [log, setLog] = useState<{ t: string; msg: string; lvl: string }[]>([]);
  const [points, setPoints] = useState(0);
  const startedAt = useRef<number | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const elapsed = () => {
    if (!startedAt.current) return "00:00";
    const s = Math.floor((Date.now() - startedAt.current) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const logLine = (msg: string, lvl: string = "info") => {
    const t = new Date().toISOString().slice(11, 23);
    setLog((l) => [{ t, msg, lvl }, ...l].slice(0, 80));
  };

  const stop = () => {
    if (ticker.current) { clearInterval(ticker.current); ticker.current = null; }
    setAuto(false);
  };

  const reset = () => {
    stop();
    setStage(0); setProgress(0); setPoints(0); setLog([]);
    startedAt.current = null;
  };

  const begin = () => {
    reset();
    startedAt.current = Date.now();
    setAuto(true);
    setStage(1);
    setProgress(0);
    logLine("sensor.calibrate · pressure-pad nul-justering", "sensor");
  };

  // Auto-progression tick
  useEffect(() => {
    if (!auto) return;
    ticker.current = setInterval(() => {
      setProgress((p) => {
        const next = p + (stage === 2 ? 1.4 : stage === 3 ? 1.1 : 2.2);
        if (next >= 100) {
          // advance stage
          setStage((s) => {
            const ns = Math.min(4, s + 1) as Stage;
            if (ns === 2) logLine("ingress.scan_start · 12 fps · 4 sensorer aktive", "agent.ingress");
            if (ns === 3) { logLine("scan.complete · 312.412 punkter capturet", "ok"); logLine("agent.pod · topologi-mesh genereres", "agent.pod"); }
            if (ns === 4) {
              logLine("agent.pod · hallux valgus L=12.1° R=18.4°", "agent.pod");
              logLine("agent.diag · termisk hotspot MTP 5 (R) +1.4°C", "agent.diag");
              logLine("agent.diag · klinisk anbefaling: metatarsal-pad · opfølgning 6 uger", "ok");
              setAuto(false);
            }
            return ns;
          });
          return 0;
        }
        return next;
      });
      // simuler point cloud-vækst i stage 2
      if (stage === 2) setPoints((p) => Math.min(312412, p + Math.floor(2200 + Math.random() * 2400)));
    }, 80);
    return () => { if (ticker.current) clearInterval(ticker.current); };
  }, [auto, stage]);

  return (
    <div className="mx-auto max-w-[1320px]">
      {/* Header */}
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker flex items-center gap-1.5">
            <Link href="/scan" className="hover:underline">Fod-scan</Link>
            <span>·</span><span>nyt scan</span>
          </div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Live scanning</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Mette L. · Booking #bk_3f91 · Behandler: Dr. Krarup
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip mono !text-[10.5px]">forløb · {elapsed()}</span>
          {stage < 4 && !auto && stage === 0 && (
            <button onClick={begin} className="btn btn-primary">
              <span className="h-2 w-2 rounded-full bg-clay live-dot" /> Start scanning
            </button>
          )}
          {auto && (
            <button onClick={stop} className="btn btn-ghost">Pause</button>
          )}
          {!auto && stage > 0 && stage < 4 && (
            <button onClick={() => setAuto(true)} className="btn btn-primary">Fortsæt</button>
          )}
          {stage === 4 && (
            <>
              <button onClick={reset} className="btn btn-ghost">Nyt scan</button>
              <Link href="/scan" className="btn btn-primary">Se fuld rapport →</Link>
            </>
          )}
        </div>
      </div>

      {/* Stage rail */}
      <div className="rise mt-6">
        <div className="grid grid-cols-5 gap-1.5">
          {STAGES.map((s, i) => {
            const active = stage === i;
            const done = stage > i;
            return (
              <div key={s.label} className="relative">
                <div
                  className="card flex items-start gap-2.5 p-3 transition-all"
                  style={{
                    borderColor: active ? "var(--color-ink)" : done ? "color-mix(in srgb, var(--color-signal) 50%, transparent)" : undefined,
                    background: done ? "color-mix(in srgb, var(--color-signal) 6%, var(--color-card))" : undefined,
                  }}
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold mono"
                    style={{
                      background: done ? "var(--color-signal)" : active ? "var(--color-ink)" : "var(--color-paper-2)",
                      color: done || active ? "var(--color-paper)" : "var(--color-muted)",
                    }}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold leading-tight">{s.label}</div>
                    <div className="text-[10.5px] text-muted leading-snug mt-0.5">{s.desc}</div>
                  </div>
                </div>
                {/* Progress-bar under aktivt trin */}
                {active && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-paper-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--color-accent)" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hovedindhold afhænger af stage */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Venstre — scene */}
        <section className="card rise p-5 min-h-[460px]" style={{ animationDelay: "0.06s" }}>
          {stage === 0 && <StageReady onStart={begin} />}
          {stage === 1 && <StageCalibrate progress={progress} />}
          {stage === 2 && <StageScanning points={points} progress={progress} />}
          {stage === 3 && <StageAnalysing progress={progress} />}
          {stage === 4 && <StageDone />}
        </section>

        {/* Højre — live log */}
        <section className="card rise overflow-hidden p-0" style={{ animationDelay: "0.10s" }}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div>
              <h2 className="display text-[15px] font-semibold">Trace</h2>
              <div className="kicker !text-[9px]">kryptografisk sequence-id pr. linje</div>
            </div>
            <span className="chip mono !text-[10px]">live</span>
          </div>
          <div className="scrollbar-thin h-[420px] overflow-y-auto px-5 py-3 mono text-[10.5px]">
            {log.length === 0 && (
              <div className="grid h-full place-items-center text-center text-faint">
                Ingen aktivitet endnu —<br />tryk «Start scanning» for at begynde.
              </div>
            )}
            {log.map((l, i) => (
              <div key={i} className="grid grid-cols-[90px_120px_1fr] items-baseline gap-2 py-0.5">
                <span className="text-faint">{l.t}</span>
                <span className={
                  l.lvl === "ok" ? "text-signal" :
                  l.lvl.includes("pod") ? "text-clay" :
                  l.lvl.includes("diag") ? "text-amber" :
                  l.lvl.includes("ingress") || l.lvl === "sensor" ? "text-accent" : "text-muted"
                }>{l.lvl}</span>
                <span className="text-ink-soft">{l.msg}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// -------------------- STAGE COMPONENTS --------------------

function StageReady({ onStart }: { onStart: () => void }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="max-w-[420px]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-paper-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <path d="M9 2c-2 0-3 2-3 5 0 2 1 3 1 5s-1 4-1 6c0 2 1 4 3 4s3-2 3-4-1-2-1-4c0-3 1-5 1-7 0-3-1-5-3-5z" />
          </svg>
        </div>
        <h2 className="display mt-4 text-[22px] font-semibold leading-tight">Klar til scanning</h2>
        <p className="mt-2 text-[13px] text-muted leading-relaxed">
          Patient stiller sig barfodet på pad'en i neutral stilling. Tryk start når patienten står stille.
          Scanningen tager ca. 30 sekunder.
        </p>
        <ul className="mt-5 inline-flex flex-col items-start gap-2 text-[12.5px] text-ink-soft">
          {["Begge fødder skal være på pad'en", "Vægten ligeligt fordelt", "Patienten kigger ligeud", "Armene afslappet ned langs siden"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-signal/14 text-signal">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
              </span>
              {t}
            </li>
          ))}
        </ul>
        <button onClick={onStart} className="btn btn-primary mt-6 !px-6">
          <span className="h-2 w-2 rounded-full bg-clay live-dot" />
          Start scanning
        </button>
      </div>
    </div>
  );
}

function StageCalibrate({ progress }: { progress: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="relative">
        {/* Animeret koncentriske ringe */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 m-auto h-32 w-32 rounded-full border-2"
            style={{
              borderColor: "color-mix(in srgb, var(--color-accent) 40%, transparent)",
              animation: `pulse-ring 2s ${i * 0.5}s ease-out infinite`,
              opacity: 0,
            }}
          />
        ))}
        <div className="relative grid h-32 w-32 place-items-center rounded-full bg-accent/14">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        </div>
      </div>
      <h2 className="display mt-8 text-[22px] font-semibold">Kalibrerer sensorer…</h2>
      <p className="mt-2 text-[13px] text-muted">Pressure-pad nul-justering · IR-tracking lock · ultralyd-probe ready</p>

      <div className="mt-5 grid w-full max-w-[420px] grid-cols-4 gap-2">
        {["Pad", "Lys", "IR", "UL"].map((s, i) => {
          const done = progress > (i + 1) * 20;
          return (
            <div key={s} className="rounded-[8px] border border-line bg-paper p-2 text-center">
              <div className="kicker !text-[8.5px]">{s}</div>
              <div className="mt-1 text-[11px] mono" style={{ color: done ? "var(--color-signal)" : "var(--color-faint)" }}>
                {done ? "OK" : "…"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageScanning({ points, progress }: { points: number; progress: number }) {
  // Trefase-progress: 0-33% top, 33-66% side, 66-100% bund
  const topProgress = Math.min(100, (progress / 33) * 100);
  const sideProgress = Math.max(0, Math.min(100, ((progress - 33) / 33) * 100));
  const bottomProgress = Math.max(0, Math.min(100, ((progress - 66) / 34) * 100));
  const activeView = progress < 33 ? "top" : progress < 66 ? "side" : "bottom";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display text-[18px] font-semibold">Live scanning</h2>
          <div className="kicker !text-[9px]">struktureret lys · pressure-pad · termisk · ultralyd</div>
        </div>
        <div className="text-right">
          <div className="mono text-[16px] font-semibold">{points.toLocaleString("da-DK")}</div>
          <div className="kicker !text-[9px]">punkter capturet</div>
        </div>
      </div>

      {/* 3-fase view-indicator */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[
          { id: "top", label: "TOP · dorsal", prog: topProgress },
          { id: "side", label: "SIDE · profil", prog: sideProgress },
          { id: "bottom", label: "BUND · plantar", prog: bottomProgress },
        ].map((p) => (
          <div
            key={p.id}
            className="rounded-[8px] border bg-paper p-2"
            style={{
              borderColor: activeView === p.id ? "var(--color-accent)" : p.prog >= 100 ? "color-mix(in srgb, var(--color-signal) 50%, transparent)" : "var(--color-line)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="kicker !text-[8.5px]">{p.label}</span>
              <span className="mono text-[9.5px]" style={{
                color: p.prog >= 100 ? "var(--color-signal)" : activeView === p.id ? "var(--color-accent)" : "var(--color-faint)",
              }}>
                {p.prog >= 100 ? "✓" : `${Math.round(p.prog)}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-paper-2">
              <div className="h-full rounded-full transition-all" style={{
                width: `${p.prog}%`,
                background: p.prog >= 100 ? "var(--color-signal)" : "var(--color-accent)",
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Multi-angle scan visualisation */}
      <div className="relative mt-3 flex-1 overflow-hidden rounded-[12px] border border-line bg-paper-2">
        <svg viewBox="0 0 400 280" className="h-full w-full">
          <defs>
            <radialGradient id="cloud-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="200" cy="140" rx="180" ry="120" fill="url(#cloud-glow)" />

          {/* TOP view (fra oven) — venstre kolonne */}
          <g opacity={activeView === "top" ? 1 : 0.35} style={{ transition: "opacity 0.5s" }}>
            <text x="60" y="25" fontSize="9" fill="var(--color-faint)" fontFamily="var(--font-mono)">TOP</text>
            {[60, 130].map((cx, i) => (
              <g key={i}>
                <path
                  d={`M${cx} 45 C ${cx + 16} 45 ${cx + 22} 60 ${cx + 22} 95 C ${cx + 22} 130 ${cx + 18} 165 ${cx + 16} 200 C ${cx + 14} 230 ${cx + 8} 245 ${cx} 245 C ${cx - 8} 245 ${cx - 14} 230 ${cx - 16} 200 C ${cx - 18} 165 ${cx - 22} 130 ${cx - 22} 95 C ${cx - 22} 60 ${cx - 16} 45 ${cx} 45 Z`}
                  fill="var(--color-card)" stroke="var(--color-line-2)" strokeWidth="0.6"
                />
                {Array.from({ length: 40 }).map((_, j) => {
                  const visible = (j / 40) < (topProgress / 100);
                  if (!visible) return null;
                  const angle = (j * 0.6) * Math.PI;
                  const r = 4 + ((j * 7) % 16);
                  return (
                    <circle key={j} cx={cx + Math.cos(angle) * r} cy={50 + ((j * 23) % 195)} r={0.7} fill="var(--color-accent)" opacity={0.6} />
                  );
                })}
              </g>
            ))}
          </g>

          {/* SIDE view (profil) — midten */}
          <g opacity={activeView === "side" ? 1 : 0.35} style={{ transition: "opacity 0.5s" }}>
            <text x="170" y="25" fontSize="9" fill="var(--color-faint)" fontFamily="var(--font-mono)">SIDE</text>
            {[60, 145].map((cy, i) => (
              <g key={i}>
                <path
                  d={`M 175 ${cy + 50} Q 173 ${cy + 40} 178 ${cy + 32} Q 188 ${cy + 18} 210 ${cy + 12} L 235 ${cy + 14} Q 260 ${cy + 17} 275 ${cy + 22} L 282 ${cy + 32} L 280 ${cy + 50} Z`}
                  fill="var(--color-card)" stroke="var(--color-line-2)" strokeWidth="0.6"
                />
                {Array.from({ length: 30 }).map((_, j) => {
                  const visible = (j / 30) < (sideProgress / 100);
                  if (!visible) return null;
                  return (
                    <circle key={j} cx={180 + (j * 3.5) % 100} cy={cy + 15 + ((j * 11) % 30)} r={0.7} fill="var(--color-accent)" opacity={0.6} />
                  );
                })}
              </g>
            ))}
          </g>

          {/* BOTTOM view (plantar) — højre */}
          <g opacity={activeView === "bottom" ? 1 : 0.35} style={{ transition: "opacity 0.5s" }}>
            <text x="305" y="25" fontSize="9" fill="var(--color-faint)" fontFamily="var(--font-mono)">BUND</text>
            {[315, 365].map((cx, i) => (
              <g key={i}>
                <path
                  d={`M${cx} 45 C ${cx + 11} 45 ${cx + 15} 60 ${cx + 15} 95 C ${cx + 15} 130 ${cx + 13} 160 ${cx + 11} 195 C ${cx + 10} 225 ${cx + 6} 245 ${cx} 245 C ${cx - 6} 245 ${cx - 10} 225 ${cx - 11} 195 C ${cx - 13} 160 ${cx - 15} 130 ${cx - 15} 95 C ${cx - 15} 60 ${cx - 11} 45 ${cx} 45 Z`}
                  fill="var(--color-card)" stroke="var(--color-line-2)" strokeWidth="0.6"
                />
                {Array.from({ length: 30 }).map((_, j) => {
                  const visible = (j / 30) < (bottomProgress / 100);
                  if (!visible) return null;
                  const angle = j * 0.7;
                  return (
                    <circle key={j} cx={cx + Math.cos(angle) * (3 + (j % 10))} cy={55 + ((j * 19) % 185)} r={0.7} fill="var(--color-clay)" opacity={0.7} />
                  );
                })}
              </g>
            ))}
          </g>

          {/* Scan-bjælke (kun på aktiv view) */}
          {activeView === "top" && (
            <line x1="20" y1="0" x2="180" y2="0" stroke="var(--color-signal)" strokeWidth="1.5" opacity="0.85">
              <animate attributeName="y1" values="40;250;40" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="y2" values="40;250;40" dur="1.8s" repeatCount="indefinite" />
            </line>
          )}
          {activeView === "side" && (
            <line x1="0" y1="40" x2="0" y2="240" stroke="var(--color-signal)" strokeWidth="1.5" opacity="0.85">
              <animate attributeName="x1" values="175;285;175" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="x2" values="175;285;175" dur="1.8s" repeatCount="indefinite" />
            </line>
          )}
          {activeView === "bottom" && (
            <line x1="290" y1="0" x2="395" y2="0" stroke="var(--color-signal)" strokeWidth="1.5" opacity="0.85">
              <animate attributeName="y1" values="40;250;40" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="y2" values="40;250;40" dur="1.8s" repeatCount="indefinite" />
            </line>
          )}
        </svg>

        <div className="absolute bottom-3 left-3 chip mono !text-[10px] !bg-card">12 fps · 0.7ms p99</div>
        <div className="absolute bottom-3 right-3 chip mono !text-[10px] !bg-card">{Math.round(progress)}% af 3 vinkler</div>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 chip mono !text-[10px] !bg-card !border-accent/40">
          <span className="text-accent">scanner {activeView === "top" ? "OVERSIDE" : activeView === "side" ? "PROFIL" : "PLANTAR"}</span>
        </div>
      </div>

      {/* Sensor-status nederst */}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[
          { l: "Struktureret lys", k: `${(312 * progress / 100).toFixed(0)}k pts` },
          { l: "Pressure-pad", k: activeView === "bottom" || progress > 66 ? `${Math.round(bottomProgress * 1.84)} kPa avg` : "venter" },
          { l: "Termisk", k: progress > 5 ? `Δ ${(progress * 0.014).toFixed(1)}°C` : "—" },
          { l: "Ultralyd", k: progress > 33 ? "vaskulær OK" : "—" },
        ].map((s) => (
          <div key={s.l} className="rounded-[8px] border border-line bg-paper px-2.5 py-1.5">
            <div className="kicker !text-[8.5px]">{s.l}</div>
            <div className="mono text-[11px] mt-0.5">{s.k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageAnalysing({ progress }: { progress: number }) {
  const agents = [
    { id: "ingress", label: "Ingress · Sensor-orkestrering", status: "done", color: "var(--color-accent)" },
    { id: "pod", label: "Podiatrisk topologi", status: progress > 40 ? "done" : "thinking", color: "var(--color-clay)" },
    { id: "diag", label: "Klinisk syntese", status: progress > 75 ? "thinking" : "queued", color: "var(--color-amber)" },
  ];

  return (
    <div className="flex h-full flex-col">
      <h2 className="display text-[18px] font-semibold">AI-analyse</h2>
      <div className="kicker !text-[9px]">3-agent swarm syntese · sub-mm præcision</div>

      <div className="mt-5 flex flex-col gap-3">
        {agents.map((a, i) => (
          <div
            key={a.id}
            className="rounded-[11px] border bg-paper p-4"
            style={{ borderColor: a.status === "done" ? "color-mix(in srgb, var(--color-signal) 40%, transparent)" : "var(--color-line)" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="relative grid h-9 w-9 place-items-center rounded-full text-[12px] font-semibold text-paper"
                style={{ background: a.color }}
              >
                {a.label.charAt(0)}
                {a.status === "thinking" && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-signal live-dot" />}
              </span>
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold leading-tight">{a.label}</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {a.status === "done" && "Færdig"}
                  {a.status === "thinking" && "Analyserer…"}
                  {a.status === "queued" && "I kø"}
                </div>
              </div>
              <span className={`mono text-[10.5px] ${
                a.status === "done" ? "text-signal" :
                a.status === "thinking" ? "text-accent" : "text-faint"
              }`}>
                {a.status === "done" ? "✓" : a.status === "thinking" ? "●" : "○"}
              </span>
            </div>
            {a.status !== "queued" && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-paper-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${a.status === "done" ? 100 : Math.min(95, (progress * 2.5) % 100)}%`,
                    background: a.color,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-[10px] bg-paper-2 p-3 text-[11.5px] text-muted">
        <span className="mono">tip · </span>
        agenterne kører parallelt og crosschecker hinandens output mod Cosmos 3 world-model
        for klinisk plausibilitet, før resultatet bliver synligt for behandleren.
      </div>
    </div>
  );
}

function StageDone() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-signal/14 text-signal">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
        </span>
        <div>
          <h2 className="display text-[20px] font-semibold leading-tight">Scanning komplet</h2>
          <div className="kicker !text-[9px]">312.412 punkter · 6 zoner · 3 biomarkers flagged</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ["Hallux valgus", "L 12° · R 18°", "mild dx", "warn"],
          ["Plantar peak", "L 184 · R 242 kPa", "overbelastet dx", "warn"],
          ["Termisk", "MTP 5 · +1.4°C", "mild inflam.", "warn"],
          ["Vaskulær flow", "Normal · ankel", "stabil", "ok"],
          ["Mikrocirkulation", "Forfod · −9%", "reduceret dx", "warn"],
          ["Hud-elasticitet", "0.82 (+0.04)", "forbedring", "ok"],
        ].map(([k, v, n, s]) => (
          <div key={k as string} className="rounded-[10px] border border-line bg-paper p-3">
            <div className="kicker !text-[9px]">{k}</div>
            <div className="mt-1 text-[13px] font-semibold">{v}</div>
            <div className={`mt-0.5 mono text-[10px] ${s === "warn" ? "text-clay" : "text-signal"}`}>{n}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[11px] border border-clay/30 bg-clay/[0.06] p-4">
        <div className="kicker !text-clay">Klinisk anbefaling · agent.diag</div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          <b>Asymmetrisk overbelastning af højre forfod.</b> Anbefaler metatarsal-pad,
          udskift sko-indlæg, opfølgning om 6 uger med ny scan.
        </p>
      </div>

      <div className="mt-auto flex gap-2 pt-4">
        <Link href="/scan" className="btn btn-primary flex-1 justify-center">Se fuld rapport →</Link>
        <button className="btn btn-ghost">Send til kunde</button>
      </div>
    </div>
  );
}
