"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Entry = {
  id: string;
  clientId: string;
  clientName: string;
  bookingId?: string;
  service: string;
  practitioner: string;
  status: string;
  soap: { S: string; O: string; A: string; P: string };
  codes: string[];
  transcript?: string;
  aiDrafted: boolean;
  signedBy?: string;
  signedAt?: string;
  visitAt: string;
};

export default function JournalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [entry, setEntry] = useState<Entry | null>(null);
  const [soap, setSoap] = useState({ S: "", O: "", A: "", P: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const locked = entry?.status === "signed";

  const load = useCallback(async () => {
    const res = await fetch(`/api/journal/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || "Ikke fundet");
      return;
    }
    setEntry(json.entry);
    setSoap(json.entry.soap);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy("save");
    setErr(null);
    try {
      const res = await fetch(`/api/journal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soap }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gem fejlede");
      setEntry(json.entry);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const draft = async () => {
    setBusy("draft");
    setErr(null);
    try {
      const res = await fetch(`/api/journal/${id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: entry?.transcript || "" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Draft fejlede");
      setEntry(json.entry);
      setSoap(json.entry.soap);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const sign = async () => {
    setBusy("sign");
    setErr(null);
    try {
      const res = await fetch(`/api/journal/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soap, signedBy: entry?.practitioner || "Pilar" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Signatur fejlede");
      setEntry(json.entry);
      setSoap(json.entry.soap);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!entry && !err) {
    return <div className="mx-auto max-w-[900px] py-16 text-center text-muted">Henter journal…</div>;
  }
  if (!entry) {
    return (
      <div className="mx-auto max-w-[900px] py-16 text-center">
        <p className="text-clay">{err}</p>
        <Link href="/journal" className="btn btn-ghost mt-4">
          ← Journal
        </Link>
      </div>
    );
  }

  const visit = new Date(entry.visitAt).toLocaleString("da-DK");

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/journal" className="kicker hover:underline">
            ← Journal
          </Link>
          <h1 className="display mt-2 text-[28px] font-semibold leading-tight">{entry.clientName}</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {entry.service} · {visit}
            {entry.bookingId && (
              <>
                {" · "}
                <Link href={`/bookings/${entry.bookingId}`} className="text-accent hover:underline">
                  {entry.bookingId}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/klienter/${entry.clientId}`} className="btn btn-ghost">
            Klient
          </Link>
          <Link href={`/scribe?journal=${entry.id}`} className="btn btn-ghost">
            AI Scribe
          </Link>
        </div>
      </div>

      {err && <p className="mt-3 text-[13px] text-clay">{err}</p>}

      <div className="card mt-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">{entry.status}</span>
          {entry.aiDrafted && <span className="chip !border-signal/40 text-signal">Niels-udkast</span>}
          {entry.signedBy && (
            <span className="mono text-[11px] text-faint">
              Signeret af {entry.signedBy}
              {entry.signedAt ? ` · ${new Date(entry.signedAt).toLocaleString("da-DK")}` : ""}
            </span>
          )}
        </div>

        <div className="mt-5 space-y-4">
          {(
            [
              ["S", "Subjektivt"],
              ["O", "Objektivt"],
              ["A", "Vurdering"],
              ["P", "Plan"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <div className="kicker !text-accent">
                {key} · {label}
              </div>
              <textarea
                className="mt-1.5 w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-[13.5px] leading-relaxed disabled:opacity-70"
                rows={3}
                disabled={locked}
                value={soap[key]}
                onChange={(e) => setSoap((s) => ({ ...s, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        {entry.codes?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {entry.codes.map((c) => (
              <span key={c} className="chip mono !text-[11px]">
                {c}
              </span>
            ))}
          </div>
        )}

        {!locked && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn btn-ghost" disabled={!!busy} onClick={draft}>
              {busy === "draft" ? "Niels skriver…" : "Niels · nyt udkast"}
            </button>
            <button className="btn btn-ghost" disabled={!!busy} onClick={save}>
              {busy === "save" ? "Gemmer…" : "Gem rettelser"}
            </button>
            <button className="btn btn-primary" disabled={!!busy} onClick={sign}>
              {busy === "sign" ? "Signerer…" : "Godkend & lås journal"}
            </button>
          </div>
        )}
        {locked && (
          <p className="mt-5 text-[12px] text-muted">
            Journalen er låst efter signatur. Ny behandling = ny journalpost (via booking eller Scribe).
          </p>
        )}
      </div>
    </div>
  );
}
