"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { statusLabel, sourceLabel, type Booking, type BookingStatus } from "@/lib/bookings";

const STATUSES: BookingStatus[] = ["confirmed", "completed", "pending", "noshow", "cancelled"];
const TENANT = "bypilar";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }),
  };
}

type ApiBooking = {
  id: string;
  status: BookingStatus;
  startsAt: string;
  durationMin: number;
  service: { id: string; name: string };
  client: { id: string; name: string };
  practitioner: string;
  modality: Booking["modality"];
  priceKr: number;
  paid: boolean;
};

function toBooking(b: ApiBooking): Booking {
  const name = b.client?.name ?? "Klient";
  const parts = name.trim().split(/\s+/);
  const initials =
    ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "XX";
  return {
    id: b.id,
    tenant: TENANT,
    clientId: b.client?.id ?? "",
    clientName: name,
    clientInitials: initials,
    service: b.service?.name ?? "Ydelse",
    serviceId: b.service?.id ?? "",
    practitioner: b.practitioner ?? "Klinik",
    startsAt: b.startsAt,
    durationMin: b.durationMin,
    modality: b.modality ?? "Klinik",
    status: b.status,
    priceKr: b.priceKr,
    paid: b.paid,
    noShowRisk: 0,
    source: "admin",
  };
}

export default function BookingsAdmin() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [backend, setBackend] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/${TENANT}/bookings/list?limit=100`, {
          credentials: "include",
          headers: { authorization: "Bearer sk_test_ui" },
        });
        const json = await res.json();
        if (cancelled) return;
        setBackend(json.meta?.backend ?? "");
        setRows((json.data ?? []).map(toBooking));
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );
    return sorted.filter((b) => {
      if (filter !== "all" && b.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !b.clientName.toLowerCase().includes(q) &&
          !b.service.toLowerCase().includes(q) &&
          !b.id.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [filter, search, rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of STATUSES) c[s] = rows.filter((b) => b.status === s).length;
    return c;
  }, [rows]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">
            Booking-administration · {rows.length} bookings
            {backend ? ` · ${backend}` : ""}
            {loading ? " · henter…" : ""}
          </div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Bookings</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost">
            Eksportér CSV
          </button>
          <button type="button" className="btn btn-primary">
            + Manuel booking
          </button>
        </div>
      </div>

      <div className="rise mt-6 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-[10px] border border-line-2 bg-card p-0.5 text-[12px]">
          {([["all", "Alle"] as const, ...STATUSES.map((s) => [s, statusLabel[s].label] as const)]).map(
            ([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k as BookingStatus | "all")}
                className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5"
                style={{
                  background: filter === k ? "var(--color-ink)" : "transparent",
                  color: filter === k ? "var(--color-paper)" : "var(--color-muted)",
                }}
              >
                {label}
                <span className="mono text-[10px] opacity-60">{counts[k]}</span>
              </button>
            ),
          )}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg navn, ydelse, booking-id…"
          className="ml-auto w-[300px] rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px] outline-none focus:border-ink"
        />
      </div>

      <div className="card rise mt-3 overflow-hidden" style={{ animationDelay: "0.06s" }}>
        <div className="hidden grid-cols-[140px_1fr_180px_120px_100px_110px_60px] gap-3 border-b border-line bg-paper-2/50 px-5 py-2.5 lg:grid">
          {["Tid", "Klient · ydelse", "Behandler · kilde", "Modality", "Pris", "Status", ""].map((h) => (
            <div key={h} className="kicker">
              {h}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="grid place-items-center py-16 text-center text-[13px] text-faint">
            {loading ? "Henter bookings…" : "Ingen bookings matcher dit filter"}
          </div>
        )}

        {filtered.map((b) => {
          const t = fmtDateTime(b.startsAt);
          const st = statusLabel[b.status];
          return (
            <Link
              key={b.id}
              href={`/bookings/${b.id}`}
              className="grid grid-cols-[1fr_auto] gap-3 border-t border-line px-5 py-3.5 transition-colors first:border-t-0 hover:bg-paper-2 lg:grid-cols-[140px_1fr_180px_120px_100px_110px_60px] lg:items-center"
            >
              <div>
                <div className="mono text-[12.5px] font-medium">{t.date}</div>
                <div className="mono text-[11px] text-faint">{t.time}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper-2 text-[11px] font-semibold">
                  {b.clientInitials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium">{b.clientName}</div>
                  <div className="truncate text-[12px] text-muted">{b.service}</div>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="text-[12.5px]">{b.practitioner}</div>
                <div className="mono text-[10.5px] text-faint">via {sourceLabel[b.source]}</div>
              </div>
              <div className="hidden lg:block">
                <span className="chip mono !text-[10.5px]">{b.modality}</span>
              </div>
              <div className="hidden lg:block">
                <div className="mono text-[12.5px] font-semibold">{b.priceKr} kr</div>
                <div className={`mono text-[10px] ${b.paid ? "text-signal" : "text-faint"}`}>
                  {b.paid ? "betalt" : "afventer"}
                </div>
              </div>
              <div className="hidden lg:block">
                <span
                  className="rounded-full px-2.5 py-1 text-[10.5px] font-medium"
                  style={{ background: st.bg, color: st.color }}
                >
                  {st.label}
                </span>
              </div>
              <div className="hidden text-right text-faint lg:block">→</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
