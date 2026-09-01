"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { AlphaScanResult } from "@/lib/scanner/alpha-pipeline";

const AlphaViewer4D = dynamic(() => import("@/components/AlphaViewer4D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center rounded-[14px] border border-line bg-paper-2 text-[13px] text-muted">
      Loader Del Pilar Nexus viewer…
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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Kunne ikke læse fil"));
    reader.readAsDataURL(file);
  });
}

/** Prefer uploading base64 to our API as data-URL imageUrl when no public URL exists */
function asProcessableUrl(dataUrl: string): string {
  return dataUrl;
}

export function NexusScanPanel({
  tenantId = "bypilar",
  brandName = "by Pilar",
  patientId = "mette",
  patientName = "Mette Lindqvist",
  bookingId,
  serviceName = "Del Pilar Nexus · Klinisk fod-scan",
}: NexusScanContext) {
  const [scan, setScan] = useState<AlphaScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [journalBusy, setJournalBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  async function startCamera() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch {
      setErr("Kamera ikke tilgængeligt — upload et skarpt foto i stedet.");
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreview(dataUrl);
    stopCamera();
  }

  async function onFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Kun billedfiler (JPEG/PNG/HEIC→JPEG).");
      return;
    }
    if (file.size < 40_000) {
      setErr("Billedet er for lavopløst. Brug et skarpt close-up af hele foden.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    setErr(null);
  }

  async function runScan() {
    if (!preview) {
      setErr("Tag et foto eller upload et billede af foden først.");
      return;
    }
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
          imageUrl: asProcessableUrl(preview),
          imageBase64: preview,
          requireQuality: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || json.summary || "Scan fejlede");
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
    if (!bookingId) {
      setErr("Vælg en booking for at gemme i journal");
      return;
    }
    setJournalBusy(true);
    setErr(null);
    try {
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
        const q = scan.quality;
        const note = [
          `Del Pilar Nexus scan (${scan.mode})`,
          q ? `Quality ${q.grade} ${q.score}/100` : null,
          `Arch ${scan.biomechanics.archStrainMPa} MPa`,
          `Torsion ${scan.biomechanics.jointTorsionNm} N·m`,
          scan.medicalFindings
            .map((f) => `${f.class} ${Math.round(f.confidence * 100)}% [AI]`)
            .join(", "),
        ]
          .filter(Boolean)
          .join(" · ");
        await fetch(`/api/journal/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            soap: {
              O: `Fod-scan hos ${brandName}. ${note}`,
              A: scan.biomechanics.isCritical
                ? "Forhøjet biomekanisk belastning — klinisk vurdering påkrævet. AI-fund er forslag."
                : "Ingen kritiske biomekaniske flags i denne session. AI-fund er forslag.",
              P: "Scan arkiveret. Eventuel indlæg/opfølgning aftales med behandler. Ikke autonom diagnose.",
            },
          }),
        });
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Journal fejlede");
    } finally {
      setJournalBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[16px] border border-line bg-paper shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="kicker text-signal">Del Pilar Nexus · ARIA + S-Agent</div>
          <h2 className="display mt-1 text-[20px] font-semibold">Klinisk fod-scan</h2>
          <p className="mt-1 max-w-[56ch] text-[12.5px] text-muted">
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
          <button type="button" className="btn btn-primary" disabled={busy || !preview} onClick={runScan}>
            {busy ? "ARIA scanner…" : "Kør Nexus-scan"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="rounded-[12px] border border-line bg-paper-2 p-3">
            <div className="text-[12px] font-medium">1. Capture</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Plantar + skrå vinkel, jævnt lys, hele foden i frame. Undgå sokker/skygger.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!camOn ? (
                <button type="button" className="btn btn-ghost" onClick={startCamera}>
                  Åbn kamera
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" onClick={captureFrame}>
                    Fang frame
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={stopCamera}>
                    Luk kamera
                  </button>
                </>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                Upload foto
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {camOn && (
              <video
                ref={videoRef}
                className="mt-3 aspect-[4/3] w-full rounded-[10px] bg-ink object-cover"
                playsInline
                muted
              />
            )}
            {preview && !camOn && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Fod preview"
                className="mt-3 aspect-[4/3] w-full rounded-[10px] object-cover"
              />
            )}
          </div>

          {scan?.quality && (
            <div
              className={`rounded-[12px] border p-3 ${
                scan.quality.pass ? "border-signal/40 bg-signal/[0.06]" : "border-amber/40 bg-amber/[0.07]"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-[12px] font-semibold">Quality gate</div>
                <div className="font-mono text-[13px]">
                  {scan.quality.grade} · {scan.quality.score}/100
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {scan.quality.checks.map((c) => (
                  <li key={c.id} className="flex gap-2 text-[11.5px] text-muted">
                    <span className={c.ok ? "text-signal" : "text-clay"}>{c.ok ? "✓" : "✗"}</span>
                    <span>{c.detail}</span>
                  </li>
                ))}
              </ul>
              {!scan.quality.pass && (
                <p className="mt-2 text-[11.5px] text-amber">
                  HOLD — ikke klinisk godkendt output. Sæt API-nøgler / skarpere foto, eller brug kun som
                  demo.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          {err && <p className="mb-3 text-[13px] text-clay">{err}</p>}
          {summary && !err && <p className="mb-3 text-[13px] text-ink-soft">{summary}</p>}
          {journalId && (
            <p className="mb-3 text-[13px]">
              Journal ·{" "}
              <Link href={`/journal/${journalId}`} className="text-accent hover:underline">
                {journalId}
              </Link>
            </p>
          )}
          <AlphaViewer4D scanData={scan} previewUrl={preview} />
        </div>
      </div>
    </section>
  );
}
