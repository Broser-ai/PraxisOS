"use client";

import { useCallback, useEffect, useState } from "react";

type Providers = {
  replicate: boolean;
  replicateHint: string | null;
  roboflow: boolean;
  roboflowHint: string | null;
  openai: boolean;
  openaiHint: string | null;
};

/**
 * Broser-only · paste Replicate + Roboflow keys into /data/secrets.json (no rebuild).
 * Shown on /scan when live providers are missing.
 */
export function NexusProviderSetup() {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [replicate, setReplicate] = useState("");
  const [roboflow, setRoboflow] = useState("");
  const [openai, setOpenai] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/scan/config");
    const data = await res.json();
    setLiveReady(Boolean(data.liveReady));
    setProviders(data.providers ?? null);
  }, []);

  useEffect(() => {
    refresh().catch(() => setProviders(null));
  }, [refresh]);

  if (liveReady && providers) {
    return (
      <aside className="rounded-[14px] border border-signal/25 bg-signal/[0.06] px-5 py-3 text-[12.5px] text-muted">
        <span className="font-medium text-ink">Live providers klar</span>
        {" · "}
        Replicate {providers.replicateHint ?? "OK"} · Roboflow {providers.roboflowHint ?? "OK"}
      </aside>
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, string> = {};
      if (replicate.trim()) body.REPLICATE_API_TOKEN = replicate.trim();
      if (roboflow.trim()) body.ROBOFLOW_API_KEY = roboflow.trim();
      if (openai.trim()) body.OPENAI_API_KEY = openai.trim();
      if (!Object.keys(body).length) {
        setMsg("Indsæt mindst én nøgle");
        return;
      }
      const res = await fetch("/api/scan/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gem fejlede");
      setReplicate("");
      setRoboflow("");
      setOpenai("");
      setLiveReady(Boolean(data.liveReady));
      setProviders(data.providers ?? null);
      setMsg(
        data.liveReady
          ? "Gemt · live quality PASS er klar (ingen rebuild)"
          : "Gemt · mangler stadig den anden nøgle til liveReady",
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="rounded-[14px] border border-amber/30 bg-amber/[0.06] px-5 py-4">
      <div className="font-medium text-ink">Broser · aktiver live fod-scan</div>
      <p className="mt-1 max-w-[62ch] text-[12.5px] text-muted">
        Mangler API-nøgler på serveren. Hent dem og gem her — gemmes i{" "}
        <code className="text-ink">/data/secrets.json</code> (ingen Docker-rebuild).
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] text-muted">
        <li>
          <a
            className="underline-offset-2 hover:underline"
            href="https://replicate.com/account/api-tokens"
            target="_blank"
            rel="noreferrer"
          >
            replicate.com/account/api-tokens
          </a>{" "}
          → kopiér token (<code className="text-ink">r8_…</code>)
        </li>
        <li>
          <a
            className="underline-offset-2 hover:underline"
            href="https://app.roboflow.com/settings/api"
            target="_blank"
            rel="noreferrer"
          >
            app.roboflow.com/settings/api
          </a>{" "}
          → Private API Key
        </li>
      </ol>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="block text-[11.5px] text-muted">
          REPLICATE_API_TOKEN
          {providers?.replicate ? (
            <span className="ml-1 text-signal">· sat {providers.replicateHint}</span>
          ) : null}
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded-[9px] border border-line bg-card px-3 py-2 text-[13px] text-ink"
            placeholder="r8_…"
            value={replicate}
            onChange={(e) => setReplicate(e.target.value)}
          />
        </label>
        <label className="block text-[11.5px] text-muted">
          ROBOFLOW_API_KEY
          {providers?.roboflow ? (
            <span className="ml-1 text-signal">· sat {providers.roboflowHint}</span>
          ) : null}
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded-[9px] border border-line bg-card px-3 py-2 text-[13px] text-ink"
            placeholder="Private API Key"
            value={roboflow}
            onChange={(e) => setRoboflow(e.target.value)}
          />
        </label>
      </div>
      <label className="mt-2 block text-[11.5px] text-muted">
        OPENAI_API_KEY (valgfri · LLM-agent)
        {providers?.openai ? (
          <span className="ml-1 text-signal">· sat {providers.openaiHint}</span>
        ) : null}
        <input
          type="password"
          autoComplete="off"
          className="mt-1 w-full rounded-[9px] border border-line bg-card px-3 py-2 text-[13px] text-ink md:max-w-[50%]"
          placeholder="sk-…"
          value={openai}
          onChange={(e) => setOpenai(e.target.value)}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-[9px] bg-ink px-3.5 py-2 text-[12.5px] font-medium text-paper disabled:opacity-60"
        >
          {saving ? "Gemmer…" : "Gem nøgler"}
        </button>
        {msg ? <span className="text-[12px] text-muted">{msg}</span> : null}
      </div>
    </aside>
  );
}
