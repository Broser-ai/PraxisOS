"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BirdStatus = {
  configured: boolean;
  apiBase: string;
  from: string;
  defaultCategory: string;
  authMode?: string;
  workspaceReady?: boolean;
  channelReady?: boolean;
  keyHint: string | null;
  hint?: string;
};

type SendResult = {
  ok: boolean;
  id?: string;
  status?: string;
  error?: string;
};

export default function BirdSetupPage() {
  const [status, setStatus] = useState<BirdStatus | null>(null);
  const [to, setTo] = useState("+45");
  const [text, setText] = useState("Hej fra bypilar · din tid er bekræftet. Mvh PraxisOS");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    fetch("/api/bird/status")
      .then((r) => r.json())
      .then((data: BirdStatus) => setStatus(data))
      .catch(() =>
        setStatus({
          configured: false,
          apiBase: "",
          from: "",
          defaultCategory: "transactional",
          keyHint: null,
        }),
      );
  }, []);

  async function sendTest() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/bird/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text }),
      });
      const data = (await res.json()) as SendResult;
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Kunne ikke kontakte serveren" });
    } finally {
      setSending(false);
    }
  }

  const ready = Boolean(status?.configured);

  return (
    <div className="mx-auto max-w-[980px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/health" className="kicker hover:underline">
            ← System-status
          </Link>
          <h1 className="display mt-2 text-[32px] font-semibold leading-none">Bird · SMS setup</h1>
          <p className="mt-2 max-w-[52ch] text-[14px] text-muted">
            Selvhostet opsætning til bypilar. Nøglen ligger kun på serveren — aldrig i browseren.
          </p>
        </div>
        <span
          className={`chip mono !text-[11px] ${
            ready ? "!border-signal/40 text-signal" : "!border-amber/40 text-amber"
          }`}
        >
          {ready ? "● Bird klar" : "○ Mangler BIRD_API_KEY"}
        </span>
      </div>

      <section className="card rise mt-6 overflow-hidden" style={{ animationDelay: "0.04s" }}>
        <div
          className="border-b border-line px-5 py-4"
          style={{
            background:
              "linear-gradient(120deg, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent)",
          }}
        >
          <div className="kicker">Trin 1 · Status</div>
          <h2 className="display mt-1 text-[20px] font-semibold">Forbindelse</h2>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2">
          <Stat label="API-nøgle" value={status?.keyHint ?? "ikke sat"} ok={ready} />
          <Stat label="Afsender" value={status?.from || "—"} ok={Boolean(status?.from)} />
          <Stat label="Auth" value={status?.authMode ?? "—"} ok />
          <Stat label="API base" value={status?.apiBase || "—"} ok={Boolean(status?.apiBase)} mono />
          <Stat
            label="Workspace ID"
            value={status?.workspaceReady ? "sat" : "valgfri / mangler"}
            ok={Boolean(status?.workspaceReady)}
          />
          <Stat
            label="SMS channel ID"
            value={status?.channelReady ? "sat" : "valgfri / mangler"}
            ok={Boolean(status?.channelReady)}
          />
        </div>
        {!ready && (
          <div className="border-t border-line bg-paper-2/70 px-5 py-4 text-[13.5px] text-muted">
            På Hetzner-serveren: sæt <span className="mono text-ink">BIRD_API_KEY</span> og{" "}
            <span className="mono text-ink">BIRD_SMS_FROM=+4526325220</span> i{" "}
            <span className="mono text-ink">.env.production</span>, kør derefter deploy-scriptet.
          </div>
        )}
      </section>

      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.08s" }}>
        <div className="kicker">Trin 2 · Test-SMS</div>
        <h2 className="display mt-1 text-[20px] font-semibold">Send prøvebesked</h2>
        <p className="mt-1 text-[13.5px] text-muted">
          Brug dit eget nummer først. Afsender er nummeret, indtil alphanumeric <span className="mono">bypilar</span> er klar.
        </p>

        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="kicker">Modtager</span>
            <input
              className="mt-1.5 w-full rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 mono text-[14px]"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+4520xxxxxx"
            />
          </label>
          <label className="block">
            <span className="kicker">Besked</span>
            <textarea
              className="mt-1.5 min-h-[110px] w-full rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 text-[14px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!ready || sending || to.length < 8}
              onClick={sendTest}
            >
              {sending ? "Sender…" : "Send test-SMS"}
            </button>
            <Link href="/admin/nemsms" className="btn btn-ghost">
              NemSMS (parkér)
            </Link>
          </div>
          {result && (
            <div
              className={`rounded-[10px] border px-3 py-2.5 text-[13.5px] ${
                result.ok
                  ? "border-signal/30 bg-signal/5 text-signal"
                  : "border-clay/30 bg-clay/5 text-clay"
              }`}
            >
              {result.ok
                ? `Sendt · id ${result.id} · status ${result.status}`
                : `Fejl · ${result.error}`}
            </div>
          )}
        </div>
      </section>

      <section className="rise mt-3 grid gap-3 md:grid-cols-3" style={{ animationDelay: "0.12s" }}>
        <GuideCard
          step="01"
          title="Bird"
          body="SMS-kanal connected · nøgle bypilar_PraxisOS-SMS · afsender +45 26 32 52 20"
        />
        <GuideCard
          step="02"
          title="Hetzner"
          body="PraxisOS kører i Docker på din egen server. Domende peger på 167.233.171.184"
        />
        <GuideCard
          step="03"
          title="Klinik"
          body="Bookinger kan sende SMS via Bird. WordPress er valgfrit til knap på bypilar.dk"
        />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  ok,
  mono,
}: {
  label: string;
  value: string;
  ok?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[12px] border border-line-2 bg-paper px-3 py-3">
      <div className="kicker">{label}</div>
      <div className={`mt-1 text-[14px] font-medium ${mono ? "mono break-all" : ""}`}>
        <span style={{ color: ok === false ? "var(--color-amber)" : "var(--color-ink)" }}>{value}</span>
      </div>
    </div>
  );
}

function GuideCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="card p-4">
      <div className="mono text-[11px] text-faint">{step}</div>
      <div className="display mt-1 text-[18px] font-semibold">{title}</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}
