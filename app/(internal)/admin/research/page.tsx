"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchStaffSession } from "@/lib/staff-session";

type Track = {
  id: string;
  title: string;
  query: string;
  purpose: string;
  mdrNote: string;
  seedArxivIds: string[];
};

type Paper = {
  arxivId: string;
  title: string;
  url: string;
  summary?: string;
  source: string;
};

type Finding = {
  track: string;
  query: string;
  papers: Paper[];
  extractedActions: string[];
  live: boolean;
  at: string;
};

export default function ResearchAdminPage() {
  const [tenant, setTenant] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackId, setTrackId] = useState("rl_elearning");
  const [query, setQuery] = useState("");
  const [finding, setFinding] = useState<Finding | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetchStaffSession().then((me) => {
      if (me) setTenant(me.tenant);
    });
  }, []);

  const loadTracks = useCallback(async () => {
    if (!tenant) return;
    const res = await fetch(`/api/v1/${tenant}/research?view=tracks`, {
      credentials: "include",
    });
    const json = await res.json();
    setTracks(json.data ?? []);
  }, [tenant]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const harvest = async (journal: boolean) => {
    if (!tenant) return;
    setBusy(true);
    setMsg(null);
    try {
      if (journal) {
        const res = await fetch(`/api/v1/${tenant}/research`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            trackId,
            query: query || undefined,
            limit: 6,
          }),
        });
        const json = await res.json();
        if (!res.ok) setMsg(json.error ?? "fejl");
        else {
          setFinding(json.data);
          setMsg("Journaled to LUNA · NO_AUTO_MERGE");
        }
      } else {
        const params = new URLSearchParams({
          view: "harvest",
          track: trackId,
          limit: "6",
        });
        if (query) params.set("q", query);
        const res = await fetch(`/api/v1/${tenant}/research?${params}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) setMsg(json.error ?? "fejl");
        else setFinding(json.data);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="rise">
        <Link href="/admin/swarm" className="kicker hover:underline">
          ← S-H Swarm
        </Link>
        <h1 className="display mt-2 text-[30px] font-semibold leading-none">
          Alphaxiv Research
        </h1>
        <p className="mt-2 max-w-[640px] text-[13.5px] text-muted">
          Deep-research connector for tracks distilled from the Alphaxiv chat.
          Papers are citations for LUNA/swarm — never auto-merged to production.
          Tenant: {tenant ?? "…"}
        </p>
      </div>

      <section className="card rise mt-5 grid gap-3 p-5 md:grid-cols-2">
        <label className="block text-[12px] text-muted">
          Track
          <select
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px] text-ink"
          >
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] text-muted">
          Override query (optional)
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="free-text Alphaxiv search"
            className="mt-1 w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px]"
          />
        </label>
      </section>

      {tracks.find((t) => t.id === trackId) && (
        <p className="mt-3 text-[12.5px] text-muted">
          {tracks.find((t) => t.id === trackId)!.purpose}
          <br />
          <span className="mono text-[11px] text-faint">
            MDR: {tracks.find((t) => t.id === trackId)!.mdrNote}
          </span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !tenant}
          onClick={() => void harvest(false)}
          className="rounded-[10px] bg-ink px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-50"
        >
          Search Alphaxiv
        </button>
        <button
          type="button"
          disabled={busy || !tenant}
          onClick={() => void harvest(true)}
          className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] disabled:opacity-50"
        >
          Harvest → LUNA journal
        </button>
      </div>
      {msg && <p className="mt-2 mono text-[11px] text-faint">{msg}</p>}

      {finding && (
        <section className="card rise mt-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="display text-[17px] font-semibold">
              {finding.track}
            </h2>
            <span className="chip mono !text-[10px]">
              {finding.live ? "LIVE API" : "CATALOG/SEED"}
            </span>
          </div>
          <p className="mt-1 mono text-[11px] text-faint">{finding.query}</p>

          <ul className="mt-4 space-y-3">
            {finding.papers.map((p) => (
              <li key={p.arxivId} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13.5px] font-medium hover:underline"
                >
                  {p.arxivId} · {p.title}
                </a>
                {p.summary && (
                  <p className="mt-1 text-[12px] text-muted">{p.summary}</p>
                )}
              </li>
            ))}
          </ul>

          <h3 className="mt-5 text-[13px] font-semibold">Extracted actions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] text-muted">
            {finding.extractedActions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
