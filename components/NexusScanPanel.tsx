"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { AlphaScanResult } from "@/lib/scanner/alpha-pipeline";

const AlphaViewer4D = dynamic(() => import("@/components/AlphaViewer4D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center rounded-[14px] border border-line bg-paper-2 text-[13px] text-muted">
      Loader 4D viewer…
    </div>
  ),
});

export type NexusScanContext = {
  tenantId?: string;
  brandName?: string;
  patientId?: string;
  patientName?: string;
  bookingId?: string;
  serviceName?: string;
};

export function NexusScanPanel({
  tenantId = "bypilar",
  brandName = "by Pilar",
  patientId = "mette",
  patientName = "Mette Lindqvist",
  bookingId,
  serviceName = "Fod-scan · Physical AI",
}: NexusScanContext) {
  const [scan, setScan] = useState<AlphaScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [journalBusy, setJournalBusy] = useState(false);

  async function runScan() {
    setBusy(true);
    setErr(null);
    setSummary(null);
    setJournalId(null);
    try {
      const res = await fetch("/api/v1/scan/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          patientName,
          tenantId,
          bookingId,
          imageUrl: `https://placehold.co/512x512/png?text=${encodeURIComponent(brandName + " fod")}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Scan fejlede");
      setScan(json.scan as AlphaScanResult);
      setSummary(json.summary as string);
      if (typeof json.journalId === "string") setJournalId(json.journalId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Scan fejlede");
    } finally {
      setBusy(false);
    }
  }

  async function saveToJournal() {
    if (!bookingId && !patientId) {
      setErr("Mangler booking eller klient for journal");
      return;
    }
    setJournalBusy(true);
    setErr(null);
    try {
      if (bookingId) {
        const res = await fetch("/api/journal/from-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Journal fejlede");
        const id = json.entry?.id as string;
        setJournalId(id);

        if (scan && id) {
          const note = [
            `Nexus 4D scan (${scan.mode})`,
            `Arch strain ${scan.biomechanics.archStrainMPa} MPa`,
            `Torsion ${scan.biomechanics.jointTorsionNm} N·m`,
            scan.medicalFindings.map((f) => `${f.class} ${Math.round(f.confidence * 100)}%`).join(", "),
          ]
            .filter(Boolean)
            .join(" · ");
          await fetch(`/api/journal/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              soap: {
                O: `Fod-scan gennemført hos ${brandName}. ${note}`,
                A: scan.biomechanics.isCritical
                  ? "Forhøjet biomekanisk belastning — klinisk opfølgning anbefales."
                  : "Scan uden kritiske biomekaniske flags i denne session.",
                P: "Scan arkiveret i journal. Eventuel indlæg/opfølgning aftales med behandler.",
              },
            }),
          });
        }
      } else {
        throw new Error("Vælg en booking for at gemme i journal");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Journal fejlede");
    } finally {
      setJournalBusy(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="kicker">{brandName} · Nexus 4D</div>
          <h2 className="display mt-1 text-[18px] font-semibold">Klinisk fod-scan</h2>
          <p className="mt-1 max-w-[52ch] text-[12.5px] text-muted">
            {patientName}
            {bookingId ? ` · ${bookingId}` : ""}
            {serviceName ? ` · ${serviceName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {scan && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={journalBusy || !bookingId}
              onClick={saveToJournal}
            >
              {journalBusy ? "Gemmer…" : "Send til journal"}
            </button>
          )}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={runScan}>
            {busy ? "Scanner…" : "Kør Alpha-scan"}
          </button>
        </div>
      </div>
      <div className="p-4">
        {err && <p className="mb-3 text-[13px] text-clay">{err}</p>}
        {summary && !err && <p className="mb-3 text-[13px] text-signal">{summary}</p>}
        {journalId && (
          <p className="mb-3 text-[13px]">
            Journal klar ·{" "}
            <Link href={`/journal/${journalId}`} className="text-accent hover:underline">
              åbn {journalId}
            </Link>
          </p>
        )}
        <AlphaViewer4D scanData={scan} />
      </div>
    </section>
  );
}
