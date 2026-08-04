"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NotificationRecord } from "@/lib/integrations/types";
import { fetchStaffSession } from "@/lib/staff-session";

export default function NotificationsAdmin() {
  const [tenant, setTenant] = useState<string | null>(null);
  const [rows, setRows] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    toPhone: "",
    channels: "in_app,sms",
  });

  const reload = async (slug: string) => {
    const res = await fetch(`/api/v1/${slug}/notifications`, {
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Kunne ikke hente notifikationer");
      setRows([]);
      return;
    }
    setError(null);
    setRows(json.data ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const me = await fetchStaffSession();
      if (!me || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      setTenant(me.tenant);
      await reload(me.tenant);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async () => {
    if (!tenant) return;
    setSending(true);
    try {
      const channels = form.channels
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean) as Array<"in_app" | "sms" | "email">;
      const res = await fetch(`/api/v1/${tenant}/notifications`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "custom",
          title: form.title,
          body: form.body,
          channels,
          audience: channels.includes("in_app") ? "both" : "client",
          toPhone: form.toPhone || undefined,
          recipientName: "Modtager",
          flush: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Send fejlede");
        return;
      }
      setForm({ title: "", body: "", toPhone: "", channels: "in_app,sms" });
      await reload(tenant);
    } finally {
      setSending(false);
    }
  };

  const markRead = async (id: string) => {
    if (!tenant) return;
    await fetch(`/api/v1/${tenant}/notifications/${id}/read`, {
      method: "POST",
      credentials: "include",
    });
    await reload(tenant);
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/nemsms" className="kicker hover:underline">
            ← NemSMS / messaging
          </Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">
            Notifikationer
          </h1>
          <p className="mt-2 text-[13.5px] text-muted">
            In-app + SMS/e-mail via outbox. Samme motor som booking-bekræftelser.
          </p>
        </div>
        <div className="kicker">{tenant ?? "…"} · {loading ? "henter…" : `${rows.length} stk`}</div>
      </div>

      <section className="card rise mt-5 p-5">
        <div className="kicker">Send notifikation</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-[12px]">
            <span className="kicker">Titel</span>
            <input
              className="mt-1 w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px]"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="block text-[12px]">
            <span className="kicker">Telefon (til SMS)</span>
            <input
              className="mt-1 w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px]"
              value={form.toPhone}
              onChange={(e) => setForm({ ...form, toPhone: e.target.value })}
              placeholder="+45…"
            />
          </label>
        </div>
        <label className="mt-3 block text-[12px]">
          <span className="kicker">Besked</span>
          <textarea
            className="mt-1 w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px]"
            rows={3}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        <label className="mt-3 block text-[12px]">
          <span className="kicker">Kanaler</span>
          <select
            className="mt-1 w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px] md:w-[320px]"
            value={form.channels}
            onChange={(e) => setForm({ ...form, channels: e.target.value })}
          >
            <option value="in_app">Kun in-app (staff)</option>
            <option value="in_app,sms">In-app + SMS</option>
            <option value="sms">Kun SMS</option>
            <option value="in_app,email">In-app + e-mail</option>
          </select>
        </label>
        {error && <p className="mt-3 text-[13px] text-clay">{error}</p>}
        <div className="mt-4">
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending || !form.title || !form.body}
            onClick={() => void send()}
          >
            {sending ? "Sender…" : "Send notifikation"}
          </button>
        </div>
      </section>

      <section className="card rise mt-3 overflow-hidden">
        {rows.length === 0 && (
          <div className="py-14 text-center text-[13px] text-faint">
            {loading ? "Henter…" : "Ingen notifikationer endnu"}
          </div>
        )}
        {rows.map((n) => (
          <div
            key={n.id}
            className="flex flex-wrap items-start gap-3 border-t border-line px-5 py-3.5 first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium">{n.title}</span>
                <span className="chip mono !text-[10px]">{n.kind}</span>
                <span className="chip mono !text-[10px]">{n.channels.join("+")}</span>
                <span className="mono text-[10px] text-faint">{n.status}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-soft">{n.body}</p>
              <div className="mt-1 mono text-[10.5px] text-faint">
                {new Date(n.createdAt).toLocaleString("da-DK")}
                {n.toPhone ? ` · ${n.toPhone}` : ""}
                {n.bookingId ? ` · ${n.bookingId}` : ""}
              </div>
            </div>
            {n.channels.includes("in_app") && !n.readAt && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void markRead(n.id)}
              >
                Marker læst
              </button>
            )}
            {n.readAt && (
              <span className="mono text-[10px] text-signal">læst</span>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
