"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchStaffSession } from "@/lib/staff-session";

type DaemonState = {
  running: boolean;
  cycle: number;
  lastTickAt: string | null;
  intervalMs: number;
  lastError: string | null;
};

type SwarmStatus = {
  enabled: boolean;
  tasks: number;
  worktrees: number;
  journals: number;
  daemon?: DaemonState;
  invariants?: Record<string, unknown>;
};

type SwarmTask = {
  id: string;
  type: string;
  title: string;
  status: string;
  assignedTo: string;
  resultSummary?: string;
  branchName?: string;
  error?: string;
};

type Journal = {
  id: string;
  at: string;
  agent: string;
  kind: string;
  content: string;
};

export default function SwarmAdminPage() {
  const [tenant, setTenant] = useState<string | null>(null);
  const [status, setStatus] = useState<SwarmStatus | null>(null);
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [live, setLive] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [title, setTitle] = useState("Savage improve · booking persistence");
  const [type, setType] = useState("improve");

  useEffect(() => {
    void fetchStaffSession().then((me) => {
      if (me) setTenant(me.tenant);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!tenant) return;
    const [s, t, j] = await Promise.all([
      fetch(`/api/v1/${tenant}/swarm`).then((r) => r.json()),
      fetch(`/api/v1/${tenant}/swarm?view=tasks`).then((r) => r.json()),
      fetch(`/api/v1/${tenant}/swarm?view=journals`).then((r) => r.json()),
    ]);
    setStatus(s);
    setTasks(t.data ?? []);
    setJournals(j.data ?? []);
  }, [tenant]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Real-time SSE feed
  useEffect(() => {
    if (!tenant) return;
    const es = new EventSource(`/api/v1/${tenant}/swarm/stream`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          type?: string;
          entry?: Journal;
          task?: SwarmTask;
          summary?: string;
          detail?: string;
          cycle?: number;
        };
        const line =
          data.type === "journal" && data.entry
            ? `${data.entry.agent}: ${data.entry.content}`
            : data.type === "task" && data.task
              ? `task ${data.task.id} → ${data.task.status}`
              : data.type === "cycle"
                ? data.summary ?? `cycle ${data.cycle}`
                : data.type === "daemon"
                  ? `daemon ${data.detail ?? ""}`
                  : data.type === "heartbeat"
                    ? "♥ heartbeat"
                    : JSON.stringify(data).slice(0, 120);
        setLive((prev) => [line, ...prev].slice(0, 40));
        if (data.type === "journal" || data.type === "task" || data.type === "cycle") {
          void refresh();
        }
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      // browser will retry
    };
    return () => es.close();
  }, [refresh, tenant]);

  const post = async (body: Record<string, unknown>) => {
    if (!tenant) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/${tenant}/swarm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) setMsg(json.error ?? "fejl");
      else setMsg(JSON.stringify(json).slice(0, 180));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const runSavage = () =>
    void post({ action: "savage", type, title, brief: title });

  const awaken = () =>
    void post({ action: "daemon_start", intervalMs: 60_000 });

  const sleep = () => void post({ action: "daemon_stop" });

  const tickOnce = async () => {
    if (!tenant) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/${tenant}/swarm/tick`, { method: "POST" });
      const json = await res.json();
      setMsg(JSON.stringify(json).slice(0, 200));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const approveTask = async (taskId: string) => {
    const token = window.prompt("Approve token (dev: I-APPROVE-MERGE)") ?? "";
    if (!token) return;
    await post({
      action: "approve",
      taskId,
      approveToken: token,
    });
  };

  const daemon = status?.daemon;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/agents" className="kicker hover:underline">
            ← Agenter
          </Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">
            S-H Swarm · 24/7 Autonom
          </h1>
          <p className="mt-2 max-w-[560px] text-[13.5px] text-muted">
            Tenant {tenant ?? "…"} · Meta-harness kører recurring cycles over S- og H-agenter.
            Real-time journal via SSE + remote hydrate. Merge/deploy kræver human approve.
          </p>
        </div>
        <span className={`chip mono !text-[11px] ${daemon?.running ? "!border-signal/40 text-signal" : ""}`}>
          {daemon?.running ? `● LIVE · cycle ${daemon.cycle}` : "○ daemon idle"} ·{" "}
          {status?.worktrees ?? 0} worktrees
        </span>
      </div>

      <section className="card rise mt-5 grid gap-3 p-5 md:grid-cols-5">
        <Stat label="Cycles" value={String(daemon?.cycle ?? 0)} />
        <Stat label="Tasks" value={String(status?.tasks ?? 0)} />
        <Stat label="Worktrees" value={String(status?.worktrees ?? 0)} />
        <Stat label="Interval" value={daemon ? `${Math.round(daemon.intervalMs / 1000)}s` : "—"} />
        <Stat label="NO_AUTO_MERGE" value={status?.invariants?.NO_AUTO_MERGE ? "ON" : "?"} />
      </section>

      <section className="card rise mt-3 p-5">
        <h2 className="display text-[17px] font-semibold">Awaken · 24/7 daemon</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Starter recurring agenda: LUNA → FELIX → H-bridge → FREJ → ATLAS worktree · gentages.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || daemon?.running}
            onClick={awaken}
            className="rounded-[10px] bg-ink px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-50"
          >
            Awaken daemon
          </button>
          <button
            type="button"
            disabled={busy || !daemon?.running}
            onClick={sleep}
            className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] disabled:opacity-50"
          >
            Stop
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void tickOnce()}
            className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] disabled:opacity-50"
          >
            Tick once
          </button>
        </div>
        {daemon?.lastTickAt && (
          <p className="mt-3 mono text-[11px] text-faint">
            last tick {new Date(daemon.lastTickAt).toLocaleString("da-DK")}
            {daemon.lastError ? ` · err ${daemon.lastError}` : ""}
          </p>
        )}
      </section>

      <section className="card rise mt-3 p-5">
        <h2 className="display text-[17px] font-semibold">Manual savage run</h2>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px]"
          >
            <option value="research">research · LUNA</option>
            <option value="code">code · ATLAS worktree</option>
            <option value="improve">improve · FELIX</option>
            <option value="clinical_h">clinical_h · H-bridge</option>
            <option value="audit">audit · FREJ</option>
            <option value="worktree_exec">worktree_exec · ATLAS</option>
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={runSavage}
            className="rounded-[10px] bg-ink px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-50"
          >
            {busy ? "Kører…" : "Savage execute"}
          </button>
        </div>
        {msg && <p className="mt-3 text-[12.5px] text-muted">{msg}</p>}
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <section className="card rise p-5 lg:col-span-1">
          <h2 className="display text-[17px] font-semibold">Live feed</h2>
          <div className="mt-3 flex max-h-[420px] flex-col gap-2 overflow-auto">
            {live.length === 0 && (
              <p className="text-[12.5px] text-faint">Venter på SSE-events…</p>
            )}
            {live.map((line, i) => (
              <div key={`${i}-${line.slice(0, 12)}`} className="border-t border-line pt-2 text-[11.5px] text-muted first:border-t-0 first:pt-0">
                {line}
              </div>
            ))}
          </div>
        </section>

        <section className="card rise p-5">
          <h2 className="display text-[17px] font-semibold">Tasks</h2>
          <div className="mt-3 flex max-h-[420px] flex-col gap-2 overflow-auto">
            {tasks.slice(0, 12).map((t) => (
              <div key={t.id} className="rounded-[10px] border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{t.title}</span>
                  <span className="mono text-[10px] text-faint">{t.status}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  {t.assignedTo} · {t.type}
                  {t.branchName ? ` · ${t.branchName}` : ""}
                </div>
                {t.status === "awaiting_human" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void approveTask(t.id)}
                    className="mt-2 rounded-[8px] border border-line px-2.5 py-1 text-[11px] hover:bg-paper-2"
                  >
                    Human approve →
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="card rise p-5">
          <h2 className="display text-[17px] font-semibold">Journal</h2>
          <div className="mt-3 flex max-h-[420px] flex-col gap-2 overflow-auto">
            {journals.slice(0, 16).map((j) => (
              <div key={j.id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                <div className="mono text-[10px] text-faint">
                  {j.agent} · {j.kind}
                </div>
                <p className="mt-1 text-[12px] text-muted">{j.content}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="kicker">{label}</div>
      <div className="display mt-1 text-[22px] font-semibold">{value}</div>
    </div>
  );
}
