"use client";

// PraxisOS · Adaptive E-Learning UI (EPIC 4)
// Chat-grænseflade mod Reflexion Tutor + sidebar med læringsstier.

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type LearningTrack = {
  id: string;
  name: string;
  icon: string;
  description: string;
  tags: string[];
  articles: number;
};

const TRACKS: LearningTrack[] = [
  {
    id: "anatomi",
    name: "Anatomi",
    icon: "🦴",
    description: "Fodens knogler, muskler og seneforløb",
    tags: ["basis", "biomekanik", "gang"],
    articles: 8,
  },
  {
    id: "fysiologi",
    name: "Fysiologi",
    icon: "🫀",
    description: "Perfusion, muskelaktivering, gangcyklus",
    tags: ["gang", "biomekanik", "perfusion"],
    articles: 6,
  },
  {
    id: "sygdomslaere",
    name: "Sygdomslære",
    icon: "🩺",
    description: "Hallux valgus, callus, diabetisk fod",
    tags: ["hallux_valgus", "callus", "diabetes", "forebyggelse"],
    articles: 12,
  },
  {
    id: "orthotics",
    name: "Ortopædisk indlæg",
    icon: "🩴",
    description: "Design, materiale, tilvænning",
    tags: ["ortose", "tilvænning", "praktisk"],
    articles: 5,
  },
  {
    id: "praktisk-fodpleje",
    name: "Praktisk fodpleje",
    icon: "🧴",
    description: "Daglig pleje, tørhed, negle",
    tags: ["fodpleje", "forebyggelse", "hyperkeratose"],
    articles: 9,
  },
];

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  iterations?: number;
  meta?: string;
};

export default function LearningPage(): React.ReactElement {
  const [selectedTrack, setSelectedTrack] = useState<LearningTrack>(TRACKS[2]!);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hej — jeg er PraxisOS Adaptive Tutor. Stil et spørgsmål om fodpleje, biomekanik eller behandlings-principper. Jeg svarer med evidens-baserede kilder.",
      meta: "system-intro",
    },
  ]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const suggestions = useMemo(() => trackSuggestions(selectedTrack), [selectedTrack]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/v1/bypilar/learning/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: "da",
          tags: selectedTrack.tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `[fejl] ${data.error ?? "ukendt"} — ${data.message ?? ""}`,
            meta: "error",
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.answer_md ?? "(intet svar)",
            citations: data.citations ?? [],
            iterations: data.iterations,
          },
        ]);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `[network-fejl] Kunne ikke nå tutor-endpoint: ${(e as Error).message}`,
          meta: "error",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-[1200px] mx-auto p-4 lg:p-6">
        <header className="mb-5">
          <p className="text-[11px] uppercase tracking-widest text-neutral-500">
            PraxisOS · Adaptive Learning
          </p>
          <h1 className="text-2xl font-semibold mt-1">Reflexion Tutor</h1>
          <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
            Personaliseret læring via Reflexion-loop (max 3 iterationer) mod
            evidens-baseret korpus. Alle svar redagteres for CPR før de sendes til LLM.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-5">
          {/* Sidebar */}
          <aside className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2 px-1">
              Læringsstier
            </p>
            {TRACKS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTrack(t)}
                className={
                  "w-full text-left px-3 py-2.5 rounded-lg border transition " +
                  (selectedTrack.id === t.id
                    ? "bg-emerald-400/10 border-emerald-400/50 text-emerald-50"
                    : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-200")
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{t.icon}</span>
                  <span className="font-medium text-sm">{t.name}</span>
                  <span className="ml-auto text-[10px] text-neutral-500 tabular-nums">
                    {t.articles}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {t.description}
                </p>
              </button>
            ))}
          </aside>

          {/* Chat panel */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[560px]">
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
              <span className="text-lg">{selectedTrack.icon}</span>
              <div>
                <p className="text-sm font-medium">{selectedTrack.name}</p>
                <p className="text-[11px] text-neutral-500">
                  RAG-korpus: {selectedTrack.tags.join(", ")}
                </p>
              </div>
              <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-400/80">
                Reflexion · max 3 iter
              </span>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            >
              {messages.map((m, i) => (
                <ChatBubble key={i} msg={m} />
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-neutral-500 text-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Tutor tænker · reflexion in progress…
                </div>
              )}
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-neutral-800 hover:border-neutral-600 text-neutral-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="px-4 py-3 border-t border-neutral-800 flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Spørg om ${selectedTrack.name.toLowerCase()}…`}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-neutral-950 font-semibold px-4 text-sm transition"
              >
                Send
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: Message }): React.ReactElement {
  const isUser = msg.role === "user";
  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm " +
          (isUser
            ? "bg-emerald-500 text-neutral-950"
            : msg.meta === "error"
              ? "bg-red-900/40 border border-red-500/40 text-red-100"
              : "bg-neutral-800 border border-neutral-700 text-neutral-100")
        }
      >
        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-neutral-700/50 text-[11px] text-neutral-400">
            <span className="uppercase tracking-widest text-neutral-500">
              Kilder
            </span>
            <ul className="mt-1 space-y-0.5">
              {msg.citations.map((c, i) => (
                <li key={i}>
                  <a
                    href={c}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-neutral-600 hover:decoration-emerald-400"
                  >
                    {c.replace(/^https?:\/\//, "").substring(0, 50)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {msg.iterations && msg.iterations > 1 && (
          <div className="mt-1 text-[10px] text-neutral-500 uppercase tracking-widest">
            Reflexion · {msg.iterations} iterationer
          </div>
        )}
      </div>
    </div>
  );
}

function trackSuggestions(track: LearningTrack): string[] {
  switch (track.id) {
    case "anatomi":
      return [
        "Hvad er plantar fascia?",
        "Beskriv fodens muskler",
        "Hvor mange knogler er der i foden?",
      ];
    case "fysiologi":
      return [
        "Hvordan fungerer gangens 3 faser?",
        "Hvad er pronation?",
      ];
    case "sygdomslaere":
      return [
        "Hvad er hallux valgus?",
        "Hvordan opstår callus?",
        "Diabetisk fodpleje — daglige tjek?",
      ];
    case "orthotics":
      return [
        "Hvordan tilvænner jeg mig et nyt indlæg?",
        "Hvornår skal jeg have nye orthotics?",
      ];
    case "praktisk-fodpleje":
      return [
        "Hvor ofte skal jeg klippe negle?",
        "Bedste creme mod tør hud?",
      ];
    default:
      return ["Hvor starter jeg?"];
  }
}
