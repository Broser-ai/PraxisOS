"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Stage = "idle" | "lookup" | "eligibility" | "calculate" | "select" | "edi" | "route" | "send" | "ack" | "settle" | "done";

const STAGES: { id: Stage; label: string; desc: string; tech: string; out: string }[] = [
  { id: "lookup",     label: "Profil-opslag",      desc: "Hvilke ordninger er klienten medlem af?",          tech: "patient.subsidy_profile · GDPR Art. 9", out: "3 ordninger fundet" },
  { id: "eligibility",label: "Berettigelses-tjek", desc: "Alder · diagnose · henvisning · årligt loft",        tech: "rule-engine · sundhedsloven §42a",      out: "3 berettigede · 0 udelukket" },
  { id: "calculate",  label: "Beregn beløb",       desc: "Procent / fast sats / cap pr. ordning",              tech: "subsidyRules · SKS-database",            out: "150 + 495 + 421 kr" },
  { id: "select",     label: "Vælg bedste",        desc: "Højeste tilskud · respekt for prioritet",             tech: "bestSubsidy() · klient-godkendelse",      out: "diabetes · 495 kr" },
  { id: "edi",        label: "Generér EDI",        desc: "UN/EDIFACT segmenter · KOMBIT JSON · MedCom XML",     tech: "edifact-builder · DK-D04A subset",        out: "247 bytes signed payload" },
  { id: "route",      label: "Routing-beslutning", desc: "Vælg transport pr. myndighed · sundhedsdatanettet",   tech: "VANS-router · EAN-lookup",                out: "Aarhus K → KOMBIT API" },
  { id: "send",       label: "Send",                desc: "mTLS + HMAC · retry med exponential backoff",         tech: "outbox-pattern · idempotency-key",        out: "HTTP 202 Accepted" },
  { id: "ack",        label: "Vent på kvittering", desc: "Ack-DK02 semantisk · korrelation via tracking-id",     tech: "webhook + polling-fallback",              out: "AAR-2026-DIA-22041" },
  { id: "settle",     label: "Settlement",          desc: "Match refusion mod faktura · bogfør automatisk",      tech: "ledger.match · e-conomic-bro",            out: "+495 kr ind på NemKonto D+2" },
];

const EDI_PAYLOAD = `UNB+UNOC:3+5790000123456:14+5798000362086:14+250608:1042+REF42001'
UNH+1+ATKLIN:D:04A:UN:DK-AAR'
BGM+340+RPT-002-bk_p2+9'
DTM+137:202606081042:203'
NAD+PR+KOMBIT-AAR-DIA::91'
NAD+PT+per-soerensen-cpr-hash::CPRHASH'
RFF+ACE:bk_p2'
RFF+DCP:DIA-FOD-PROTOCOL-2026'
PNA+PAT+:::SØRENSEN:PER:::18'
SEQ++1'
LIN+1++DIA-FOD:91'
QTY+47:1'
PRI+AAB:495.00:CA'
MOA+128:495.00:DKK'
TAX+7+VAT+++:::0+E'
ALI+++++++DIA-AUTH'
UNS+S'
MOA+9:495.00:DKK'
CNT+2:1'
UNT+18+1'
UNZ+1+REF42001'`;

const KOMBIT_PAYLOAD = `{
  "version": "kombit-v2.1",
  "messageId": "msg_2026_06_08_1042_8af3",
  "municipality": "0751",
  "municipalityName": "Aarhus",
  "scheme": "diabetes",
  "trackingId": "AAR-DIA-2026-bk_p2",
  "booking": {
    "id": "bk_p2",
    "service": { "code": "DIA-FOD", "name": "Diabetes-fodpleje" },
    "performedAt": "2026-06-08T10:42:00+02:00"
  },
  "patient": {
    "cprHashed": "sha256:7f3a...19c2",
    "diagnoses": ["E11.9"]
  },
  "amount": { "value": 495, "currency": "DKK" },
  "signedBy": {
    "ean": "5790000567890",
    "role": "fodterapeut",
    "name": "Pilar Mortensen"
  },
  "signature": {
    "alg": "RS256",
    "hash": "a3f792c1..."
  }
}`;

const ROUTE_TABLE = [
  { authority: "Sygesikringen «danmark»",      format: "UN/EDIFACT D04A",  transport: "Sundhedsdatanettet (VANS)", endpoint: "ean://5790000123456" },
  { authority: "Aarhus Kommune",                format: "KOMBIT JSON v2.1", transport: "HTTPS · mTLS + HMAC",        endpoint: "kombit.aarhus.dk/sundhed/refusion" },
  { authority: "Region Midtjylland",            format: "MedCom XML afr01", transport: "Sundhedsdatanettet (VANS)", endpoint: "ean://5790001234567" },
  { authority: "Privat forsikring (Tryg)",      format: "REST JSON",        transport: "HTTPS · OAuth2",             endpoint: "api.tryg.dk/health/claims" },
];

