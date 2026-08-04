"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NEMSMS_CONFIG, NEMSMS_TEMPLATES, CATEGORY_LABEL, type NemSmsCategory } from "@/lib/nemsms";
import type { OutboxMessage } from "@/lib/integrations/types";
import { listTenants } from "@/lib/tenants";

const ALL_CATEGORIES: NemSmsCategory[] = ["booking_confirm", "reminder_24h", "reminder_1h", "cancellation", "prescription", "treatment_results"];

export default function NemSmsAdmin() {
  const tenants = listTenants();
  const [activeTenant, setActiveTenant] = useState(tenants[0].slug);
  const cfg = NEMSMS_CONFIG[activeTenant];
  const [logs, setLogs] = useState<OutboxMessage[]>([]);
  const [outboxMeta, setOutboxMeta] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/${activeTenant}/messages/outbox`, {
          credentials: "include",
        });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setLogs(json.data ?? []);
          setOutboxMeta(
            `${json.meta?.messagingMode ?? "?"} · nemsmsConfigured=${Boolean(json.meta?.nemsmsConfigured)}`,
          );
        } else {
          setLogs([]);
          setOutboxMeta(json.error ?? "unauthorized");
        }
      } catch {
        if (!cancelled) {
          setLogs([]);
          setOutboxMeta("fetch_failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTenant]);

  const stats = {
    sent30d: logs.filter((l) => l.status === "delivered" || l.status === "sent").length,
    failed30d: logs.filter((l) => l.status === "failed").length,
    spent30dKr: logs.reduce((s, l) => s + l.costOere, 0) / 100,
    deliveryRate:
      logs.length > 0
        ? (logs.filter((l) => l.status === "delivered" || l.status === "sent").length /
            logs.length) *
          100
        : 0,
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">NemSMS</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Officiel sundheds-SMS via Sundhedsdatanettet · KOMBIT-registreret afsender-ID · gratis for borger.
          </p>
        </div>
        <button className="btn btn-ghost">Templates →</button>
      </div>

      {/* Tenant-vælger */}
      <div className="rise mt-6 flex flex-wrap gap-2">
        {tenants.map((t) => (
          <button
            key={t.slug}
            onClick={() => setActiveTenant(t.slug)}
            className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2"
            style={{
              borderColor: activeTenant === t.slug ? "var(--color-ink)" : "var(--color-line-2)",
              background: activeTenant === t.slug ? "var(--color-paper-2)" : "var(--color-card)",
            }}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold" style={{ background: t.brand.ink, color: t.brand.paper }}>
              {t.brand.name.charAt(0)}
            </span>
            <span className="text-[13px] font-medium">{t.brand.name}</span>
          </button>
        ))}
      </div>

      {/* Status-overview */}
      <div className="rise mt-3 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        <Stat label="Sender-ID" value={cfg?.senderId ?? "—"} mono color={cfg?.senderIdStatus === "approved" ? "var(--color-signal)" : "var(--color-amber)"} />
        <Stat label="Status" value={cfg?.senderIdStatus === "approved" ? "Godkendt" : "Afventer KOMBIT"} color={cfg?.senderIdStatus === "approved" ? "var(--color-signal)" : "var(--color-amber)"} />
        <Stat label="Tilmeldte borgere" value={cfg?.citizensSubscribed.toLocaleString("da-DK") ?? "0"} />
        <Stat label="Sendt 30 dage" value={stats.sent30d.toString()} sub={`${stats.deliveryRate.toFixed(1)}% leveret`} highlight />
      </div>

      {/* Sender-ID konfiguration */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.08s" }}>
        <h2 className="display text-[17px] font-semibold">Sender-ID · KOMBIT-registrering</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="kicker mb-1.5">Godkendt afsender-navn</div>
            <div className="flex items-center gap-2 rounded-[10px] border border-line-2 bg-paper px-3 py-2.5">
              <span className="mono text-[14px] font-semibold">{cfg?.senderId ?? "—"}</span>
              {cfg?.senderIdStatus === "approved" ? (
                <span className="ml-auto chip mono !text-[10px] !border-signal/40 text-signal">● godkendt</span>
              ) : (
                <span className="ml-auto chip mono !text-[10px] !border-amber/40 text-amber">○ afventer</span>
              )}
            </div>
            <div className="mt-1 mono text-[10.5px] text-faint">11 tegn alfanumerisk · KOMBIT-ID: {cfg?.kombitId}</div>
          </div>
          <div>
            <div className="kicker mb-1.5">Månedligt loft</div>
            <div className="flex items-center gap-2 rounded-[10px] border border-line-2 bg-paper px-3 py-2.5">
              <span className="text-[14px] font-semibold">{cfg?.monthlyCapKr.toLocaleString("da-DK")} kr</span>
              <span className="ml-auto mono text-[11px] text-faint">{stats.spent30dKr.toFixed(2)} kr brugt</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (stats.spent30dKr / (cfg?.monthlyCapKr || 1)) * 100)}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Message templates */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.12s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Beskedskabeloner</h2>
          <span className="mono text-[10.5px] text-faint">variabler · {"{name}, {clinic}, {date}, {time}, {service}, {link}"}</span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {ALL_CATEGORIES.map((cat) => {
            const tpl = NEMSMS_TEMPLATES[cat];
            return (
              <div key={cat} className="rounded-[11px] border border-line bg-paper p-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold">{CATEGORY_LABEL[cat]}</div>
                  <span className="chip mono !text-[10px] !py-0">
                    {cat === "reminder_24h" || cat === "booking_confirm" ? "default ON" : "valgfri"}
                  </span>
                </div>
                <div className="mt-1 text-[10.5px] text-faint mono">"{tpl.title}"</div>
                <p className="mt-2 text-[12px] text-ink-soft leading-relaxed">{tpl.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Outbox */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.16s" }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="display text-[17px] font-semibold">Message outbox</h2>
          <span className="chip mono !text-[10px] text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
            {outboxMeta || "…"}
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-faint">
              <tr className="border-b border-line">
                {["ID", "Kategori", "Modtager", "Telefon", "Booking", "Planlagt", "Status", "Pris"].map((h) => (
                  <th key={h} className="kicker text-left pb-2 pr-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-line/60 last:border-b-0">
                  <td className="py-2 pr-3 mono text-[11px]">{l.id}</td>
                  <td className="py-2 pr-3 text-[11.5px]">{CATEGORY_LABEL[l.category]}</td>
                  <td className="py-2 pr-3 font-medium">{l.recipientName}</td>
                  <td className="py-2 pr-3 mono text-[10.5px] text-faint">{l.toPhone ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {l.bookingId ? (
                      <Link href={`/bookings/${l.bookingId}`} className="mono text-accent hover:underline">
                        {l.bookingId}
                      </Link>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 mono text-[10.5px] text-faint">
                    {new Date(l.sentAt ?? l.scheduledAt).toLocaleString("da-DK", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`mono text-[10.5px] ${
                        l.status === "delivered" || l.status === "sent"
                          ? "text-signal"
                          : l.status === "failed"
                            ? "text-clay"
                            : "text-amber"
                      }`}
                    >
                      ● {l.status}
                    </span>
                    {l.errorCode && <div className="mt-0.5 text-[9.5px] text-clay">{l.errorCode}</div>}
                  </td>
                  <td className="py-2 pr-3 mono">{(l.costOere / 100).toFixed(2)} kr</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <div className="py-10 text-center text-[12.5px] text-faint">
              Ingen outbox-beskeder for denne tenant endnu (opret en booking).
            </div>
          )}
        </div>
      </section>

      {/* Compliance-disclaimer */}
      <div className="mt-3 rounded-[12px] border border-line bg-paper-2/60 p-5 text-[12.5px] text-ink-soft">
        <div className="kicker">Compliance</div>
        <p className="mt-2 max-w-[760px]">
          NemSMS er kun tilladt til sundheds-relevante beskeder · ikke marketing. Borgere kan opt-out på
          <code className="mono"> borger.dk → NemSMS</code>. Alle sendte beskeder gemmes i 5 år iht. sundhedslovens journaliseringspligt.
          Pris pr. SMS: <b>{(cfg?.costPerSmsOere ?? 50) / 100} kr</b> · faktureres månedligt via KOMBIT.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, mono, color, highlight }: { label: string; value: string; sub?: string; mono?: boolean; color?: string; highlight?: boolean }) {
  return (
    <div className="card p-3" style={highlight && color ? { borderColor: color, background: `color-mix(in srgb, ${color} 5%, var(--color-card))` } : {}}>
      <div className="kicker !text-[9px]">{label}</div>
      <div className={`mt-1 ${mono ? "mono" : ""} text-[14px] font-semibold`} style={color ? { color } : {}}>{value}</div>
      {sub && <div className="mono text-[10px] text-faint">{sub}</div>}
    </div>
  );
}
