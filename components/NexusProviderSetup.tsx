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

type ConfigPayload = {
  liveReady?: boolean;
  llmReady?: boolean;
  blockers?: string[];
  notes?: string[];
  providers?: Providers | null;
  error?: string;
};

function saveFeedback(data: ConfigPayload): string {
  const blockers = data.blockers ?? [];
  if (data.liveReady && data.llmReady) {
    return "Gemt · live scan + OpenAI LLM klar (ingen rebuild)";
  }
  if (data.liveReady) {
    return "Gemt · live quality PASS-providers klar · OpenAI stadig valgfri/mangler";
  }
  if (blockers.length) {
    return `Gemt · mangler til liveReady: ${blockers.map((b) => b.split(" — ")[0]).join(", ")}`;
  }
  return "Gemt · mangler stadig Replicate og/eller Roboflow til liveReady";
}

/**
 * Broser-only · paste Replicate + Roboflow (+ valgfri OpenAI) into /data/secrets.json (no rebuild).
 * Shown on /scan when live providers are missing, or when OpenAI still optional/missing.
 */
export function NexusProviderSetup() {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [replicate, setReplicate] = useState("");
  const [roboflow, setRoboflow] = useState("");
  const [openai, setOpenai] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const applyPayload = useCallback((data: ConfigPayload) => {
    setLiveReady(Boolean(data.liveReady));
    setLlmReady(Boolean(data.llmReady ?? data.providers?.openai));
    setProviders(data.providers ?? null);
    setBlockers(Array.isArray(data.blockers) ? data.blockers : []);
    setNotes(Array.isArray(data.notes) ? data.notes : []);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/scan/config");
    const data = (await res.json()) as ConfigPayload;
    applyPayload(data);
  }, [applyPayload]);

  useEffect(() => {
    refresh().catch(() => setProviders(null));
  }, [refresh]);

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
      const data = (await res.json()) as ConfigPayload;
      if (!res.ok) throw new Error(data.error || "Gem fejlede");
      setReplicate("");
      setRoboflow("");
      setOpenai("");
      applyPayload(data);
      setMsg(saveFeedback(data));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  if (liveReady && providers && llmReady) {
    return (
      <aside className="rounded-[14px] border border-signal/25 bg-signal/[0.06] px-5 py-3 text-[12.5px] text-muted">
        <span className="font-medium text-ink">Live providers + LLM klar</span>
        {" · "}
        Replicate {providers.replicateHint ?? "OK"} · Roboflow {providers.roboflowHint ?? "OK"}
        {" · "}
        OpenAI {providers.openaiHint ?? "OK"}
      </aside>
    );
  }

  if (liveReady && providers) {
    return (
      <aside className="rounded-[14px] border border-signal/25 bg-signal/[0.06] px-5 py-4">
        <div className="text-[12.5px] text-muted">
          <span className="font-medium text-ink">Live fod-scan klar</span>
          {" · "}
          Replicate {providers.replicateHint ?? "OK"} · Roboflow {providers.roboflowHint ?? "OK"}
        </div>
        <p className="mt-2 max-w-[62ch] text-[12.5px] text-muted">
          OpenAI er <strong className="font-medium text-ink">valgfri</strong> for live quality PASS.
          Uden nøgle kører agents på dansk fallback — indsæt <code className="text-ink">sk-…</code> her
          (gemmes i <code className="text-ink">/data/secrets.json</code>, ingen rebuild).
        </p>
        {notes[0] ? <p className="mt-1 text-[11.5px] text-muted">{notes[0]}</p> : null}
        <label className="mt-3 block text-[11.5px] text-muted">
          OPENAI_API_KEY (valgfri · LLM-agent)
          {providers.openai ? (
            <span className="ml-1 text-signal">· sat {providers.openaiHint}</span>
          ) : (
            <span className="ml-1 text-amber">· ikke sat</span>
          )}
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
            {saving ? "Gemmer…" : "Gem OpenAI-nøgle"}
          </button>
          {msg ? <span className="text-[12px] text-muted">{msg}</span> : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-[14px] border border-amber/30 bg-amber/[0.06] px-5 py-4">
      <div className="font-medium text-ink">Broser · aktiver live fod-scan</div>
      <p className="mt-1 max-w-[62ch] text-[12.5px] text-muted">
        Mangler API-nøgler på serveren. Du skal <strong className="font-medium text-ink">ikke</strong>{" "}
        oprette et PraxisOS-projekt i Roboflow — vi kalder offentlige Universe-modeller. Gem nøglerne
        her (ingen Docker-rebuild).
      </p>
      {blockers.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-amber">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] text-muted">
        <li>
          Replicate (allerede sat hvis du har limet <code className="text-ink">r8_…</code>):{" "}
          <a
            className="underline-offset-2 hover:underline"
            href="https://replicate.com/account/api-tokens"
            target="_blank"
            rel="noreferrer"
          >
            replicate.com/account/api-tokens
          </a>
        </li>
        <li>
          Roboflow: opret gratis konto →{" "}
          <a
            className="underline-offset-2 hover:underline"
            href="https://app.roboflow.com/settings/api"
            target="_blank"
            rel="noreferrer"
          >
            Settings → API Keys → Private API Key
          </a>{" "}
          (ikke et workspace-navn). Pipeline bruger Universe-modellerne{" "}
          <code className="text-ink">foot-segmentation-ehn9q</code> og{" "}
          <code className="text-ink">diabetic_ulcers</code>.
        </li>
        <li>
          OpenAI (valgfri · LLM):{" "}
          <a
            className="underline-offset-2 hover:underline"
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
          >
            platform.openai.com/api-keys
          </a>
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
        ) : (
          <span className="ml-1 text-amber">· ikke sat</span>
        )}
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
