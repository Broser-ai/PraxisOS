"use client";

import { useEffect, useRef, useState } from "react";
import { scribeTranscript, scribeNote } from "@/lib/mock";

type Line = { who: string; text: string };

export default function Scribe() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [generated, setGenerated] = useState(false);
  const idx = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recording) return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const feed = setInterval(() => {
      if (idx.current < scribeTranscript.length) {
        setLines((l) => [...l, scribeTranscript[idx.current]]);
        idx.current += 1;
      } else {
        clearInterval(feed);
        setTimeout(() => setGenerated(true), 700);
        setRecording(false);
      }
    }, 1400);
    return () => { clearInterval(tick); clearInterval(feed); };
  }, [recording]);

  useEffect(() => { scroller.current?.scrollTo({ top: 9999, behavior: "smooth" }); }, [lines]);

  const start = () => {
    setLines([]); setGenerated(false); setSeconds(0); idx.current = 0; setRecording(true);
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex items-end justify-between">
        <div>
          <div className="kicker">Ambient dokumentation · EU-inferens</div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">AI Scribe</h1>
          <p className="mt-2.5 text-[14px] text-muted">Samtalen bliver til struktureret journal — uden tastatur. Du godkender til sidst.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Capture */}
        <section className="card rise overflow-hidden p-0" style={{ animationDelay: "0.06s" }}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className={`grid h-8 w-8 place-items-center rounded-full ${recording ? "bg-clay/14 text-clay live-dot" : "bg-paper-2 text-muted"}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3"/></svg>
              </span>
              <div>
                <div className="text-[13.5px] font-semibold">Konsultation · Mette L.</div>
                <div className="mono text-[11px] text-faint">{recording ? "Optager…" : generated ? "Færdig" : "Klar"}</div>
              </div>
            </div>
            <div className="mono text-[15px]">{mmss}</div>
          </div>

          {/* waveform */}
          <div className="flex h-16 items-center justify-center gap-1 border-b border-line bg-paper/50 px-5">
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={i}
                className="w-1 rounded-full"
                style={{
                  height: recording ? `${10 + Math.abs(Math.sin(i * 0.9 + seconds)) * 34}px` : "6px",
                  background: recording ? "var(--color-clay)" : "var(--color-line-2)",
                  transition: "height 0.25s ease",
                  opacity: recording ? 0.5 + Math.abs(Math.sin(i + seconds)) * 0.5 : 1,
                }}
              />
            ))}
          </div>

          {/* transcript */}
          <div ref={scroller} className="scrollbar-thin h-[300px] overflow-y-auto px-5 py-4">
            {lines.length === 0 && !recording && (
              <div className="grid h-full place-items-center text-center text-[13px] text-faint">
                <div>
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-paper-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3"/></svg>
                  </div>
                  Tryk «Start optagelse» for at se<br />transskription i realtid.
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {lines.map((l, i) => (
                <div key={i} className="fade-in">
                  <div className={`kicker !text-[9.5px] ${l.who === "Behandler" ? "!text-accent" : "!text-clay"}`}>{l.who}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{l.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t border-line px-5 py-3.5">
            {!recording ? (
              <button onClick={start} className="btn btn-primary flex-1 justify-center">
                <span className="h-2 w-2 rounded-full bg-clay" /> {generated ? "Optag igen" : "Start optagelse"}
              </button>
            ) : (
              <button onClick={() => setRecording(false)} className="btn btn-ghost flex-1 justify-center">Stop</button>
            )}
          </div>
        </section>

        {/* Generated note */}
        <section className="card rise p-5" style={{ animationDelay: "0.12s" }}>
          <div className="flex items-center justify-between">
            <h2 className="display text-[16px] font-semibold">Genereret journal</h2>
            <span className={`chip ${generated ? "!border-signal/40 text-signal" : "text-faint"}`}>
              {generated ? "Klar til godkendelse" : "Afventer optagelse"}
            </span>
          </div>

          {!generated ? (
            <div className="mt-4 flex flex-col gap-3">
              {[68, 90, 55, 80].map((w, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-24 rounded bg-paper-2" />
                  <div className="h-3 rounded bg-paper-2" style={{ width: `${w}%`, opacity: recording ? 0.9 : 0.5 }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3.5">
              {([
                ["S · Subjektivt", scribeNote.subjective],
                ["O · Objektivt", scribeNote.objective],
                ["A · Vurdering", scribeNote.assessment],
                ["P · Plan", scribeNote.plan],
              ] as const).map(([h, t], i) => (
                <div key={h} className="fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="kicker !text-accent">{h}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{t}</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                {scribeNote.codes.map((c) => (
                  <span key={c} className="chip mono !text-[11px]">{c}</span>
                ))}
              </div>
              <div className="mt-1 flex gap-2">
                <button className="btn btn-primary flex-1 justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
                  Godkend & gem
                </button>
                <button className="btn btn-ghost">Rediger</button>
              </div>
              <p className="text-center text-[11px] text-faint">Intet gemmes i journalen uden din godkendelse · fuld revisions-log</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
