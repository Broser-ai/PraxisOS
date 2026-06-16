"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { listClients } from "@/lib/clients";

function Trend({ t }: { t: "up" | "down" | "flat" }) {
  const map = {
    up: { d: "M3 17l6-6 4 4 8-8", c: "text-signal" },
    down: { d: "M3 7l6 6 4-4 8 8", c: "text-clay" },
    flat: { d: "M3 12h18", c: "text-faint" },
  }[t];
  return (
    <svg className={map.c} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={map.d} />
    </svg>
  );
}

export default function Klienter() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const all = listClients();
  const tags = ["all", ...Array.from(new Set(all.map((c) => c.tag)))];
  const filtered = useMemo(() => {
    return all.filter((c) => {
      if (filter !== "all" && c.tag !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [filter, search, all]);

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex items-end justify-between">
        <div>
          <div className="kicker">{all.length} aktive · EU-resident · krypteret</div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Klienter</h1>
        </div>
        <button className="btn btn-primary">+ Ny klient</button>
      </div>

      <div className="rise mt-6 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-[10px] border border-line-2 bg-card p-0.5 text-[12px]">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className="rounded-[8px] px-2.5 py-1.5"
              style={{
                background: filter === t ? "var(--color-ink)" : "transparent",
                color: filter === t ? "var(--color-paper)" : "var(--color-muted)",
              }}
            >
              {t === "all" ? "Alle" : t}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg navn eller e-mail…"
          className="ml-auto w-[300px] rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px] outline-none focus:border-ink"
        />
      </div>

      <div className="card rise mt-3 overflow-hidden" style={{ animationDelay: "0.06s" }}>
        <div className="hidden grid-cols-[1fr_140px_160px_120px_60px] gap-4 border-b border-line px-5 py-2.5 md:grid">
          {["Navn", "Kategori", "Forløb", "Seneste", ""].map((h) => (
            <div key={h} className="kicker">{h}</div>
          ))}
        </div>
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/klienter/${c.id}`}
            className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-line px-5 py-3.5 transition-colors first:border-t-0 hover:bg-paper-2 md:grid-cols-[1fr_140px_160px_120px_60px]"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-paper-2 text-[12px] font-semibold">{c.initials}</div>
              <div>
                <div className="flex items-center gap-2 text-[14px] font-medium">
                  {c.name}
                  {c.mitidVerified && (
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-signal/14 text-signal" title="MitID-verificeret">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-faint">{c.age} år · {c.email}</div>
              </div>
            </div>
            <span className="chip hidden md:inline-flex">{c.tag}</span>
            <div className="hidden md:block">
              {c.forloeb ? (
                <>
                  <div className="text-[11.5px] font-medium">{c.forloeb.name}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-paper-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${c.forloeb.progress}%` }} />
                    </div>
                    <span className="mono text-[10px] text-faint">{c.forloeb.sessions}/{c.forloeb.total}</span>
                  </div>
                </>
              ) : <span className="text-[12px] text-faint">—</span>}
            </div>
            <span className="hidden text-[13px] text-muted md:block">{c.lastVisit}</span>
            <div className="flex justify-end"><Trend t={c.trend} /></div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[13px] text-faint">Ingen klienter matcher filteret</div>
        )}
      </div>
    </div>
  );
}
