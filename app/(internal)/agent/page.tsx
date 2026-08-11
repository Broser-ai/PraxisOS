"use client";

import { useEffect, useRef, useState } from "react";
import { agentSeed } from "@/lib/mock";

type Msg = { role: string; text: string; card?: boolean };

const suggestions = ["Book medicinsk fodpleje torsdag", "Ombook Per til næste uge", "Hvad koster et fod-scan?", "Send recall til inaktive"];

function render(text: string) {
  // tiny **bold** parser
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>
  );
}

export default function Agent() {
  const [msgs, setMsgs] = useState<Msg[]>(agentSeed);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { scroller.current?.scrollTo({ top: 9999, behavior: "smooth" }); }, [msgs, typing]);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [
        ...m,
        {
          role: "agent",
          text: "Jeg har fundet en passende tid og forberedt det hele. Bekræft, så reserverer jeg og sender en MitID-kvittering. 🔒",
          card: true,
        },
      ]);
    }, 1500);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-150px)] max-w-[860px] flex-col">
      <div className="rise mb-4 flex items-center gap-3">
        <div className="relative grid h-11 w-11 place-items-center rounded-full bg-accent/12 text-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M5 4h14v11H8l-3 3zM9 9h.01M13 9h.01"/></svg>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-signal" />
        </div>
        <div>
          <h1 className="display text-[20px] font-semibold leading-none">Aria</h1>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Autonom · voice + chat · eskalerer til menneske
          </div>
        </div>
        <div className="ml-auto chip">Epic / MedCom-klar</div>
      </div>

      {/* Conversation */}
      <div ref={scroller} className="scrollbar-thin card flex-1 space-y-4 overflow-y-auto p-5">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] ${m.role === "user" ? "" : ""}`}>
              <div
                className={`fade-in rounded-[14px] px-4 py-2.5 text-[13.5px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-ink text-paper"
                    : "border border-line bg-paper text-ink-soft"
                }`}
              >
                {render(m.text)}
              </div>
              {m.card && (
                <div className="fade-in mt-2 overflow-hidden rounded-[14px] border border-accent/30 bg-accent/[0.05]">
                  <div className="flex items-center justify-between border-b border-accent/20 px-4 py-2.5">
                    <span className="kicker !text-accent">Foreslået booking</span>
                    <span className="mono text-[11px] text-accent">45 min</span>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-[14px] font-semibold">Hudanalyse · Dr. Krarup</div>
                    <div className="mono mt-1 text-[12px] text-muted">Torsdag 12. juni · 14:00 · Klinik</div>
                    <div className="mt-3 flex gap-2">
                      <button className="btn btn-primary flex-1 justify-center !py-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
                        Bekræft med MitID
                      </button>
                      <button className="btn btn-ghost !py-2">Andre tider</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-[14px] border border-line bg-paper px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-faint" style={{ animation: `fade 1s ${i * 0.2}s infinite alternate` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggestions + input */}
      <div className="mt-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="chip hover:bg-paper-2">{s}</button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 rounded-[14px] border border-line-2 bg-card p-1.5 pl-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Skriv til Aria…"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
          <button type="button" className="grid h-9 w-9 place-items-center rounded-[10px] text-muted hover:bg-paper-2">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3"/></svg>
          </button>
          <button type="submit" className="grid h-9 w-9 place-items-center rounded-[10px] bg-ink text-paper hover:bg-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