export default function SigridEngine() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<Set<Stage>>(new Set());
  const [showPayload, setShowPayload] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [showAck, setShowAck] = useState(false);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setStage("lookup");
    setDone(new Set());
    setProgress(0);
    setShowPayload(false); setShowRoute(false); setShowAck(false);
  };
  const reset = () => {
    if (ticker.current) clearInterval(ticker.current);
    setStage("idle");
  };

  // Drive flow gennem stages
  useEffect(() => {
    if (stage === "idle" || stage === "done") return;
    const idx = STAGES.findIndex((s) => s.id === stage);
    if (idx === -1) return;

    const duration = stage === "edi" ? 2200 : stage === "ack" ? 2400 : 1300;
    const start = Date.now();
    ticker.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / duration) * 100));
      if (elapsed >= duration) {
        if (ticker.current) clearInterval(ticker.current);
        setDone((d) => new Set([...d, stage]));
        if (stage === "edi") setShowPayload(true);
        if (stage === "route") setShowRoute(true);
        if (stage === "ack") setShowAck(true);
        const nextStage = STAGES[idx + 1]?.id ?? "done";
        setStage(nextStage as Stage);
      }
    }, 60);
    return () => { if (ticker.current) clearInterval(ticker.current); };
  }, [stage]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/agents/sigrid" className="kicker hover:underline">← Sigrid</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Tilskuds-engine</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            9-trins ende-til-ende-flow · fra booking til refusion på klinikkens NemKonto. EDI · MedCom · KOMBIT.
          </p>
        </div>
        <div className="flex gap-2">
          {stage === "idle" ? (
            <button onClick={start} className="btn btn-primary">
              <span className="h-2 w-2 rounded-full bg-clay live-dot" /> Kør pipeline
            </button>
          ) : (
            <button onClick={reset} className="btn btn-ghost">Nulstil</button>
          )}
        </div>
      </div>

      {/* Input-kort */}
      <div className="rise mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card p-4">
          <div className="kicker !text-[9px]">Input · klient</div>
          <div className="mt-1 text-[14px] font-semibold">Per Sørensen</div>
          <div className="mt-1 mono text-[10.5px] text-faint">73 år · CPR ********-3309 · E11.9</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {["danmark_g1", "diabetes", "helbredstillaeg"].map((s) => (
              <span key={s} className="rounded-full border border-line-2 px-1.5 py-0 text-[9px]">{s}</span>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <div className="kicker !text-[9px]">Input · ydelse</div>
          <div className="mt-1 text-[14px] font-semibold">Medicinsk fodpleje</div>
          <div className="mt-1 mono text-[10.5px] text-faint">SKS DIA-FOD · session 4/6</div>
          <div className="mt-2 mono text-[14px] font-semibold">495 kr</div>
        </div>
        <div className="card p-4">
          <div className="kicker !text-[9px]">Forventet output</div>
          <div className="mt-1 text-[14px] font-semibold">Diabetes-tilskud</div>
          <div className="mt-1 text-[10.5px] text-signal">100% dækning · Per betaler 0 kr</div>
          <div className="mt-2 mono text-[11px] text-faint">Aarhus Kommune · KOMBIT-API</div>
        </div>
      </div>

      {/* Stage-rail */}
      <div className="rise mt-3 grid grid-cols-3 gap-1.5 md:grid-cols-9">
        {STAGES.map((s, i) => {
          const isDone = done.has(s.id);
          const isActive = stage === s.id;
          return (
            <div key={s.id} className="card flex flex-col gap-1 p-2.5 transition-all"
              style={{
                borderColor: isActive ? "var(--color-ink)" : isDone ? "color-mix(in srgb, var(--color-signal) 50%, transparent)" : "var(--color-line)",
                background: isDone ? "color-mix(in srgb, var(--color-signal) 6%, var(--color-card))" : undefined,
              }}>
              <div className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold mono"
                  style={{
                    background: isDone ? "var(--color-signal)" : isActive ? "var(--color-ink)" : "var(--color-paper-2)",
                    color: isDone || isActive ? "var(--color-paper)" : "var(--color-muted)",
                  }}>
                  {isDone ? "✓" : i + 1}
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

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Live-output center */}
        <section className="card rise p-5 min-h-[460px]" style={{ animationDelay: "0.06s" }}>
          {stage === "idle" && (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-[420px]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full text-paper" style={{ background: "#3f7d5a" }}>
                  <span className="text-[28px] font-semibold">S</span>
                </div>
                <h2 className="display mt-4 text-[20px] font-semibold">Klar til at køre indberetnings-pipeline</h2>
                <p className="mt-2 text-[13px] text-muted">
                  Sigrid kører 9 trin · 4 myndigheder · 3 protokoller · refusion på 2 bankdage.
                </p>
              </div>
            </div>
          )}

          {stage === "lookup" && (
            <ProfileLookup />
          )}

          {(stage === "eligibility" || stage === "calculate" || stage === "select") && (
            <SubsidyCalculation done={done} />
          )}

          {stage === "edi" && (
            <div className="flex h-full flex-col">
              <h2 className="display text-[17px] font-semibold">📝 Genererer KOMBIT JSON payload</h2>
              <div className="kicker !text-[9px] mt-1">RS256-signeret · EAN-routed · ~247 bytes</div>
              <pre className="scrollbar-thin mt-4 flex-1 overflow-auto rounded-[10px] bg-ink p-4 text-paper text-[10.5px] mono leading-relaxed whitespace-pre-wrap">
{KOMBIT_PAYLOAD}
              </pre>
            </div>
          )}

          {(stage === "route" || stage === "send") && (
            <div className="flex h-full flex-col">
              <h2 className="display text-[17px] font-semibold">🗺️ Routing-tabel · 4 myndigheder</h2>
              <div className="kicker !text-[9px] mt-1">Hver myndighed har sit eget format + transport</div>
              <div className="mt-4 flex-1 overflow-auto">
                <table className="w-full text-[11.5px]">
                  <thead className="text-faint border-b border-line">
                    <tr>
                      {["Myndighed", "Format", "Transport", "Endpoint"].map((h) => (
                        <th key={h} className="kicker pb-2 pr-3 text-left font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROUTE_TABLE.map((r, i) => (
                      <tr key={i} className="border-b border-line/60" style={i === 1 && stage === "send" ? { background: "color-mix(in srgb, var(--color-signal) 10%, transparent)" } : {}}>
                        <td className="py-2 pr-3 font-medium">{r.authority}{i === 1 && stage === "send" && <span className="ml-1 text-signal">●</span>}</td>
                        <td className="py-2 pr-3 mono text-[10.5px]">{r.format}</td>
                        <td className="py-2 pr-3 text-[10.5px] text-muted">{r.transport}</td>
                        <td className="py-2 pr-3 mono text-[9.5px] text-faint">{r.endpoint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {stage === "send" && (
                <div className="mt-3 rounded-[10px] border border-signal/30 bg-signal/[0.06] p-3 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-signal live-dot" />
                    <span className="font-semibold">POST kombit.aarhus.dk/sundhed/refusion</span>
                    <span className="ml-auto mono text-[10px] text-signal">HTTP 202 Accepted</span>
                  </div>
                  <div className="mt-1 mono text-[10px] text-muted">Idempotency-Key: ik-bk_p2-1739019742 · Retry-After: ack</div>
                </div>
              )}
            </div>
          )}

          {stage === "ack" && (
            <div className="flex h-full flex-col">
              <h2 className="display text-[17px] font-semibold">⏳ Venter på kvittering</h2>
              <div className="kicker !text-[9px] mt-1">Ack-DK02 semantisk · webhook + polling-fallback</div>
              <div className="mt-5 flex flex-col gap-2">
                {[
                  { at: "10:42:01.847", lvl: "ok",    msg: "POST sent · tracking-id AAR-DIA-2026-bk_p2" },
                  { at: "10:42:01.912", lvl: "queue", msg: "KOMBIT receipt: queued for processing" },
                  { at: "10:42:04.220", lvl: "ack",   msg: "Initial ACK · message accepted" },
                  { at: "10:42:18.103", lvl: "ok",    msg: "Final ACK · AAR-2026-DIA-22041 · refusion godkendt" },
                ].map((e, i) => (
                  <div key={i} className="grid grid-cols-[90px_1fr] gap-3 border-t border-line py-2 first:border-t-0 first:pt-0">
                    <span className="mono text-[10.5px] text-faint">{e.at}</span>
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        e.lvl === "ok" ? "bg-signal" : e.lvl === "queue" ? "bg-amber" : "bg-accent"
                      }`} />
                      <span className="text-[12px] text-ink-soft">{e.msg}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stage === "settle" && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-signal/14 text-signal">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              </div>
              <h2 className="display mt-4 text-[22px] font-semibold">Settlement</h2>
              <p className="mt-2 text-[13px] text-muted">+495 kr ind på klinikkens NemKonto · D+2 bankdage</p>
              <div className="mt-4 mono text-[10px] text-faint">match · faktura bk_p2 · automatisk bogføring i e-conomic</div>
            </div>
          )}

          {stage === "done" && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-signal/14 text-signal">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
              </div>
              <h2 className="display mt-5 text-[24px] font-semibold">Pipeline fuldført</h2>
              <p className="mt-2 text-[13px] text-muted">9 trin · 12,3 sekunder · 0 fejl · 495 kr indberettet og forventet udbetalt 10. juni</p>
              <button onClick={start} className="btn btn-ghost mt-5">Kør igen</button>
            </div>
          )}
        </section>

        {/* Sidebar: outputs */}
        <div className="flex flex-col gap-3">
          {/* EDI-payload preview */}
          <section className="card rise overflow-hidden p-0" style={{ animationDelay: "0.12s" }}>
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h3 className="display text-[14px] font-semibold">EDI-alternativ</h3>
              <span className={`chip mono !text-[10px] ${showPayload ? "!border-signal/40 text-signal" : "text-faint"}`}>
                {showPayload ? "● klar" : "○"}
              </span>
            </div>
            <div className="p-3">
              {showPayload ? (
                <pre className="scrollbar-thin h-[180px] overflow-auto rounded-[6px] bg-paper-2 p-2 text-[9px] mono leading-relaxed">{EDI_PAYLOAD}</pre>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-[10.5px] text-faint">UN/EDIFACT genereres parallelt for Sygesikringen «danmark»</div>
              )}
              <div className="mt-2 text-[10px] text-faint">UN/EDIFACT D04A · 18 segmenter · 624 bytes</div>
            </div>
          </section>

          {/* Auto-handlinger */}
          <section className="card rise p-4" style={{ animationDelay: "0.18s" }}>
            <h3 className="display text-[14px] font-semibold">Auto-handlinger</h3>
            <div className="mt-3 flex flex-col gap-1.5 text-[11.5px]">
              {[
                ["Notifikation til klinik", "indberetning sendt", done.has("send")],
                ["Patient · ingen handling", "100% dækket · 0 kr at betale", done.has("select")],
                ["Journal-entry oprettet", "audit-stempel · hash-chained", done.has("ack")],
                ["NemKonto-match", "+495 kr forventet 10. juni", done.has("settle")],
                ["Min Log opdateret", "synlig for Per på borger.dk", done.has("ack")],
              ].map(([label, sub, ok], i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full text-[9px] ${ok ? "bg-signal/14 text-signal" : "bg-paper-2 text-faint"}`}>
                    {ok ? "✓" : "○"}
                  </span>
                  <div className="flex-1">
                    <div className={`text-[11.5px] font-medium ${ok ? "" : "text-muted"}`}>{label}</div>
                    <div className="text-[10px] text-faint">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Performance */}
          <section className="card rise p-4" style={{ animationDelay: "0.24s" }}>
            <h3 className="display text-[14px] font-semibold">Performance · 30 dage</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <Stat l="Indberetninger" v="287" />
              <Stat l="Ack-rate" v="99.3%" color="var(--color-signal)" />
              <Stat l="P50 ack-tid" v="14 sek" />
              <Stat l="P99 ack-tid" v="2 min" />
              <Stat l="Auto-fejl-recovery" v="2 retries" />
              <Stat l="Refunderet i alt" v="142.110 kr" color="var(--color-signal)" />
            </div>
          </section>
        </div>
      </div>

      {/* Tech-stack */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.30s" }}>
        <h2 className="display text-[15px] font-semibold">Stack · Sigrid's pipeline</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          {[
            ["Rule-engine", "DK-juridisk vektor-DB", "Retsinformation, sundhedsstyrelsen.dk"],
            ["EDI-builder", "edifact-builder v3.1", "UN/EDIFACT D04A · DK-subset · SDN-validator"],
            ["Routing", "VANS · EAN-lookup", "MedCom EAN-database · Sundhedsdatanettet"],
            ["Outbox", "Postgres-baseret", "idempotency + retries + DLQ"],
            ["Ack-handler", "Webhook + polling", "DK02 semantisk · korrelation via tracking-id"],
            ["Settlement", "ledger.match", "auto-bogføring i Dinero/e-conomic/Billy"],
            ["Min Log", "borger.dk-bro", "patientens nationale audit-log"],
            ["GDPR", "Art. 9 · sundhedsdata", "EU · Frankfurt · 10 års retention"],
          ].map((s) => (
            <div key={s[0]} className="rounded-[10px] border border-line bg-paper p-3">
              <div className="kicker !text-[9px]">{s[0]}</div>
              <div className="mt-1 text-[12px] font-medium">{s[1]}</div>
              <div className="mt-0.5 text-[10px] text-faint">{s[2]}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileLookup() {
  return (
    <div className="flex h-full flex-col">
      <h2 className="display text-[17px] font-semibold">🔍 Profil-opslag</h2>
      <div className="kicker !text-[9px] mt-1">patientProfiles[per] · GDPR Art. 9 · krypteret CPR-hash</div>
      <div className="mt-5 flex flex-col gap-2">
        {[
          { scheme: "danmark_g1",       label: "Sygesikringen «danmark» · Gruppe 1", member: "DK-7332091",     extra: "loft 1.350 kr/år · 300 kr brugt" },
          { scheme: "diabetes",         label: "Diabetes-tilskud · kommunal",          member: "AAR-2024-PS-119", extra: "loft 6 sessioner/år · 2 brugt" },
          { scheme: "helbredstillaeg",  label: "Helbredstillæg · pensionist",          member: "AAR-HT-7301",    extra: "85% sats · ≥65 år ✓" },
        ].map((s) => (
          <div key={s.scheme} className="rounded-[10px] border border-signal/30 bg-signal/[0.06] p-3 flex items-start gap-3">
            <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-signal/14 text-signal">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
            </span>
            <div className="flex-1">
              <div className="text-[12.5px] font-medium">{s.label}</div>
              <div className="mt-0.5 mono text-[10.5px] text-muted">medlem {s.member} · {s.extra}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubsidyCalculation({ done }: { done: Set<string> }) {
  const showCalc = done.has("eligibility");
  const showSelect = done.has("calculate");
  return (
    <div className="flex h-full flex-col">
      <h2 className="display text-[17px] font-semibold">
        {showSelect ? "✓ Bedste tilskud valgt" : showCalc ? "💰 Beregner beløb" : "🔬 Berettigelses-tjek"}
      </h2>
      <div className="kicker !text-[9px] mt-1">
        {showSelect ? "bestSubsidy() · diabetes 100% dækning prioriteres" : showCalc ? "rule-engine kører for hver ordning" : "alder · diagnose · henvisning · årligt loft"}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {[
          { scheme: "Sygesikringen «danmark» G1", calc: "150 kr (fast sats)",                    amount: 150, eligible: true, picked: false },
          { scheme: "Diabetes-tilskud · kommunal", calc: "100% af 495 kr · diagnose E11.9 ✓",   amount: 495, eligible: true, picked: showSelect },
          { scheme: "Helbredstillæg · pensionist", calc: "85% af 495 kr = 421 kr · alder ≥65 ✓", amount: 421, eligible: true, picked: false },
        ].map((s, i) => (
          <div key={i} className="rounded-[10px] border p-3"
            style={{
              borderColor: s.picked ? "var(--color-signal)" : "var(--color-line)",
              background: s.picked ? "color-mix(in srgb, var(--color-signal) 8%, var(--color-paper))" : "var(--color-paper)",
            }}>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium flex-1">{s.scheme}</span>
              {s.picked && <span className="chip mono !text-[10px] !border-signal/40 text-signal">★ valgt</span>}
              <span className="mono text-[14px] font-semibold" style={{ color: s.picked ? "var(--color-signal)" : "var(--color-ink)" }}>
                −{s.amount} kr
              </span>
            </div>
            {showCalc && (
              <div className="mt-1 mono text-[10.5px] text-muted">{s.calc}</div>
            )}
          </div>
        ))}
      </div>
      {showSelect && (
        <div className="mt-4 rounded-[10px] border border-signal/40 bg-signal/[0.06] p-3 text-[12px]">
          <b>Diabetes-tilskud</b> dækker 100% · Per betaler 0 kr · Klinikken modtager 495 kr fra Aarhus Kommune (D+2)
        </div>
      )}
    </div>
  );
}

function Stat({ l, v, color }: { l: string; v: string; color?: string }) {
  return (
    <div className="rounded-[8px] border border-line bg-paper p-2">
      <div className="kicker !text-[8.5px]">{l}</div>
      <div className="mt-0.5 mono text-[13px] font-semibold" style={color ? { color } : {}}>{v}</div>
    </div>
  );
}
