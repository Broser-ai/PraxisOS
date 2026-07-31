"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ClientProfile } from "@/lib/clients";

const TENANT = "bypilar";

function Trend({ t }: { t: "up" | "down" | "flat" }) {
  const map = {
    up: { d: "M3 17l6-6 4 4 8-8", c: "text-signal" },
    down: { d: "M3 7l6 6 4-4 8 8", c: "text-clay" },
    flat: { d: "M3 12h18", c: "text-faint" },
  }[t];
  return (
    <svg
      className={map.c}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={map.d} />
    </svg>
  );
}

export default function Klienter() {
  const [all, setAll] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [backend, setBackend] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/${TENANT}/clients`, {
          credentials: "include",
          headers: { authorization: "Bearer sk_test_ui" },
        });
        const json = await res.json();
        if (cancelled) return;
        setBackend(json.meta?.backend ?? "");
        setAll(
          (json.data ?? []).map(
            (c: {
              id: string;
              name: string;
              email: string;
              phone?: string;
              age?: number;
              tag?: string;
              joined?: string;
              lastVisit?: string;
              consentLevel?: string;
            }) => {
              const parts = String(c.name).trim().split(/\s+/);
              const initials =
                ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() ||
                "XX";
              return {
                id: c.id,
                name: c.name,
                initials,
                age: c.age ?? 0,
                tag: (c.tag as ClientProfile["tag"]) ?? "Fodpleje",
                email: c.email,
                phone: c.phone ?? "",
                cprMasked: "********-????",
                joined: c.joined ?? "",
                lastVisit: c.lastVisit ?? "—",
                trend: "flat" as const,
                consentLevel: (c.consentLevel as ClientProfile["consentLevel"]) ?? "Almindelig",
                mitidVerified: false,
              } satisfies ClientProfile;
            },
          ),
        );
      } catch {
        if (!cancelled) setAll([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          <div className="kicker">
            {all.length} aktive · EU-resident
            {backend ? ` · ${backend}` : ""}
            {loading ? " · henter…" : ""}
          </div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Klienter</h1>
        </div>
        <button type="button" className="btn btn-primary">
          + Ny klient
        </button>
      </div>

      <div className="rise mt-6 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-[10px] border border-line-2 bg-card p-0.5 text-[12px]">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
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
          className="ml-auto w-[280px] rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px]"
        />
      </div>

      <div className="card rise mt-3 overflow-hidden">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/klienter/${c.id}`}
            className="flex items-center gap-4 border-t border-line px-5 py-3.5 first:border-t-0 hover:bg-paper-2"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-paper-2 text-[12px] font-semibold">
              {c.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{c.name}</div>
              <div className="truncate text-[12px] text-muted">
                {c.email} · {c.tag}
              </div>
            </div>
            <div className="hidden text-[12px] text-muted md:block">{c.lastVisit}</div>
            <Trend t={c.trend} />
          </Link>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center text-[13px] text-faint">Ingen klienter</div>
        )}
      </div>
    </div>
  );
}
