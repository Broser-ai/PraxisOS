// Mobile capture page — /scan/capture
//
// Bruger getUserMedia + Device Orientation API til at guide operator gennem
// en 15-punkts halvkugle-scanning. Frames uploades i chunks til Python
// engine via /api/v1/[tenant]/foot-scan/[id]/frames.
//
// A4-overlayet trækkes som SVG oven på video-preview så operator kan justere
// papiret ind i rammen (skala-reference).

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "consent" | "prep" | "recording" | "uploading" | "done" | "error";

const CAPTURE_TARGETS = [
  "Top (rakt ned)",
  "45° medialt",
  "45° lateralt",
  "Fra hælen",
  "Fra tæerne",
  "Bagfra lavt",
  "Forfra lavt",
];

export default function CapturePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("consent");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [side, setSide] = useState<"L" | "R">("R");
  const [clientId, setClientId] = useState("mette");
  const [tenant, setTenant] = useState("bypilar");
  const [targetIdx, setTargetIdx] = useState(0);
  const [captured, setCaptured] = useState<Blob[]>([]);
  const [orientation, setOrientation] = useState<{ a?: number; b?: number; g?: number }>({});
  const [error, setError] = useState<string | null>(null);

  const captureCount = captured.length;
  const target = CAPTURE_TARGETS[targetIdx] ?? "Ekstra vinkel";

  // ---------- lifecycle ---------- //

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: DeviceOrientationEvent) => {
      setOrientation({ a: e.alpha ?? undefined, b: e.beta ?? undefined, g: e.gamma ?? undefined });
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, []);

  async function startStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("prep");
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setPhase("error");
    }
  }

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId;
    const res = await fetch(`/api/v1/${tenant}/foot-scan/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, side, source: "phone_photos", markerType: "a4" }),
    });
    if (!res.ok) throw new Error(`session create failed: ${res.status}`);
    const s = await res.json();
    setSessionId(s.id);
    return s.id;
  }

  async function takeShot() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return;
    setCaptured((prev) => [...prev, blob]);
    setTargetIdx((i) => Math.min(CAPTURE_TARGETS.length, i + 1));
  }

  async function uploadAndReconstruct() {
    if (!captured.length) return;
    setPhase("uploading");
    try {
      const sid = await ensureSession();
      const form = new FormData();
      captured.forEach((b, i) => form.append("files", b, `frame_${String(i).padStart(4, "0")}.jpg`));
      const up = await fetch(`/api/v1/${tenant}/foot-scan/${sid}/frames`, {
        method: "POST",
        body: form,
      });
      if (!up.ok) throw new Error(`upload failed: ${up.status}`);

      const rc = await fetch(`/api/v1/${tenant}/foot-scan/${sid}/reconstruct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: "hybrid", voxelSizeMm: 0.5 }),
      });
      if (!rc.ok) throw new Error(`reconstruct failed: ${rc.status}`);
      setPhase("done");
      router.push(`/scan?session=${sid}`);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setPhase("error");
    }
  }

  // ---------- render ---------- //

  return (
    <div className="mx-auto max-w-[560px]">
      <div className="rise">
        <div className="kicker">Physical AI · fod-scan · in-the-wild capture</div>
        <h1 className="display mt-2 text-[28px] font-semibold leading-none">Optag scan</h1>
        <p className="mt-2 text-[13px] text-muted">
          Placér foden på et A4-papir. Cirklen rundt om foden og optag {CAPTURE_TARGETS.length} vinkler.
        </p>
      </div>

      {phase === "consent" && (
        <section className="card rise mt-5 p-5">
          <h2 className="display text-[16px] font-semibold">Klient + side</h2>
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-[12px]">
              Tenant
              <input value={tenant} onChange={(e) => setTenant(e.target.value)}
                     className="input mt-1 w-full" />
            </label>
            <label className="text-[12px]">
              Klient-ID
              <input value={clientId} onChange={(e) => setClientId(e.target.value)}
                     className="input mt-1 w-full" />
            </label>
            <div className="flex gap-2">
              {(["L", "R"] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)}
                        className={`btn flex-1 ${side === s ? "btn-primary" : "btn-ghost"}`}>
                  {s === "L" ? "Venstre fod" : "Højre fod"}
                </button>
              ))}
            </div>
            <button className="btn btn-primary mt-2" onClick={startStream}>
              Giv kamera-adgang og fortsæt
            </button>
          </div>
        </section>
      )}

      {(phase === "prep" || phase === "recording") && (
        <section className="card rise mt-5 overflow-hidden">
          <div className="relative aspect-[9/16] w-full bg-black">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <A4Overlay />
            <OrientationHUD o={orientation} target={target}
                            done={captureCount} total={CAPTURE_TARGETS.length} />
          </div>
          <div className="flex items-center justify-between border-t border-line p-4">
            <div>
              <div className="kicker">Næste vinkel</div>
              <div className="text-[13.5px] font-medium">{target}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => setCaptured([])}>
                Reset
              </button>
              <button className="btn btn-primary" onClick={takeShot}>
                Optag ({captureCount})
              </button>
            </div>
          </div>
          {captureCount >= 8 && (
            <div className="border-t border-line bg-signal/10 p-4">
              <button className="btn btn-primary w-full" onClick={uploadAndReconstruct}>
                Upload + rekonstruer 3D-mesh
              </button>
            </div>
          )}
        </section>
      )}

      {phase === "uploading" && (
        <section className="card rise mt-5 p-6 text-center">
          <div className="mono text-[11px] text-faint">agent.pod · reconstructing…</div>
          <div className="display mt-2 text-[18px]">COLMAP SfM → Open3D Poisson</div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full w-2/3 animate-pulse bg-accent" />
          </div>
        </section>
      )}

      {phase === "error" && (
        <section className="card rise mt-5 border border-clay/40 p-5">
          <div className="kicker text-clay">Fejl</div>
          <p className="mt-2 text-[13px]">{error}</p>
          <button className="btn btn-ghost mt-3" onClick={() => setPhase("consent")}>
            Prøv igen
          </button>
        </section>
      )}
    </div>
  );
}

function A4Overlay() {
  return (
    <svg viewBox="0 0 100 178" className="pointer-events-none absolute inset-0 h-full w-full">
      <rect
        x={15} y={40} width={70} height={98}
        fill="none" stroke="rgba(255,255,255,.7)" strokeDasharray="2 2" strokeWidth={0.6}
      />
      <text x={18} y={38} fill="rgba(255,255,255,.75)" fontSize="3.2" fontFamily="monospace">
        A4 · 210 × 297 mm
      </text>
      <text x={18} y={144} fill="rgba(255,255,255,.6)" fontSize="2.6" fontFamily="monospace">
        Hold foden centreret · hælen mod bunden af rammen
      </text>
    </svg>
  );
}

function OrientationHUD({
  o, target, done, total,
}: { o: { a?: number; b?: number; g?: number }; target: string; done: number; total: number }) {
  const yaw = o.a?.toFixed(0) ?? "—";
  const pitch = o.b?.toFixed(0) ?? "—";
  const roll = o.g?.toFixed(0) ?? "—";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 text-[10.5px] font-medium text-white">
      <div className="rounded-md bg-black/40 px-2 py-1 mono">
        yaw {yaw}° · pitch {pitch}° · roll {roll}°
      </div>
      <div className="rounded-md bg-black/40 px-2 py-1">
        {done}/{total} · {target}
      </div>
    </div>
  );
}
