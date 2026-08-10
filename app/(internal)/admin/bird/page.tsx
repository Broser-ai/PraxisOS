"use client";

import { useCallback, useEffect, useState } from "react";
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
};

type SendResult = { ok: boolean; id?: string; status?: string; error?: string };

export default function BirdSetupPage() {
  const [status, setStatus] = useState<BirdStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [channelId, setChannelId] = useState("");
  const [from, setFrom] = useState("+4526325220");
  const [workspaceId, setWorkspaceId] = useState("4ad3f57b-b826-4217-b068-77c9ac0f4f02");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [to, setTo] = useState("+45");
  const [text, setText] = useState("Hej fra bypilar · din tid er bekræftet. Mvh PraxisOS");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/bird/config");
    const data = await res.json();
    if (data.bird) {
      setStatus(data.bird);
      if (data.bird.from) setFrom(data.bird.from);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() =>
      setStatus({
        configured: false,
        apiBase: "",
        from: "",
        defaultCategory: "transactional",
        keyHint: null,
      }),
    );
  }, [refresh]);

  async function saveConfig() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = {
        BIRD_SMS_FROM: from,
        BIRD_WORKSPACE_ID: workspaceId,
      };
      if (apiKey.trim()) body.BIRD_API_KEY = apiKey.trim();
      if (channelId.trim()) body.BIRD_SMS_CHANNEL_ID = channelId.trim();
      if (openaiKey.trim()) body.OPENAI_API_KEY = openaiKey.trim();
      const res = await fetch("/api/bird/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gem fejlede");
      setStatus(data.bird);
      setApiKey("");
      setOpenaiKey("");
      setSaveMsg(
        data.channelNote
          ? `Gemt · ${data.channelNote}`
          : "Gemt på serveren · klar med det samme (ingen rebuild)",
      );
      setChannelId("");
      await refresh();
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/bird/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text }),
      });
      setResult((await res.json()) as SendResult);
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
          <Link href="/admin/agents/automation" className="kicker hover:underline">
            ← Agent-automation
          </Link>
          <h1 className="display mt-2 text-[32px] font-semibold leading-none">Bird · SMS setup</h1>
          <p className="mt-2 max-w-[52ch] text-[14px] text-muted">
            Indtast nøgler her — de gemmes kun på Hetzner (`/data/secrets.json`), ikke i Git.
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

      <section className="card rise mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4 bg-paper-2/40">
          <div className="kicker">Trin 1 · Nøgler</div>
          <h2 className="display mt-1 text-[20px] font-semibold">Gem på serveren</h2>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="kicker">BIRD_API_KEY · bypilar_PraxisOS-SMS</span>
            <input
              type="password"
              className="mt-1.5 w-full rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 mono text-[13px]"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={status?.keyHint ? `Sat (${status.keyHint}) — indsæt for at erstatte` : "Indsæt API-nøgle"}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="kicker">BIRD_SMS_CHANNEL_ID · channel eller connector-UUID</span>
            <input
              className="mt-1.5 w-full rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 mono text-[13px]"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder={
                status?.channelReady
                  ? "Sat — indsæt for at erstatte (URL-UUID virker også)"
                  : "UUID fra Bird — vi finder den rigtige SMS-channel"
              }
            />
          </label>
          <label className="block">
            <span className="kicker">BIRD_SMS_FROM</span>
            <input
              className="mt-1.5 w-full rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 mono text-[13px]"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="kicker">BIRD_WORKSPACE_ID</span>
            <input
              className="mt-1.5 w-full rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 mono text-[13px]"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="kicker">OPENAI_API_KEY · valgfri (rigtige LLM-svar)</span>
            <input
              type="password"
              className="mt-1.5 w-full rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 mono text-[13px]"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-… (valgfri)"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={saveConfig}>
            {saving ? "Gemmer…" : "Gem nøgler"}
          </button>
          {saveMsg && <span className="text-[13px] text-muted">{saveMsg}</span>}
        </div>
        <div className="grid gap-3 border-t border-line p-5 md:grid-cols-3">
          <Stat label="API-nøgle" value={status?.keyHint ?? "ikke sat"} ok={ready} />
          <Stat label="Channel" value={status?.channelReady ? "sat" : "mangler"} ok={Boolean(status?.channelReady)} />
          <Stat label="Afsender" value={status?.from || "—"} ok={Boolean(status?.from)} />
        </div>
      </section>

      <section className="card rise mt-3 p-5">
        <div className="kicker">Trin 2 · Test-SMS</div>
        <h2 className="display mt-1 text-[20px] font-semibold">Send prøvebesked</h2>
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
              className="mt-1.5 min-h-[90px] w-full rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 text-[14px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary w-fit"
            disabled={!ready || sending || to.length < 8}
            onClick={sendTest}
          >
            {sending ? "Sender…" : "Send test-SMS"}
          </button>
          {result && (
            <div
              className={`rounded-[10px] border px-3 py-2.5 text-[13.5px] ${
                result.ok ? "border-signal/30 bg-signal/5 text-signal" : "border-clay/30 bg-clay/5 text-clay"
              }`}
            >
              {result.ok ? `Sendt · id ${result.id}` : `Fejl · ${result.error}`}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-[12px] border border-line-2 bg-paper px-3 py-3">
      <div className="kicker">{label}</div>
      <div className="mt-1 text-[14px] font-medium" style={{ color: ok === false ? "var(--color-amber)" : "var(--color-ink)" }}>
        {value}
      </div>
    </div>
  );
}
