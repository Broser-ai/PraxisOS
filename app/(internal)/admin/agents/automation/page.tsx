"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type StatusPayload = {
  ok: boolean;
  automation: {
    ticks: number;
    lastTickAt: string | null;
    runsTotal: number;
    jobsTotal: number;
    pendingApprovals: number;
    running: number;
    completed24h: number;
    failed24h: number;
    llmConfigured: boolean;
    birdConfigured: boolean;
  };
  llm: { configured: boolean; model: string };
  bird: { configured: boolean };
  workflows: {
    id: string;
    name: string;
    schedule: string;
    agents: string[];
    enabled: boolean;
    description: string;
  }[];
  recentRuns: {
    id: string;
    agentId: string;
    status: string;
    input: string;
    output?: string;
    mode: string;
    startedAt: string;
    toolCalls: { name: string }[];
  }[];
  pendingApprovals: {
    id: string;
    agentId: string;
    action: string;
    status: string;
    createdAt: string;
    payload: Record<string, unknown>;
  }[];
  recentJobs: {
    id: string;
    workflowId: string;
    status: string;
    scheduledAt: string;
    runIds: string[];
  }[];
};

export default function AgentAutomationPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [chatMsg, setChatMsg] = useState("Book en tid til medicinsk fodpleje i morgen");
  const [chatOut, setChatOut] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/status");
      const json = (await res.json()) as StatusPayload;
      setData(json);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Kunne ikke hente status");
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const runTick = async (force: boolean) => {
    setBusy(force ? "force" : "tick");
    try {
      await fetch("/api/agents/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, tenant: "bypilar" }),
      });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Tick fejlede");
    } finally {
      setBusy(null);
    }
  };

  const runWorkflow = async (workflowId: string) => {
    setBusy(workflowId);
    try {
      await fetch("/api/agents/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", workflowId, tenant: "bypilar" }),
      });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Workflow fejlede");
    } finally {
      setBusy(null);
    }
  };

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    try {
      await fetch("/api/agents/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const askAgent = async () => {
    setBusy("chat");
    setChatOut(null);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatMsg, tenant: "bypilar", autoRoute: true }),
      });
      const json = await res.json();
      setChatOut(`${json.agentId}: ${json.reply}`);
      await refresh();
    } catch (e: any) {
      setChatOut(e?.message || "Fejl");
    } finally {
      setBusy(null);
    }
  };

  const a = data?.automation;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/agents" className="kicker hover:underline">
            ← Agent-team
          </Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Agent-automation</h1>
          <p className="mt-2 max-w-[54ch] text-[13.5px] text-muted">
            Alle workflows kører via event-bus + worker. LLM hvis OPENAI_API_KEY er sat — ellers dansk
            heuristik med rigtige tools (bookings, tilskud, SMS).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" disabled={!!busy} onClick={() => runTick(false)}>
            {busy === "tick" ? "Kører…" : "Tick nu"}
          </button>
          <button className="btn btn-primary" disabled={!!busy} onClick={() => runTick(true)}>
            {busy === "force" ? "Kører…" : "Kør alle workflows"}
          </button>
        </div>
      </div>

      {err && <p className="mt-3 text-[13px] text-clay">{err}</p>}

      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Ticks" value={String(a?.ticks ?? "—")} />
        <Stat label="Runs · 24t" value={String(a?.completed24h ?? "—")} sub={`${a?.failed24h ?? 0} fejl`} />
        <Stat label="Pending approve" value={String(a?.pendingApprovals ?? "—")} />
        <Stat
          label="LLM / Bird"
          value={a?.llmConfigured ? "LLM" : "Heuristik"}
          sub={a?.birdConfigured ? "Bird SMS klar" : "Bird ikke sat"}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="card p-5">
          <div className="kicker">Test en agent</div>
          <p className="mt-1 text-[12.5px] text-muted">Auto-router til Aria, Niels, Sigrid m.fl.</p>
          <textarea
            className="mt-3 w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px]"
            rows={3}
            value={chatMsg}
            onChange={(e) => setChatMsg(e.target.value)}
          />
          <button className="btn btn-primary mt-2" disabled={!!busy} onClick={askAgent}>
            {busy === "chat" ? "Tænker…" : "Kør"}
          </button>
          {chatOut && (
            <pre className="mt-3 whitespace-pre-wrap rounded-[10px] bg-paper-2 p-3 text-[12.5px] leading-relaxed">
              {chatOut}
            </pre>
          )}
          <Link href="/agent" className="mt-3 inline-block text-[12px] text-accent hover:underline">
            Åbn Aria-chat →
          </Link>
        </section>

        <section className="card p-5">
          <div className="kicker">Godkendelser</div>
          <div className="mt-3 space-y-2">
            {(data?.pendingApprovals ?? []).length === 0 && (
              <p className="text-[13px] text-muted">Ingen ventende godkendelser.</p>
            )}
            {(data?.pendingApprovals ?? []).map((ap) => (
              <div key={ap.id} className="rounded-[10px] border border-line bg-paper p-3">
                <div className="text-[13px] font-medium">
                  {ap.agentId} · {ap.action}
                </div>
                <div className="mono mt-1 text-[11px] text-faint">{ap.id}</div>
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-primary !py-1.5" disabled={!!busy} onClick={() => decide(ap.id, "approved")}>
                    Godkend
                  </button>
                  <button className="btn btn-ghost !py-1.5" disabled={!!busy} onClick={() => decide(ap.id, "rejected")}>
                    Afvis
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card mt-3 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="kicker">Workflows</div>
            <p className="mt-1 text-[12.5px] text-muted">{data?.workflows.length ?? 0} workflows · worker ticker hvert minut</p>
          </div>
          <span className="mono text-[11px] text-faint">
            Sidste tick: {a?.lastTickAt ? new Date(a.lastTickAt).toLocaleString("da-DK") : "—"}
          </span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {(data?.workflows ?? []).map((w) => (
            <div key={w.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-line bg-paper p-3">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{w.name}</div>
                <div className="mt-0.5 text-[12px] text-muted">{w.description}</div>
                <div className="mono mt-1 text-[10.5px] text-faint">
                  {w.schedule} · {w.agents.join(", ")} · {w.enabled ? "on" : "off"}
                </div>
              </div>
              <button className="btn btn-ghost shrink-0 !py-1.5" disabled={!!busy} onClick={() => runWorkflow(w.id)}>
                Kør
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="card p-5">
          <div className="kicker">Seneste runs</div>
          <ul className="mt-3 space-y-2">
            {(data?.recentRuns ?? []).slice(0, 8).map((r) => (
              <li key={r.id} className="rounded-[10px] border border-line bg-paper px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{r.agentId}</span>
                  <span className="mono text-[10.5px] text-faint">{r.status} · {r.mode}</span>
                </div>
                <div className="mt-1 truncate text-[12px] text-muted">{r.input}</div>
                {r.toolCalls?.length > 0 && (
                  <div className="mono mt-1 text-[10px] text-faint">
                    tools: {r.toolCalls.map((t) => t.name).join(", ")}
                  </div>
                )}
              </li>
            ))}
            {(data?.recentRuns ?? []).length === 0 && (
              <li className="text-[13px] text-muted">Ingen runs endnu — tryk «Kør alle workflows».</li>
            )}
          </ul>
        </section>
        <section className="card p-5">
          <div className="kicker">Jobs</div>
          <ul className="mt-3 space-y-2">
            {(data?.recentJobs ?? []).slice(0, 8).map((j) => (
              <li key={j.id} className="flex items-center justify-between rounded-[10px] border border-line bg-paper px-3 py-2">
                <span className="truncate text-[12.5px]">{j.workflowId}</span>
                <span className="mono text-[10.5px] text-faint">{j.status}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-[10px] bg-paper-2 p-3 text-[12px] leading-relaxed text-muted">
            <strong className="text-ink">Env på server:</strong> OPENAI_API_KEY (valgfri), AGENT_WORKER_SECRET,
            PRAXIS_DATA_DIR=/data. Worker-containeren kalder /api/agents/tick hvert minut.
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <div className="display text-[24px] font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{label}</div>
      {sub && <div className="mono mt-0.5 text-[10px] text-faint">{sub}</div>}
    </div>
  );
}
