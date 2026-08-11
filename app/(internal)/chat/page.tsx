"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AGENTS, getAgent, routeMessage, type AgentId } from "@/lib/agents";

type Msg = {
  id: string;
  from: "user" | AgentId;
  text: string;
  at: string;
  routing?: { reason: string; confidence: number };
  cards?: { type: "booking" | "report" | "campaign" | "audit" | "voucher"; data: any }[];
};

const SUGGESTIONS = [
  "Book en hudanalyse til Mette på torsdag",
  "Hvad er status på indberetningen til Aarhus Kommune?",
  "Send recall til klienter der ikke har været her i 6 måneder",
  "Er der noget mistænkeligt i audit-loggen i dag?",
  "Hvad ser cash-flow ud til de næste 30 dage?",
  "Optimér dagens hjemmebesøgs-rute",
  "Skriv SOAP-udkast til Per S.'s sårkontrol",
  "Hvordan har Amira haft det siden sidste session?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "init",
      from: "aria",
      text: "Hej. Jeg er Aria — receptionen for hele PraxisOS-teamet. Skriv hvad du har brug for, så finder jeg den rette agent. Du kan også vælge direkte i sidebar'en til venstre.",
      at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pinnedAgent, setPinnedAgent] = useState<AgentId | null>(null);
  const [typing, setTyping] = useState<AgentId | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 9999, behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Msg = {
      id: "u_" + Math.random().toString(36).slice(2, 9),
      from: "user",
      text,
      at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    // Route → vælg agent
    const route = pinnedAgent
      ? { agent: pinnedAgent, confidence: 1, reason: "fastgjort" }
      : routeMessage(text);

    setTyping(route.agent);

    setTimeout(() => {
      const a = getAgent(route.agent)!;
      const reply = composeReply(a.id, text);
      setMessages((m) => [...m, {
        id: "a_" + Math.random().toString(36).slice(2, 9),
        from: route.agent,
        text: reply.text,
        at: new Date().toISOString(),
        routing: pinnedAgent ? undefined : route,
        cards: reply.cards,
      }]);
      setTyping(null);
    }, 1100 + Math.random() * 800);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-150px)] max-w-[1280px] flex-col">
      <div className="rise mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/agents" className="kicker hover:underline">← Agent-team</Link>
          <h1 className="display mt-1.5 text-[26px] font-semibold leading-none">PraxisOS · samlet chat</h1>
          <p className="mt-1.5 text-[12.5px] text-muted">
            Skriv hvad som helst · vi router automatisk til den rette agent · alt logges i audit-trail
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pinnedAgent && (
            <button
              onClick={() => setPinnedAgent(null)}
              className="chip mono !text-[10px] !border-clay/40 text-clay"
            >
              ⊗ frigør {getAgent(pinnedAgent)?.name}
            </button>
          )}
          <span className="chip mono !text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
            {AGENTS.filter((a) => a.status === "active").length} agenter online
          </span>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[220px_1fr]">
        {/* Agent-sidebar */}
        <aside className="card overflow-y-auto p-2.5">
          <div className="kicker mb-2 px-2">Vælg agent direkte</div>
          <div className="flex flex-col gap-1">
            {AGENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setPinnedAgent(a.id === pinnedAgent ? null : a.id)}
                className="flex items-center gap-2.5 rounded-[8px] p-2 text-left transition-colors hover:bg-paper-2"
                style={pinnedAgent === a.id ? { background: "var(--color-paper-2)", borderLeft: `3px solid ${a.avatarColor}` } : {}}
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-paper"
                  style={{ background: a.avatarColor }}
                >
                  {a.avatarGlyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium leading-tight">{a.name}</div>
                  <div className="text-[10px] text-faint truncate">{a.role.split("·")[0].trim()}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat-pane */}
        <div className="card flex flex-col overflow-hidden p-0">
          <div ref={scroller} className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-4">
              {messages.map((m) => (
                <Message key={m.id} m={m} />
              ))}
              {typing && (
                <div className="flex items-end gap-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-paper"
                    style={{ background: getAgent(typing)?.avatarColor }}
                  >
                    {getAgent(typing)?.avatarGlyph}
                  </span>
                  <div className="rounded-[14px] border border-line bg-paper px-4 py-3">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-faint" style={{ animation: `fade 1s ${i * 0.2}s infinite alternate` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="border-t border-line px-5 py-3">
              <div className="kicker mb-2">Prøv en af disse</div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="chip hover:bg-paper-2 text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-line p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pinnedAgent ? `Skriv til ${getAgent(pinnedAgent)?.name}…` : "Skriv til Praxis-teamet…"}
              className="flex-1 rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 text-[14px] outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={!input}
              className="grid h-10 w-10 place-items-center rounded-[10px] bg-ink text-paper disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Message({ m }: { m: Msg }) {
  const isUser = m.from === "user";
  const agent = isUser ? null : getAgent(m.from);
  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-paper"
        style={{ background: isUser ? "var(--color-ink)" : agent!.avatarColor }}
      >
        {isUser ? "DU" : agent!.avatarGlyph}
      </span>
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isUser && (
          <div className="flex items-center gap-2 text-[10.5px] text-faint">
            <span className="font-medium" style={{ color: agent!.avatarColor }}>{agent!.name}</span>
            <span>· {agent!.role}</span>
            {m.routing && (
              <span className="chip mono !text-[9px] !py-0">
                router → {m.routing.reason} · {(m.routing.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}
        <div
          className={`rounded-[14px] px-4 py-2.5 text-[13.5px] leading-relaxed ${
            isUser
              ? "bg-ink text-paper"
              : "border border-line bg-paper text-ink-soft"
          }`}
        >
          {m.text.split("\n").map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        {m.cards?.map((c, i) => (
          <ActionCard key={i} card={c} agentColor={agent?.avatarColor} />
        ))}
      </div>
    </div>
  );
}

function ActionCard({ card, agentColor }: { card: any; agentColor?: string }) {
  const titles: Record<string, string> = {
    booking: "Foreslået booking",
    report: "Indberetnings-status",
    campaign: "Marketing-kampagne · klar til godkendelse",
    audit: "Audit-fund",
    voucher: "Voucher anvendt",
  };
  return (
    <div className="rounded-[12px] border bg-paper-2/60 p-3" style={{ borderColor: `${agentColor}40` }}>
      <div className="kicker !text-[9px] mb-1.5" style={{ color: agentColor }}>{titles[card.type] || card.type}</div>
      <div className="text-[12px]">
        {Object.entries(card.data).map(([k, v]) => (
          <div key={k} className="flex justify-between border-t border-line/60 py-1 first:border-t-0 first:pt-0">
            <span className="text-faint">{k}</span>
            <span className="mono">{String(v)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <button className="rounded-[7px] bg-ink px-2.5 py-1 text-[10.5px] font-medium text-paper">Godkend</button>
        <button className="rounded-[7px] border border-line-2 px-2.5 py-1 text-[10.5px] text-muted">Justér</button>
      </div>
    </div>
  );
}

// Simuleret agent-svar (i prod: call agent.run() med tool-loop)
function composeReply(agent: AgentId, userText: string): { text: string; cards?: any[] } {
  const lower = userText.toLowerCase();
  switch (agent) {
    case "aria":
      if (lower.includes("book")) {
        return {
          text: "Ja — jeg har kigget på Mettes kalender og Pilar har ledigt torsdag 14:00 og 15:30. Jeg foreslår 14:00 fordi det matcher Mettes mønster fra de sidste 4 fodpleje-sessioner. Bekræft jeg booker?",
          cards: [{ type: "booking", data: { Klient: "Mette L.", Ydelse: "Medicinsk fodpleje", Tid: "tor 12. juni · 14:00", Behandler: "Fodterapeut · Pilar" } }],
        };
      }
      return { text: "Jeg er klar — book fodpleje, fod-scan eller negle, eller spørg ind til journal og SMS. Du kan også klikke direkte på en af de andre i teamet til venstre." };
    case "niels":
      return {
        text: "Jeg har lyttet med på dagens session. Her er udkastet:\n\nS: Patient rapporterer mindre smerte ved gang, god compliance med indlæg, mild ømhed plantart.\nO: Fod-scan viser forbedret plantar trykfordeling. Hyperkeratose reduceret.\nA: Positiv respons på medicinsk fodpleje. Cirkulation tilfredsstillende.\nP: Fortsæt medicinsk fodpleje. Justér indlæg. Genbesøg 3 uger.\n\nForeslår ICD-10 L84. Godkend?",
        cards: [{ type: "voucher", data: { Klient: "Mette L.", Note: "SOAP · fodpleje session 5/8", Ord: 247, Forslag: "ICD L84" } }],
      };
    case "sigrid":
      return {
        text: "Status:\n· rpt_003 (Mette, fod-scan, 238 kr) → EDI sendt til Sygesikringen «danmark» kl. 16:28 · sender\n· rpt_002 (Per, fod-pleje, 495 kr) → KOMBIT-API til Aarhus Kommune · ack modtaget kl. 18:00 · refusion forventet 14. juni\n· rpt_005 afvist (Amira) · medlemskab udløbet 31.05 · vil du have jeg sender en venlig besked?",
        cards: [{ type: "report", data: { Refunderet: "645 kr", "I kø": "1", Afvist: "1", "Forventet udb.": "14. juni" } }],
      };
    case "magnus":
      return {
        text: "Jeg har udkast klar til 6-måneders recall. 14 klienter er i målgruppen — alle med opt-in til marketing. Forslag:\n\n«Hej {fornavn}. Det er 6 måneder siden vi sidst så hinanden — håber alt er godt. Hvis du gerne vil bookes ind, kan du gøre det her: {link}. Ingen rabat, ingen pres — bare et lille hej fra {clinic}. ❤️»\n\nLyder det godt? Jeg sender først efter godkendelse.",
        cards: [{ type: "campaign", data: { Målgruppe: "14 klienter · 180+ dage siden sidst", "Send via": "NemSMS + e-mail", "Forventet response": "21%" } }],
      };
    case "frej":
      return {
        text: "I dag har jeg blokeret 6 mislykkede logins fra 185.220.101.45 (TOR-exit). Ingen succesfulde anomalier. To ting at notere:\n\n1. Pilars konto loggede ind fra ny enhed (iPad · Aarhus) — sandsynligt OK, men jeg verificerede via MitID-claim.\n2. Sofie så journal for Mette L. selvom hun ikke var den bookede behandler — sandsynligvis OK (samme klinik) men jeg har logget hændelsen til patient-indsigt.",
        cards: [{ type: "audit", data: { "Blokerede angreb": "6", "Anomalies": "1", "Patient-indsigts-events": "1", "Falske positiver": "0" } }],
      };
    case "vega":
      return {
        text: "30-dages prognose:\n· Bruttoomsætning: 48.250 kr (sidste 7 dage)\n· Forventet næste 30d: 52.400 kr (+12% YoY)\n· Ubetalte > 14 dage: 3 fakturaer · samlet 1.240 kr\n\nJeg har sendt venlige påmindelser i dag — ingen reaktion endnu. Hvis 2 dage til går uden svar, foreslår jeg telefonopkald (ikke inkasso). OK?",
      };
    case "bjorn":
      return {
        text: "Dagens rute er 4 stop · 15,1 km · 2t 40min total køretid.\n\nJeg har lige re-optimeret: jeg bytter rækkefølgen på stop 2 og 3 fordi der er vejarbejde på Skanderborgvej. Sparet 14 min.\n\nNyt forslag:\n1. 09:00 Per Sørensen (sårkontrol) — 0 km\n2. 10:15 Karl Friis (medicin-tjek) — 7,2 km\n3. 11:30 Inge Mortensen (kompression) — 4,1 km\n4. 13:00 Bodil Hansen (opfølgning) — 3,8 km",
      };
    case "liv":
      return {
        text: "Amira: 4 dage siden vi sidst hørte fra hende. Hendes seneste check-in var 7/10 i humør og 8/10 i compliance med aftenrutinen.\n\nJeg skrev til hende i går morges — hun svarede at hun har lidt udfordringer med arbejdspladsen (stress → kradser i ansigtet). Jeg har ikke gjort mere endnu, men jeg synes Dr. Krarup skal vide det. Skal jeg eskalere?",
      };
    case "atlas":
      return {
        text: "Sidste 24 timer:\n· Ingress-shader genskrevet · −14% memory · ligger i skygge-mode\n· 23 unit-tests genereret for booking-modulet · 100% pass\n· P99 latency på /api/v1/bookings: 84ms → 67ms\n\nIngenting gået i produktion uden review. Klar til at deploy shader-ændringen hvis du godkender.",
      };
    default:
      return { text: "Modtaget — vender tilbage." };
  }
}
