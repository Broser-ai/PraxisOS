"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Stage = "idle" | "capture" | "ratelimit" | "risk" | "trust" | "audit" | "anomaly" | "decision" | "minlog" | "done";

const STAGES: { id: Stage; label: string; desc: string; tech: string; out: string }[] = [
  { id: "capture",    label: "Capture",            desc: "IP · user-agent · geo · session-id",                 tech: "edge-runtime · GeoIP · UA-parsing",      out: "62.198.4.117 · macOS · Aarhus" },
  { id: "ratelimit",  label: "Rate-limit",         desc: "IP + user · sliding window 15 min · exp backoff",     tech: "praxis.rateLimit · in-memory + Redis",    out: "0 forsøg · pass" },
  { id: "risk",       label: "PraxisRisk",         desc: "Score 0-100 · device · velocity · pattern",            tech: "ML-model · 18 features",                  out: "score 12 · low risk" },
  { id: "trust",      label: "PraxisTrust 2",      desc: "MitID / passkey / TOTP step-up beslutning",            tech: "WebAuthn + MitID OIDC",                   out: "skip step-up · trust-cookie" },
  { id: "audit",      label: "Audit-event",        desc: "Append-only · hash-chain · patient-visible",            tech: "Merkle-tree · postgres-append-only",      out: "evt_a3f...91c · 0x7a3f...19c" },
  { id: "anomaly",    label: "Anomaly-detection",  desc: "Impossible travel · new device · TOR · behavioral",    tech: "geo-velocity · device-fingerprint · pattern", out: "ingen anomalier" },
  { id: "decision",   label: "Decision",            desc: "Allow / challenge / block · reason-coded",             tech: "policy-engine · reason-tracking",         out: "ALLOW · trust-window 8t" },
  { id: "minlog",     label: "Min Log opdatering",  desc: "Synkroniser til borger.dk · patientens nationale log", tech: "Sundhedsdatanettet · ack-DK02",            out: "synced · 247 ms" },
];

const LOGIN_CASES = [
  { id: "normal",  label: "Normal login · Pilar",      desc: "MacBook · Aarhus · kendt enhed",         risk: 12, decision: "ALLOW",     trust: "skip" },
  { id: "newdev",  label: "Ny enhed · Sofie",          desc: "iPad · Aarhus · ukendt fingerprint",     risk: 38, decision: "CHALLENGE", trust: "totp" },
  { id: "travel",  label: "Impossible travel",          desc: "Pilar login fra Berlin 14 min efter Aarhus", risk: 78, decision: "BLOCK",    trust: "step-up" },
  { id: "tor",     label: "TOR exit-node",              desc: "185.220.101.45 · ukendt user-agent",     risk: 92, decision: "BLOCK",    trust: "n/a" },
];

