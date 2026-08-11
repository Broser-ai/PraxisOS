"use client";

import { useState } from "react";
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

export function NexusScanPanel({ patientId = "mette" }: { patientId?: string }) {
  const [scan, setScan] = useState<AlphaScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function runScan() {
    setBusy(true);
    setErr(null);
    setSummary(null);
    try {
      const res = await fetch("/api/v1/scan/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          tenantId: "bypilar",
          imageUrl: "https://placehold.co/512x512/png?text=bypilar+foot",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Scan fejlede");
      setScan(json.scan as AlphaScanResult);
      setSummary(json.summary as string);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Scan fejlede");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="kicker">DelPilar Nexus · S-Agent + ARIA</div>
          <h2 className="display mt-1 text-[18px] font-semibold">4D klinisk scan</h2>
          <p className="mt-1 max-w-[52ch] text-[12.5px] text-muted">
            Replicate/Roboflow når nøgler er sat — ellers demo-mesh + MonoMSK-estimat. Resultatet
            huskes i swarm-memory og notify’er ARIA.
          </p>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={runScan}>
          {busy ? "Scanner…" : "Kør Alpha-scan"}
        </button>
      </div>
      <div className="p-4">
        {err && <p className="mb-3 text-[13px] text-clay">{err}</p>}
        {summary && !err && <p className="mb-3 text-[13px] text-signal">{summary}</p>}
        <AlphaViewer4D scanData={scan} />
      </div>
    </section>
  );
}
