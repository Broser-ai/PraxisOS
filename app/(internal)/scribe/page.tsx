"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { scribeTranscript } from "@/lib/mock";
import { listBookings } from "@/lib/bookings";
import { listClients } from "@/lib/clients";

type Line = { who: string; text: string };

type Entry = {
  id: string;
  clientName: string;
  service: string;
  status: string;
  soap: { S: string; O: string; A: string; P: string };
  codes: string[];
};

function ScribeInner() {
  const search = useSearchParams();
  const journalParam = search.get("journal");
  const bookingParam = search.get("booking");

  const upcoming = useMemo(
    () =>
      listBookings({ tenant: "bypilar", status: ["confirmed", "pending", "completed"] }).slice(0, 12),
    [],
  );
  const clients = useMemo(() => listClients(), []);

  const [bookingId, setBookingId] = useState(bookingParam || upcoming[0]?.id || "");
  const [clientId, setClientId] = useState(upcoming[0]?.clientId || clients[0]?.id || "mette");
  const [journalId, setJournalId] = useState<string | null>(journalParam);
  const [entry, setEntry] = useState<Entry | null>(null);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const idx = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const linesRef = useRef<Line[]>([]);

  const selectedBooking = upcoming.find((b) => b.id === bookingId);

  useEffect(() => {
    if (selectedBooking) setClientId(selectedBooking.clientId);
  }, [selectedBooking]);

  useEffect(() => {
    if (!journalId) return;
    fetch(`/api/journal/${journalId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.entry) setEntry(j.entry);
      })
      .catch(() => {});
  }, [journalId]);

  useEffect(() => {
    if (!recording) return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const feed = setInterval(() => {
      if (idx.current < scribeTranscript.length) {
        const next = scribeTranscript[idx.current];
        idx.current += 1;
        linesRef.current = [...linesRef.current, next];
        setLines(linesRef.current);
      } else {
        clearInterval(feed);
        setRecording(false);
        void finalizeDraft(linesRef.current);
      }
    }, 1100);
    return () => {
      clearInterval(tick);
      clearInterval(feed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 9999, behavior: "smooth" });
  }, [lines]);

  const start = () => {
    linesRef.current = [];
    setLines([]);
    setSeconds(0);
    idx.current = 0;
    setEntry(null);
    setErr(null);
    setRecording(true);
  };

  const ensureEntry = async (): Promise<string> => {
    if (journalId) return journalId;
    if (bookingId) {
      const res = await fetch("/api/journal/from-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kunne ikke oprette journal");
      setJournalId(json.entry.id);
      return json.entry.id as string;
    }
    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        tenant: "bypilar",
        service: "Konsultation · AI Scribe",
        aiDrafted: true,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Kunne ikke oprette journal");
    setJournalId(json.entry.id);
    return json.entry.id as string;
  };

  const finalizeDraft = async (usedLines: Line[]) => {
    setBusy("draft");
    setErr(null);
    try {
      const id = await ensureEntry();
      const transcript = usedLines.map((l) => `${l.who}: ${l.text}`).join("\n");
      const res = await fetch(`/api/journal/${id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Draft fejlede");
      setEntry(json.entry);
      setJournalId(json.entry.id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const sign = async () => {
    if (!journalId || !entry) return;
    setBusy("sign");
    setErr(null);
    try {
      const res = await fetch(`/api/journal/${journalId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soap: entry.soap,
          signedBy: selectedBooking?.practitioner || "Pilar",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Signatur fejlede");
      setEntry(json.entry);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const generated = Boolean(entry?.soap?.S);

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">Niels · ambient dokumentation</div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">AI Scribe</h1>
          <p className="mt-2.5 max-w-[48ch] text-[14px] text-muted">
            Samtalen bliver til journalpost i PraxisOS — knyttet til behandlingen. Du godkender til sidst.
          </p>
        </div>
        <Link href="/journal" className="btn btn-ghost">
          Åbn journal →
        </Link>
      </div>

      <div className="card rise mt-5 flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[220px] flex-1 text-[12px]">
          <span className="kicker">Booking / behandling</span>
          <select
            className="mt-1 w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px]"
            value={bookingId}
            onChange={(e) => {
              setBookingId(e.target.value);
              setJournalId(null);
              setEntry(null);
            }}
          >
            {upcoming.map((b) => (
              <option key={b.id} value={b.id}>
                {b.clientName} · {b.service} ·{" "}
                {new Date(b.startsAt).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
              </option>
            ))}
          </select>
        </label>
        {journalId && (
          <Link href={`/journal/${journalId}`} className="btn btn-ghost !py-2">
            Journal {journalId.slice(0, 10)}…
          </Link>
        )}
      </div>

      {err && <p className="mt-3 text-[13px] text-clay">{err}</p>}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="card rise overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div>
              <div className="text-[13.5px] font-semibold">
                Konsultation · {selectedBooking?.clientName ?? "Klient"}
              </div>
              <div className="mono text-[11px] text-faint">
                {recording ? "Optager (demo-transcript)…" : generated ? "Udkast klar" : "Klar"}
              </div>
            </div>
            <div className="mono text-[15px]">{mmss}</div>
          </div>

          <div className="flex h-16 items-center justify-center gap-1 border-b border-line bg-paper/50 px-5">
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={i}
                className="w-1 rounded-full"
                style={{
                  height: recording ? `${10 + Math.abs(Math.sin(i * 0.9 + seconds)) * 34}px` : "6px",
                  background: recording ? "var(--color-clay)" : "var(--color-line-2)",
                  transition: "height 0.25s ease",
                }}
              />
            ))}
          </div>

          <div ref={scroller} className="scrollbar-thin h-[300px] overflow-y-auto px-5 py-4">
            {lines.length === 0 && !recording && (
              <div className="grid h-full place-items-center text-center text-[13px] text-faint">
                Start optagelse — demo afspiller en konsultation og Niels skriver til journalen.
              </div>
            )}
            <div className="flex flex-col gap-3">
              {lines.map((l, i) => (
                <div key={i} className="fade-in">
                  <div className={`kicker !text-[9.5px] ${l.who === "Behandler" ? "!text-accent" : "!text-clay"}`}>
                    {l.who}
                  </div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{l.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t border-line px-5 py-3.5">
            {!recording ? (
              <button onClick={start} className="btn btn-primary flex-1 justify-center" disabled={!!busy}>
                <span className="h-2 w-2 rounded-full bg-clay" /> {generated ? "Optag igen" : "Start optagelse"}
              </button>
            ) : (
              <button
                onClick={() => {
                  setRecording(false);
                  void finalizeDraft(linesRef.current);
                }}
                className="btn btn-ghost flex-1 justify-center"
              >
                Stop & skriv journal
              </button>
            )}
          </div>
        </section>

        <section className="card rise p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-[16px] font-semibold">Journal-udkast</h2>
            <span className={`chip ${generated ? "!border-signal/40 text-signal" : "text-faint"}`}>
              {busy === "draft" ? "Niels skriver…" : generated ? "Klar til godkendelse" : "Afventer"}
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
              {(
                [
                  ["S · Subjektivt", entry!.soap.S],
                  ["O · Objektivt", entry!.soap.O],
                  ["A · Vurdering", entry!.soap.A],
                  ["P · Plan", entry!.soap.P],
                ] as const
              ).map(([h, t], i) => (
                <div key={h} className="fade-in" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="kicker !text-accent">{h}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft whitespace-pre-wrap">{t}</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                {entry!.codes.map((c) => (
                  <span key={c} className="chip mono !text-[11px]">
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-1 flex gap-2">
                {entry!.status !== "signed" ? (
                  <button className="btn btn-primary flex-1 justify-center" disabled={!!busy} onClick={sign}>
                    Godkend & gem i journal
                  </button>
                ) : (
                  <Link href={`/journal/${journalId}`} className="btn btn-primary flex-1 justify-center">
                    Åbn signeret journal →
                  </Link>
                )}
                {journalId && (
                  <Link href={`/journal/${journalId}`} className="btn btn-ghost">
                    Rediger
                  </Link>
                )}
              </div>
              <p className="text-center text-[11px] text-faint">
                Intet låses i journalen uden din godkendelse · fuld revisions-log
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Scribe() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1180px] py-16 text-center text-muted">Henter Scribe…</div>}>
      <ScribeInner />
    </Suspense>
  );
}
