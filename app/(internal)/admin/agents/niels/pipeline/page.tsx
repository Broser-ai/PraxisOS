"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Stage = "idle" | "recording" | "transcribing" | "ner" | "structuring" | "coding" | "review" | "done";

const STAGES: { id: Stage; label: string; desc: string; tech: string }[] = [
  { id: "recording",    label: "Audio capture",    desc: "Optager samtale · 48kHz · noise-suppression",         tech: "Web Audio API · Opus" },
  { id: "transcribing", label: "Speech-to-text",   desc: "Streaming transkription · speaker diarization",        tech: "Whisper Large V3 · EU-hosted" },
  { id: "ner",          label: "Medicinsk NER",    desc: "Identificerer symptomer, medicin, anatomi, diagnoser", tech: "Clinical BERT · DK fine-tune" },
  { id: "structuring",  label: "SOAP-strukturering", desc: "Organiserer indhold i Subjektivt/Objektivt/Vurdering/Plan", tech: "Mistral Large 3 · medical fine-tune" },
  { id: "coding",       label: "ICD-10 + koder",   desc: "Foreslår diagnose-koder + ydelseskoder",               tech: "Code-RAG · SKS-database" },
  { id: "review",       label: "Behandler-review", desc: "Du retter og godkender · vi rør ikke journalen før",   tech: "Diff-view · audit-log" },
];

// Mock-konsultationen — Mette L.'s session 5
const TRANSCRIPT_SEGMENTS: { speaker: "Behandler" | "Patient"; text: string; entities?: { start: number; end: number; type: string }[] }[] = [
  { speaker: "Behandler", text: "Hej Mette, hvordan har huden været siden sidst?" },
  { speaker: "Patient",   text: "Meget bedre faktisk — rødmen er gået ned, men jeg får stadig lidt tørhed om morgenen.",
    entities: [{ start: 23, end: 30, type: "SYMPTOM" }, { start: 53, end: 60, type: "SYMPTOM" }] },
  { speaker: "Behandler", text: "Det lyder lovende. Lad mig kigge på scanningen… jeg kan se at pigmenteringen i zone 3 er faldet pænt sammenlignet med baseline.",
    entities: [{ start: 65, end: 79, type: "ANATOMY" }] },
  { speaker: "Patient",   text: "Ja, og jeg har været konsekvent med aften-serummet hver dag.",
    entities: [{ start: 36, end: 49, type: "MEDICATION" }] },
  { speaker: "Behandler", text: "Perfekt. Jeg vil gerne trappe retinol op til 0,5 procent, og tilføj en let fugtcreme om morgenen mod tørheden. Vi mødes igen om 3 uger.",
    entities: [{ start: 32, end: 39, type: "MEDICATION" }, { start: 44, end: 56, type: "DOSAGE" }, { start: 71, end: 80, type: "MEDICATION" }] },
];

const NER_TYPES: Record<string, { color: string; label: string }> = {
  SYMPTOM:    { color: "#b9543a", label: "symptom" },
  ANATOMY:    { color: "#2f4a7c", label: "anatomi" },
  MEDICATION: { color: "#3f7d5a", label: "medicin" },
  DOSAGE:     { color: "#ad7a26", label: "dosis" },
  DIAGNOSIS:  { color: "#c46a4a", label: "diagnose" },
};

const SOAP_OUTPUT = {
  S: "Patient rapporterer reduceret rødme og god compliance med aften-serum. Beskriver mild tørhed om morgenen.",
  O: "AR-scan viser fald i pigmentering, zone 3. Rødme +15 vs. baseline. Ingen tegn på irritation.",
  A: "Positiv respons på igangværende protokol. Hudbarriere stabil.",
  P: "Fortsæt LED-protokol. Optrap retinol → 0,5%. Tilføj fugtcreme om morgenen. Genbesøg om 3 uger.",
};

const ICD_SUGGESTIONS = [
  { code: "L70.0", label: "Acne vulgaris", confidence: 0.94, source: "diagnose-historik + symptom-mønster" },
  { code: "L70.8", label: "Andre former for acne", confidence: 0.41, source: "alternativ — usandsynlig" },
  { code: "L73.9", label: "Hud-tilstand uden specifikation", confidence: 0.18, source: "low-conf fallback" },
];

const SKS_SERVICES = [
  { code: "AEST-04", label: "Æstetisk forløb · session 4-8", auto: true },
  { code: "AR-SCAN-FU", label: "AR-scan opfølgning", auto: true },
];

