"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { agentSeed } from "@/lib/mock";

type Msg = { role: string; text: string; card?: boolean; meta?: string };

const suggestions = [
  "Book en hudanalyse torsdag",
  "Ombook Per til næste uge",
  "Hvad koster en filler?",
  "Send recall til inaktive",
];

function render(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
  );
}

export default function Agent() {
  const [msgs, setMsgs] = useState<Msg[]>(agentSeed);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 9999, behavior: "smooth" });
  }, [msgs, typing]);

  const send = async (text: string) => {
    if (!text.trim() || typing) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, tenant: "bypilar", autoRoute: true }),
      });
      const json = await res.json();
      const reply = json.reply || json.error || "Ingen svar.";
      const agentId = json.agentId || "aria";
      const mode = json.mode || "?";
      const tools = Array.isArray(json.run?.toolCalls)
        ? json.run.toolCalls.map((t: { name: string }) => t.name).join(", ")
        : "";
      setMsgs((m) => [
        ...m,
        {
          role: "agent",
          text: reply,
          card: /book/i.test(text) && /bk_/i.test(reply),
          meta: `${agentId} · ${mode}${tools ? ` · ${tools}` : ""}`,
        },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "agent", text: "Kunne ikke nå agent-runtime. Tjek at serveren kører." },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-150px)] max-w-[860px] flex-col">
      <div className="rise mb-4 flex items-center gap-3">
        <div className="relative grid h-11 w-11 place-items-center rounded-full bg-accent/12 text-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M5 4h14v11H8l-3 3zM9 9h.01M13 9h.01" />
          </svg>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-signal" />
        </div>
        <div>
          <h1 className="display text-[20px] font-semibold leading-none">Agent-chat</h1>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Live runtime · auto-router ·{" "}
            <Link href="/admin/agents/automation" className="text-accent hover:underline">
              automation
            </Link>
          </div>
        </div>
        <div className="ml-auto chip">Aria + team</div>
      </div>

      <div ref={scroller} className="scrollbar-thin card flex-1 space-y-4 overflow-y-auto p-5">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[78%]">
              <div
                className={`fade-in rounded-[14px] px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-ink text-paper" : "border border-line bg-paper text-ink-soft"
                }`}
              >
                {render(m.text)}
              </div>
              {m.meta && <div className="mono mt-1 text-[10px] text-faint">{m.meta}</div>}
              {m.card && (
                <div className="fade-in mt-2 overflow-hidden rounded-[14px] border border-accent/30 bg-accent/[0.05]">
                  <div className="flex items-center justify-between border-b border-accent/20 px-4 py-2.5">
                    <span className="kicker !text-accent">Booking oprettet</span>
                    <span className="mono text-[11px] text-accent">via Aria</span>
                  </div>
                  <div className="px-4 py-3 text-[13px] text-muted">
                    Se detaljer under bookinger. Påmindelse planlægges af automation-worker.
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
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-faint"
                  style={{ animation: `fade 1s ${i * 0.2}s infinite alternate` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="chip hover:bg-paper-2" disabled={typing}>
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-[14px] border border-line-2 bg-card p-1.5 pl-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Skriv til Aria / team…"
            className="flex-1 bg-transparent text-[14px] outline-none"
          />
          <button type="submit" className="btn btn-primary !py-2" disabled={typing}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