export default function FrejEngine() {
  const [activeCase, setActiveCase] = useState(LOGIN_CASES[0].id);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<Set<Stage>>(new Set());
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const caseData = LOGIN_CASES.find((c) => c.id === activeCase)!;

  const start = () => {
    setStage("capture");
    setDone(new Set());
    setProgress(0);
  };
  const reset = () => {
    if (ticker.current) clearInterval(ticker.current);
    setStage("idle");
  };

  useEffect(() => {
    if (stage === "idle" || stage === "done") return;
    const idx = STAGES.findIndex((s) => s.id === stage);
    if (idx === -1) return;
    const duration = stage === "decision" ? 1500 : 1000;
    const start = Date.now();
    ticker.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / duration) * 100));
      if (elapsed >= duration) {
        if (ticker.current) clearInterval(ticker.current);
        setDone((d) => new Set([...d, stage]));
        // Hvis BLOCK, stop ved decision
        if (stage === "decision" && (caseData.decision === "BLOCK")) {
          setStage("done");
          return;
        }
        const next = STAGES[idx + 1]?.id ?? "done";
        setStage(next as Stage);
      }
    }, 60);
    return () => { if (ticker.current) clearInterval(ticker.current); };
  }, [stage, caseData.decision]);

  const decisionColor = caseData.decision === "ALLOW" ? "var(--color-signal)"
                      : caseData.decision === "CHALLENGE" ? "var(--color-amber)"
                      : "var(--color-clay)";

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/agents/frej" className="kicker hover:underline">← Frej</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Compliance-engine</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            8-trins sikkerheds-pipeline · capture → rate-limit → PraxisRisk → PraxisTrust → audit → anomaly → decision → Min Log
          </p>
        </div>
        <div className="flex gap-2">
          {stage === "idle" ? (
            <button onClick={start} className="btn btn-primary">
              <span className="h-2 w-2 rounded-full bg-clay live-dot" /> Kør scenario
            </button>
          ) : (
            <button onClick={reset} className="btn btn-ghost">Nulstil</button>
          )}
        </div>
      </div>

      {/* Scenario-selector */}
      <div className="rise mt-6">
        <div className="kicker mb-2">Vælg scenario at simulere</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          {LOGIN_CASES.map((c) => {
            const isActive = c.id === activeCase;
            const color = c.decision === "ALLOW" ? "var(--color-signal)" : c.decision === "CHALLENGE" ? "var(--color-amber)" : "var(--color-clay)";
            return (
              <button
                key={c.id}
                onClick={() => { setActiveCase(c.id); reset(); }}
                className="card p-3 text-left transition-all"
                style={isActive ? { borderColor: color, background: `color-mix(in srgb, ${color} 6%, var(--color-card))` } : {}}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold">{c.label}</div>
                  <span className="mono text-[10px]" style={{ color }}>{c.risk}</span>
                </div>
                <div className="mt-1 text-[10.5px] text-muted leading-snug">{c.desc}</div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[9px] font-medium" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
                  → {c.decision}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage-rail */}
      <div className="rise mt-3 grid grid-cols-4 gap-1.5 md:grid-cols-8">
        {STAGES.map((s, i) => {
          const isDone = done.has(s.id);
          const isActive = stage === s.id;
          const stopped = stage === "done" && caseData.decision === "BLOCK" && i > 6;
          return (
            <div key={s.id} className="card flex flex-col gap-1 p-2.5 transition-all"
              style={{
                borderColor: isActive ? "var(--color-ink)" : isDone ? "color-mix(in srgb, var(--color-signal) 50%, transparent)" : "var(--color-line)",
                background: isDone ? "color-mix(in srgb, var(--color-signal) 6%, var(--color-card))" : stopped ? "var(--color-paper-2)" : undefined,
                opacity: stopped ? 0.4 : 1,
              }}>
              <div className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold mono"
                  style={{
                    background: isDone ? "var(--color-signal)" : isActive ? "var(--color-ink)" : "var(--color-paper-2)",
                    color: isDone || isActive ? "var(--color-paper)" : "var(--color-muted)",
                  }}>
                  {isDone ? "✓" : stopped ? "—" : i + 1}
                </span>
                <div className="text-[9.5px] font-semibold leading-tight">{s.label}</div>
              </div>
              <div className="text-[8.5px] text-muted leading-snug">{s.desc}</div>
              {isActive && (
                <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-paper-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                </div>
              )}
              {isDone && <div className="mono text-[8px] text-signal mt-0.5">→ {s.out}</div>}
            </div>
          );
        })}
      </div>

      {/* Hovedindhold */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Center */}
        <section className="card rise p-5 min-h-[480px]" style={{ animationDelay: "0.06s" }}>
          {stage === "idle" && (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-[420px]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full text-paper" style={{ background: "#ad7a26" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>
                </div>
                <h2 className="display mt-4 text-[20px] font-semibold">Klar til at køre · {caseData.label}</h2>
                <p className="mt-2 text-[13px] text-muted">{caseData.desc}</p>
                <p className="mt-2 mono text-[11px] text-faint">PraxisRisk forventet: {caseData.risk} · decision: {caseData.decision}</p>
              </div>
            </div>
          )}

          {stage === "capture" && (
            <div>
              <h2 className="display text-[17px] font-semibold">📡 Capture · session-context</h2>
              <div className="kicker !text-[9px] mt-1">edge-runtime · før database-tilgang</div>
              <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
                {[
                  ["IP-adresse",     caseData.id === "travel" ? "84.21.7.211" : caseData.id === "tor" ? "185.220.101.45 (TOR)" : "62.198.4.117"],
                  ["User-agent",     caseData.id === "newdev" ? "Mobile Safari · iPad · iOS 18" : caseData.id === "tor" ? "Tor Browser 12.0" : "Chrome 138 · macOS 14"],
                  ["Geo (MaxMind)",  caseData.id === "travel" ? "Berlin, DE · 14 min efter Aarhus" : caseData.id === "tor" ? "TOR-exit · Romania (ukendt)" : "Aarhus, DK"],
                  ["Session-id",     "sess_" + Math.random().toString(36).slice(2, 12)],
                  ["Trust-cookie",   caseData.id === "normal" ? "1 (eksisterende)" : "0 (ny)"],
                  ["Device-fingerprint", caseData.id === "newdev" ? "ny · ukendt" : caseData.id === "normal" ? "matched · seen 47x" : "ukendt"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[8px] border border-line bg-paper p-2.5">
                    <div className="kicker !text-[8.5px]">{k}</div>
                    <div className="mt-0.5 mono text-[11px]">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stage === "ratelimit" && (
            <div>
              <h2 className="display text-[17px] font-semibold">⏱️ Rate-limit check</h2>
              <div className="kicker !text-[9px] mt-1">sliding window 15 min · exp backoff fra 4. forsøg</div>
              <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
                {[
                  { label: "IP-baseret",   attempts: caseData.id === "tor" ? 47 : 0, threshold: 3, status: caseData.id === "tor" ? "blocked" : "pass" },
                  { label: "User-baseret", attempts: 0, threshold: 5, status: "pass" },
                ].map((r) => (
                  <div key={r.label} className="rounded-[10px] border p-3"
                    style={{ borderColor: r.status === "blocked" ? "var(--color-clay)" : "var(--color-signal)" }}>
                    <div className="kicker">{r.label}</div>
                    <div className="mt-2 mono text-[20px] font-semibold">{r.attempts} / {r.threshold}</div>
                    <div className="mt-1 mono text-[10.5px]" style={{ color: r.status === "blocked" ? "var(--color-clay)" : "var(--color-signal)" }}>
                      {r.status === "blocked" ? "● BLOCKED · 300s backoff" : "● pass"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stage === "risk" && (
            <div>
              <h2 className="display text-[17px] font-semibold">🎯 PraxisRisk · 18-feature ML-score</h2>
              <div className="kicker !text-[9px] mt-1">explainable AI · klart hvilke faktorer der løfter score</div>

              <div className="mt-5 flex items-center justify-center">
                <div className="text-center">
                  <div className="mono text-[64px] font-bold leading-none" style={{ color: caseData.risk > 70 ? "var(--color-clay)" : caseData.risk > 30 ? "var(--color-amber)" : "var(--color-signal)" }}>
                    {caseData.risk}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">af 100 · {caseData.risk > 70 ? "høj risiko" : caseData.risk > 30 ? "mellem" : "lav risiko"}</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="kicker mb-2">Top features · bidrag til score</div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { factor: "Velocity (login-frekvens)",    contrib: caseData.id === "travel" ? 28 : 2 },
                    { factor: "Device-fingerprint match",      contrib: caseData.id === "newdev" ? 18 : caseData.id === "tor" ? 24 : 0 },
                    { factor: "Geo-anomaly",                    contrib: caseData.id === "travel" ? 32 : caseData.id === "tor" ? 22 : 0 },
                    { factor: "TOR/VPN-detection",              contrib: caseData.id === "tor" ? 35 : 0 },
                    { factor: "User-agent reputation",          contrib: caseData.id === "tor" ? 8 : 1 },
                    { factor: "Tid på døgnet",                  contrib: 2 },
                    { factor: "Historisk no-show-rate",         contrib: 1 },
                  ].filter((f) => f.contrib > 0).map((f) => (
                    <div key={f.factor} className="flex items-center gap-3 text-[11.5px]">
                      <span className="w-48 truncate">{f.factor}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2">
                        <div className="h-full rounded-full" style={{ width: `${(f.contrib / 40) * 100}%`, background: f.contrib > 20 ? "var(--color-clay)" : f.contrib > 10 ? "var(--color-amber)" : "var(--color-accent)" }} />
                      </div>
                      <span className="mono w-8 text-right">+{f.contrib}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stage === "trust" && (
            <div>
              <h2 className="display text-[17px] font-semibold">🔐 PraxisTrust 2 · step-up beslutning</h2>
              <div className="kicker !text-[9px] mt-1">WebAuthn passkey · MitID · TOTP · intet</div>
              <div className="mt-5 rounded-[12px] border p-4"
                style={{
                  borderColor: caseData.trust === "skip" ? "var(--color-signal)" : "var(--color-amber)",
                  background: caseData.trust === "skip" ? "color-mix(in srgb, var(--color-signal) 6%, transparent)" : "color-mix(in srgb, var(--color-amber) 6%, transparent)",
                }}>
                <div className="kicker">{caseData.trust === "skip" ? "Skip step-up" : caseData.trust === "n/a" ? "Ikke relevant · BLOCK" : "Step-up påkrævet"}</div>
                <div className="mt-1 text-[14px] font-semibold">
                  {caseData.trust === "skip" && "Trust-cookie er gyldig · risk-score under tærskel"}
                  {caseData.trust === "totp" && "Bed om TOTP-kode · 6 cifre · 30s gyldighed"}
                  {caseData.trust === "step-up" && "Bed om MitID-verifikation · NSIS Substantial"}
                  {caseData.trust === "n/a" && "Ingen trust-mulighed kan redde BLOCK-decision"}
                </div>
                <div className="mt-2 mono text-[10.5px] text-muted">
                  trust_threshold = 25 · current_score = {caseData.risk} · {caseData.risk < 25 ? "skip ✓" : "challenge required"}
                </div>
              </div>
            </div>
          )}

          {stage === "audit" && (
            <div>
              <h2 className="display text-[17px] font-semibold">📒 Audit-event · hash-chained</h2>
              <div className="kicker !text-[9px] mt-1">append-only · Merkle-tree · patient-synlig på Min Log</div>
              <div className="mt-4 rounded-[10px] bg-ink p-4 text-paper text-[10.5px] mono leading-relaxed">
                {`{
  "evt_id": "evt_${Math.random().toString(36).slice(2, 10)}",
  "type": "auth.login_attempt",
  "user_id": "acc_pilar",
  "tenant": "bypilar",
  "ip": "${caseData.id === "tor" ? "185.220.101.45" : "62.198.4.117"}",
  "ua": "${caseData.id === "newdev" ? "iPad · iOS 18" : "Chrome · macOS"}",
  "risk_score": ${caseData.risk},
  "trust_decision": "${caseData.trust}",
  "outcome": "${caseData.decision}",
  "at": "${new Date().toISOString()}",
  "hash": "0x7a3f...19c",
  "prev_hash": "0x4b21...a3d"
}`}
              </div>
              <div className="mt-3 text-[10.5px] text-muted">
                ✓ Tilføjet til append-only audit-log<br/>
                ✓ Patient kan se denne event under "Hvem har set min journal" på borger.dk<br/>
                ✓ Hash-chain forsegler · ingen redigering mulig
              </div>
            </div>
          )}

          {stage === "anomaly" && (
            <div>
              <h2 className="display text-[17px] font-semibold">🔍 Anomaly-detection</h2>
              <div className="kicker !text-[9px] mt-1">4 mønstre · impossible travel · device · TOR · behavioral</div>
              <div className="mt-4 flex flex-col gap-2">
                {[
                  { check: "Impossible travel (>900 km/t)",   triggered: caseData.id === "travel" },
                  { check: "Ny enhed · device-fingerprint",    triggered: caseData.id === "newdev" || caseData.id === "tor" },
                  { check: "TOR / VPN exit-node",               triggered: caseData.id === "tor" },
                  { check: "Behavioral · keystroke-mønster",   triggered: false },
                ].map((a) => (
                  <div key={a.check} className="flex items-center gap-3 rounded-[8px] border border-line bg-paper p-3"
                    style={a.triggered ? { borderColor: "var(--color-clay)", background: "color-mix(in srgb, var(--color-clay) 5%, var(--color-paper))" } : {}}>
                    <span className="grid h-5 w-5 place-items-center rounded-full text-[10px]"
                      style={{ background: a.triggered ? "color-mix(in srgb, var(--color-clay) 14%, transparent)" : "color-mix(in srgb, var(--color-signal) 14%, transparent)", color: a.triggered ? "var(--color-clay)" : "var(--color-signal)" }}>
                      {a.triggered ? "!" : "✓"}
                    </span>
                    <span className="text-[12.5px] flex-1">{a.check}</span>
                    <span className="mono text-[10.5px]" style={{ color: a.triggered ? "var(--color-clay)" : "var(--color-signal)" }}>
                      {a.triggered ? "TRIGGERED" : "ok"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stage === "decision" && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full text-paper"
                style={{ background: decisionColor }}>
                <span className="text-[32px] font-bold">
                  {caseData.decision === "ALLOW" && "✓"}
                  {caseData.decision === "CHALLENGE" && "?"}
                  {caseData.decision === "BLOCK" && "✕"}
                </span>
              </div>
              <h2 className="display mt-5 text-[28px] font-semibold" style={{ color: decisionColor }}>
                {caseData.decision}
              </h2>
              <p className="mt-2 text-[13px] text-muted max-w-[420px]">
                {caseData.decision === "ALLOW" && "Session etableret · trust-cookie sat med 8 timers gyldighed."}
                {caseData.decision === "CHALLENGE" && "Bed om step-up · TOTP eller MitID · audit-event registreret."}
                {caseData.decision === "BLOCK" && "Login afvist · IP forhøjet til ban-liste · forsøget rapporteret til ejer + Datatilsynet hvis relevant."}
              </p>
            </div>
          )}

          {stage === "minlog" && (
            <div>
              <h2 className="display text-[17px] font-semibold">📤 Min Log · synkronisering til borger.dk</h2>
              <div className="kicker !text-[9px] mt-1">borger ser den her event under «Hvem har set min journal»</div>
              <div className="mt-5 rounded-[12px] border border-signal/30 bg-signal/[0.06] p-4">
                <div className="text-[13px] font-semibold">Synkroniseret · 247 ms</div>
                <div className="mt-2 text-[12px] text-muted leading-relaxed">
                  Patientens nationale Min Log er nu opdateret. Patient kan se · hvornår · hvem · hvad · formål.
                  Dette er lovkrav efter EU-Domstolen C-579/21 + Datatilsynet juli 2024.
                </div>
              </div>
            </div>
          )}

          {stage === "done" && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full text-paper" style={{ background: decisionColor }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  {caseData.decision === "ALLOW" && <path d="M5 12l4 4 10-10"/>}
                  {caseData.decision !== "ALLOW" && <path d="M6 6l12 12M18 6L6 18"/>}
                </svg>
              </div>
              <h2 className="display mt-5 text-[22px] font-semibold">Pipeline fuldført</h2>
              <p className="mt-2 text-[13px] text-muted">8 trin · {caseData.decision === "BLOCK" ? "stoppet ved BLOCK · senere trin sprunget over" : "alle gennemført"} · 0 fejl</p>
              <button onClick={start} className="btn btn-ghost mt-5">Kør igen</button>
            </div>
          )}
        </section>

        {/* Sidebar: live metrics */}
        <div className="flex flex-col gap-3">
          <section className="card rise p-4" style={{ animationDelay: "0.12s" }}>
            <h3 className="display text-[14px] font-semibold">Live metrics · 24t</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <Stat l="Login-forsøg" v="847" />
              <Stat l="Allowed"    v="838" color="var(--color-signal)" />
              <Stat l="Challenged" v="7"   color="var(--color-amber)" />
              <Stat l="Blocked"    v="2"   color="var(--color-clay)" />
              <Stat l="Anomalies"  v="1" />
              <Stat l="False-pos"  v="0%"  color="var(--color-signal)" />
            </div>
          </section>

          <section className="card rise p-4" style={{ animationDelay: "0.18s" }}>
            <h3 className="display text-[14px] font-semibold">Auto-respons-policies</h3>
            <div className="mt-3 flex flex-col gap-1.5 text-[11px]">
              {[
                ["risk ≥ 70",      "BLOCK + notify ejer + Datatilsynet"],
                ["risk 35-69",     "CHALLENGE + step-up"],
                ["risk < 35",      "ALLOW"],
                ["TOR exit-node",  "BLOCK · uanset risk"],
                ["Impossible travel", "BLOCK + IP-ban 30 min"],
                ["Ny enhed",       "CHALLENGE + notify bruger"],
              ].map(([k, v]) => (
                <div key={k} className="border-t border-line pt-1.5 first:border-t-0 first:pt-0">
                  <div className="mono text-[10px] text-faint">{k}</div>
                  <div className="text-[11.5px] font-medium">{v}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card rise p-4" style={{ animationDelay: "0.24s" }}>
            <h3 className="display text-[14px] font-semibold">Patient-synlighed</h3>
            <p className="mt-2 text-[11px] text-muted leading-relaxed">
              Hver login-event vises i patientens Min Log på borger.dk hvis det involverer adgang til deres journal · GDPR Art. 15.
            </p>
            <Link href="/t/bypilar/portal#indsigt" className="mt-3 block text-[11px] text-accent hover:underline">
              Se patient-side · «Hvem har set min journal» →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ l, v, color }: { l: string; v: string; color?: string }) {
  return (
    <div className="rounded-[8px] border border-line bg-paper p-2">
      <div className="kicker !text-[8.5px]">{l}</div>
      <div className="mt-0.5 mono text-[14px] font-semibold" style={color ? { color } : {}}>{v}</div>
    </div>
  );
}