export default function NielsPipeline() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [transcriptIdx, setTranscriptIdx] = useState(0);
  const [characterIdx, setCharacterIdx] = useState(0);
  const [showNer, setShowNer] = useState(false);
  const [showSoap, setShowSoap] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setStage("recording");
    setProgress(0);
    setTranscriptIdx(0);
    setCharacterIdx(0);
    setShowNer(false); setShowSoap(false); setShowCodes(false);
    setRecordTime(0);
  };

  const reset = () => {
    if (ticker.current) clearInterval(ticker.current);
    setStage("idle");
  };

  // Drive flow
  useEffect(() => {
    if (stage === "idle" || stage === "done") return;

    if (stage === "recording") {
      const start = Date.now();
      ticker.current = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        setRecordTime(elapsed);
        setProgress(Math.min(100, (elapsed / 4) * 100));
        if (elapsed >= 4) {
          if (ticker.current) clearInterval(ticker.current);
          setStage("transcribing");
        }
      }, 80);
      return () => { if (ticker.current) clearInterval(ticker.current); };
    }

    if (stage === "transcribing") {
      // Stream segments word-by-word
      const seg = TRANSCRIPT_SEGMENTS[transcriptIdx];
      if (!seg) {
        setStage("ner");
        return;
      }
      ticker.current = setInterval(() => {
        setCharacterIdx((i) => {
          if (i >= seg.text.length) {
            if (ticker.current) clearInterval(ticker.current);
            setTimeout(() => {
              setTranscriptIdx((t) => t + 1);
              setCharacterIdx(0);
            }, 300);
            return seg.text.length;
          }
          return i + 2;
        });
      }, 40);
      return () => { if (ticker.current) clearInterval(ticker.current); };
    }

    if (stage === "ner") {
      setShowNer(true);
      const t = setTimeout(() => setStage("structuring"), 1800);
      return () => clearTimeout(t);
    }

    if (stage === "structuring") {
      setShowSoap(true);
      const t = setTimeout(() => setStage("coding"), 2200);
      return () => clearTimeout(t);
    }

    if (stage === "coding") {
      setShowCodes(true);
      const t = setTimeout(() => setStage("review"), 1800);
      return () => clearTimeout(t);
    }
  }, [stage, transcriptIdx]);

  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/agents/niels" className="kicker hover:underline">← Niels</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">AI-Scribe pipeline</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Fra mikrofon til signeret SOAP-journal på under 60 sekunder. Komplet ende-til-ende deep-dive i Niels' kliniske dokumentations-pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          {stage === "idle" ? (
            <button onClick={start} className="btn btn-primary">
              <span className="h-2 w-2 rounded-full bg-clay live-dot" /> Start demo
            </button>
          ) : (
            <button onClick={reset} className="btn btn-ghost">Nulstil</button>
          )}
        </div>
      </div>

      {/* Pipeline-rail */}
      <div className="rise mt-6 grid grid-cols-3 gap-1.5 md:grid-cols-6">
        {STAGES.map((s, i) => {
          const isDone = stageIndex > i;
          const isActive = stage === s.id;
          return (
            <div key={s.id} className="card flex flex-col gap-1.5 p-3 transition-all"
              style={{
                borderColor: isActive ? "var(--color-ink)" : isDone ? "color-mix(in srgb, var(--color-signal) 50%, transparent)" : "var(--color-line)",
                background: isDone ? "color-mix(in srgb, var(--color-signal) 6%, var(--color-card))" : undefined,
              }}>
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold mono"
                  style={{
                    background: isDone ? "var(--color-signal)" : isActive ? "var(--color-ink)" : "var(--color-paper-2)",
                    color: isDone || isActive ? "var(--color-paper)" : "var(--color-muted)",
                  }}>
                  {isDone ? "✓" : i + 1}
                </span>
                <div className="text-[10.5px] font-semibold leading-tight flex-1">{s.label}</div>
              </div>
              <div className="text-[9.5px] text-muted leading-snug">{s.desc}</div>
              <div className="mono text-[8.5px] text-faint leading-snug">{s.tech}</div>
            </div>
          );
        })}
      </div>

      {/* Hovedindhold afhænger af stage */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Hovedvisning */}
        <section className="card rise p-5 min-h-[420px]" style={{ animationDelay: "0.06s" }}>
          {stage === "idle" && (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-[420px]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink text-paper">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3"/></svg>
                </div>
                <h2 className="display mt-4 text-[20px] font-semibold">Klar til ende-til-ende-demo</h2>
                <p className="mt-2 text-[13px] text-muted">
                  Tryk Start for at se hvordan en 4-segment konsultation ender som signeret SOAP-journal med ICD-10-koder · ~30 sekunder.
                </p>
              </div>
            </div>
          )}

          {stage === "recording" && (
            <div className="flex h-full flex-col">
              <h2 className="display text-[17px] font-semibold">🎙️ Optager · live</h2>
              <div className="kicker !text-[9px] mt-1">48kHz · noise-suppression · Web Audio API</div>
              <div className="mt-6 flex flex-1 items-center gap-1 px-2">
                {Array.from({ length: 80 }).map((_, i) => (
                  <span key={i} className="w-1 rounded-full"
                    style={{
                      height: `${20 + Math.abs(Math.sin(i * 0.5 + recordTime * 3)) * 60}%`,
                      background: "var(--color-clay)",
                      opacity: 0.5 + Math.abs(Math.sin(i + recordTime * 4)) * 0.5,
                      transition: "height 0.1s",
                    }} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="Varighed" value={`${recordTime.toFixed(1)}s`} />
                <Stat label="Signal" value="-12 dBFS" />
                <Stat label="SNR" value="34 dB" />
              </div>
            </div>
          )}

          {stage === "transcribing" && (
            <div className="flex h-full flex-col">
              <h2 className="display text-[17px] font-semibold">📝 Streaming transkription</h2>
              <div className="kicker !text-[9px] mt-1">Whisper Large V3 · 2-speaker diarization · ~150 ms latency</div>
              <div className="mt-4 flex-1 overflow-y-auto pr-2">
                {TRANSCRIPT_SEGMENTS.slice(0, transcriptIdx).map((seg, i) => (
                  <SegmentDisplay key={i} segment={seg} text={seg.text} showEntities={false} />
                ))}
                {TRANSCRIPT_SEGMENTS[transcriptIdx] && (
                  <SegmentDisplay
                    segment={TRANSCRIPT_SEGMENTS[transcriptIdx]}
                    text={TRANSCRIPT_SEGMENTS[transcriptIdx].text.slice(0, characterIdx)}
                    showEntities={false}
                    streaming
                  />
                )}
              </div>
            </div>
          )}

          {(stage === "ner" || stage === "structuring" || stage === "coding" || stage === "review") && (
            <div className="flex h-full flex-col">
              <h2 className="display text-[17px] font-semibold">
                {stage === "ner" && "🔬 Medicinsk NER · entity-extraction"}
                {stage === "structuring" && "📋 SOAP-strukturering"}
                {stage === "coding" && "🏷️ ICD-10 + ydelseskoder"}
                {stage === "review" && "✓ Klar til signering"}
              </h2>
              <div className="kicker !text-[9px] mt-1">
                {stage === "ner" && "Clinical BERT · dansk fine-tune · 23 entiteter identificeret"}
                {stage === "structuring" && "Mistral Large 3 · sundhedsdomæne fine-tune"}
                {stage === "coding" && "RAG mod SKS-databasen · confidence-scored"}
                {stage === "review" && "Diff-view · ingenting skrives uden din godkendelse"}
              </div>

              <div className="mt-4 flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
                {TRANSCRIPT_SEGMENTS.map((seg, i) => (
                  <SegmentDisplay key={i} segment={seg} text={seg.text} showEntities={showNer} />
                ))}
              </div>

              {stage === "review" && (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setStage("done")} className="btn btn-primary flex-1 justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
                    Signér og gem
                  </button>
                  <button onClick={reset} className="btn btn-ghost">Ret manuelt</button>
                </div>
              )}
            </div>
          )}

          {stage === "done" && (
            <div className="grid h-full place-items-center text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-signal/14 text-signal">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
                </div>
                <h2 className="display mt-5 text-[22px] font-semibold">Signeret · gemt i journal</h2>
                <p className="mt-2 text-[13px] text-muted">SHA-256 audit-stamp · upmodificerbar · synlig i patientens Min Log</p>
                <button onClick={start} className="btn btn-ghost mt-5">Kør demo igen</button>
              </div>
            </div>
          )}
        </section>

        {/* Output-panel */}
        <div className="flex flex-col gap-3">
          {/* SOAP-output */}
          <section className="card rise p-4" style={{ animationDelay: "0.12s" }}>
            <div className="flex items-center justify-between">
              <h3 className="display text-[14px] font-semibold">SOAP-udkast</h3>
              <span className={`chip mono !text-[10px] ${showSoap ? "!border-signal/40 text-signal" : "text-faint"}`}>
                {showSoap ? "● genereret" : "○ afventer"}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2.5 text-[11.5px]">
              {(["S", "O", "A", "P"] as const).map((key) => (
                <div key={key} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                  <div className="kicker !text-accent">{key} · {key === "S" ? "Subjektivt" : key === "O" ? "Objektivt" : key === "A" ? "Assessment" : "Plan"}</div>
                  <div className={`mt-1 leading-relaxed ${showSoap ? "text-ink-soft" : "text-faint"}`}>
                    {showSoap ? SOAP_OUTPUT[key] : <span className="block h-3 w-full rounded bg-paper-2" />}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ICD-10 */}
          <section className="card rise p-4" style={{ animationDelay: "0.18s" }}>
            <div className="flex items-center justify-between">
              <h3 className="display text-[14px] font-semibold">ICD-10 forslag</h3>
              <span className={`chip mono !text-[10px] ${showCodes ? "!border-signal/40 text-signal" : "text-faint"}`}>
                {showCodes ? "● 3 fundet" : "○ afventer"}
              </span>
            </div>
            {showCodes ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {ICD_SUGGESTIONS.map((c) => (
                  <div key={c.code} className="rounded-[8px] border border-line bg-paper p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="mono text-[12px] font-semibold">{c.code}</span>
                      <span className={`mono text-[10.5px] ${c.confidence > 0.7 ? "text-signal" : c.confidence > 0.4 ? "text-amber" : "text-faint"}`}>
                        {(c.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-soft">{c.label}</div>
                    <div className="mt-1 text-[9.5px] text-faint">{c.source}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="h-8 rounded bg-paper-2/60" />
                <div className="h-8 rounded bg-paper-2/60" />
              </div>
            )}
          </section>

          {/* Ydelseskoder */}
          <section className="card rise p-4" style={{ animationDelay: "0.24s" }}>
            <h3 className="display text-[14px] font-semibold">Ydelseskoder (SKS)</h3>
            <div className="mt-3 flex flex-col gap-1.5">
              {SKS_SERVICES.map((s) => (
                <div key={s.code} className="flex items-center justify-between rounded-[8px] border border-line bg-paper px-2.5 py-1.5">
                  <div>
                    <div className="mono text-[11.5px] font-semibold">{s.code}</div>
                    <div className="text-[10.5px] text-muted">{s.label}</div>
                  </div>
                  {showCodes && s.auto && <span className="text-[9.5px] text-signal">auto</span>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Tech-stack info */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.30s" }}>
        <h2 className="display text-[15px] font-semibold">Teknisk stack · EU-resident</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {[
            { l: "Speech-to-Text", v: "Whisper Large V3", h: "EU-hostet · ingen træning på data" },
            { l: "Medicinsk NER", v: "Clinical BERT · DK fine-tune", h: "27.000 danske kliniske journaler" },
            { l: "SOAP-strukturering", v: "Mistral Large 3", h: "EU-Mistral · 22.000 SOAP-eksempler" },
            { l: "ICD-10 koder", v: "RAG mod SKS-DB", h: "Sundhedsstyrelsens klassifikation" },
            { l: "Audit", v: "SHA-256 hash-chain", h: "Patient-synlig på borger.dk" },
            { l: "GDPR", v: "Art. 9 · særlige kategorier", h: "EU · Frankfurt · 5 års retention" },
          ].map((s) => (
            <div key={s.l} className="rounded-[10px] border border-line bg-paper p-3">
              <div className="kicker !text-[9px]">{s.l}</div>
              <div className="mt-1 text-[12.5px] font-medium">{s.v}</div>
              <div className="mt-0.5 text-[10.5px] text-faint">{s.h}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SegmentDisplay({ segment, text, showEntities, streaming }: { segment: typeof TRANSCRIPT_SEGMENTS[0]; text: string; showEntities: boolean; streaming?: boolean }) {
  const isPatient = segment.speaker === "Patient";
  return (
    <div className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-paper"
        style={{ background: isPatient ? "var(--color-clay)" : "var(--color-ink)" }}>
        {segment.speaker.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="kicker !text-[9px]" style={{ color: isPatient ? "var(--color-clay)" : "var(--color-ink-soft)" }}>{segment.speaker}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
          {showEntities && segment.entities ? renderWithEntities(text, segment.entities) : text}
          {streaming && <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-ink" />}
        </div>
      </div>
    </div>
  );
}

function renderWithEntities(text: string, entities: { start: number; end: number; type: string }[]) {
  const parts: { text: string; type?: string }[] = [];
  let cursor = 0;
  for (const e of entities) {
    if (e.start > cursor) parts.push({ text: text.slice(cursor, e.start) });
    parts.push({ text: text.slice(e.start, e.end), type: e.type });
    cursor = e.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts.map((p, i) => {
    if (!p.type) return <span key={i}>{p.text}</span>;
    const c = NER_TYPES[p.type];
    return (
      <span key={i} className="inline-flex items-baseline gap-1 rounded-[4px] px-1"
        style={{ background: `color-mix(in srgb, ${c.color} 14%, transparent)`, color: c.color }}>
        {p.text}
        <span className="text-[8px] opacity-70">{c.label}</span>
      </span>
    );
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-line bg-paper p-2">
      <div className="kicker !text-[8.5px]">{label}</div>
      <div className="mt-0.5 mono text-[13px] font-semibold">{value}</div>
    </div>
  );
}
