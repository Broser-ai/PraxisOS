"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ClientProfile } from "@/lib/clients";
import { fetchStaffSession } from "@/lib/staff-session";

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

function mapApiClient(c: {
  id: string;
  name: string;
  email: string;
  phone?: string;
  age?: number;
  tag?: string;
  joined?: string;
  lastVisit?: string;
  consentLevel?: string;
}): ClientProfile {
  const parts = String(c.name).trim().split(/\s+/);
  const initials =
    ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "XX";
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
    trend: "flat",
    consentLevel: (c.consentLevel as ClientProfile["consentLevel"]) ?? "Almindelig",
    mitidVerified: false,
  };
}

export default function Klienter() {
  const [tenant, setTenant] = useState<string | null>(null);
  const [all, setAll] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [backend, setBackend] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const reload = async (tenantSlug: string) => {
    const res = await fetch(`/api/v1/${tenantSlug}/clients`, { credentials: "include" });
    const json = await res.json();
    setBackend(json.meta?.backend ?? "");
    setAll((json.data ?? []).map(mapApiClient));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const me = await fetchStaffSession();
        if (!me || cancelled) {
          if (!cancelled) setAll([]);
          return;
        }
        setTenant(me.tenant);
        await reload(me.tenant);
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

  const submitCreate = async () => {
    if (!tenant) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/v1/${tenant}/clients`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error ?? "Kunne ikke oprette klient");
        return;
      }
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "" });
      await reload(tenant);
    } catch {
      setCreateError("Netværksfejl");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex items-end justify-between">
        <div>
          <div className="kicker">
            {tenant ?? "…"} · {all.length} aktive · EU-resident
            {backend ? ` · ${backend}` : ""}
            {loading ? " · henter…" : ""}
          </div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Klienter</h1>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setCreateError(null);
            setShowCreate(true);
          }}
        >
          + Ny klient
        </button>
      </div>

      {showCreate && (
        <div className="card rise mt-4 p-5">
          <div className="kicker">Ny klient</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block text-[12px]">
              <span className="kicker">Navn</span>
              <input
                className="mt-1 w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px]"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block text-[12px]">
              <span className="kicker">E-mail</span>
              <input
                type="email"
                className="mt-1 w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px]"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="block text-[12px]">
              <span className="kicker">Telefon</span>
              <input
                className="mt-1 w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px]"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
          </div>
          {createError && <p className="mt-3 text-[13px] text-clay">{createError}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowCreate(false)}
              disabled={creating}
            >
              Annuller
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={creating || !form.name || !form.email}
              onClick={() => void submitCreate()}
            >
              {creating ? "Gemmer…" : "Gem klient"}
            </button>
          </div>
        </div>
      )}

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
