"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SwarmStatus = {
  enabled: boolean;
  tasks: number;
  worktrees: number;
  journals: number;
  byStatus?: Record<string, number>;
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

const TENANT = "bypilar";

export default function SwarmAdminPage() {
  const [status, setStatus] = useState<SwarmStatus | null>(null);
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [title, setTitle] = useState("Savage improve · booking persistence");
  const [type, setType] = useState("improve");

  const refresh = useCallback(async () => {
    const [s, t, j] = await Promise.all([
      fetch(`/api/v1/${TENANT}/swarm`).then((r) => r.json()),
      fetch(`/api/v1/${TENANT}/swarm?view=tasks`).then((r) => r.json()),
      fetch(`/api/v1/${TENANT}/swarm?view=journals`).then((r) => r.json()),
    ]);
    setStatus(s);
    setTasks(t.data ?? []);
    setJournals(j.data ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runSavage = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/${TENANT}/swarm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "savage",
          type,
          title,
          brief: title,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? "fejl");
      } else {
        setMsg(`Task ${json.task?.id} → ${json.task?.status}`);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/agents" className="kicker hover:underline">
            ← Agenter
          </Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">
            S-H Swarm · Savage
          </h1>
          <p className="mt-2 max-w-[540px] text-[13.5px] text-muted">
            Autonom worktree-eksekvering med ARIA_META, ATLAS, LUNA, FELIX og FREJ-gate.
            Merge/deploy kræver eksplicit human approve — aldrig auto.
          </p>
        </div>
        <span className="chip mono !text-[11px]">
          {status?.enabled === false ? "disabled" : "swarm online"} · {status?.worktrees ?? 0} worktrees
        </span>
      </div>

      <section className="card rise mt-5 grid gap-3 p-5 md:grid-cols-4">
        <Stat label="Tasks" value={String(status?.tasks ?? 0)} />
        <Stat label="Worktrees" value={String(status?.worktrees ?? 0)} />
        <Stat label="Journals" value={String(status?.journals ?? 0)} />
        <Stat label="NO_AUTO_MERGE" value={status?.invariants?.NO_AUTO_MERGE ? "ON" : "?"} />
      </section>

      <section className="card rise mt-3 p-5">
        <h2 className="display text-[17px] font-semibold">Launch savage run</h2>
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
            onClick={() => void runSavage()}
            className="rounded-[10px] bg-ink px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-50"
          >
            {busy ? "Kører…" : "Savage execute"}
          </button>
        </div>
        {msg && <p className="mt-3 text-[12.5px] text-muted">{msg}</p>}
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="card rise p-5">
          <h2 className="display text-[17px] font-semibold">Tasks</h2>
          <div className="mt-3 flex flex-col gap-2">
            {tasks.length === 0 && (
              <p className="text-[12.5px] text-faint">Ingen tasks endnu.</p>
            )}
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
                {t.resultSummary && (
                  <p className="mt-2 whitespace-pre-wrap text-[11.5px] text-ink-soft">
                    {t.resultSummary.slice(0, 280)}
                  </p>
                )}
                {t.error && <p className="mt-1 text-[11px] text-clay">{t.error}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="card rise p-5">
          <h2 className="display text-[17px] font-semibold">Journal</h2>
          <div className="mt-3 flex flex-col gap-2">
            {journals.slice(0, 16).map((j) => (
              <div key={j.id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                <div className="mono text-[10px] text-faint">
                  {j.agent} · {j.kind} · {new Date(j.at).toLocaleTimeString("da-DK")}
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
