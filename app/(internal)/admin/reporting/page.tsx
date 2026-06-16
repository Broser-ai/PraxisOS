"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { reports, reportStats, buildPayload, STATUS_LABEL, type ReportStatus, type Report } from "@/lib/reporting";

const FORMAT_LABEL: Record<string, string> = {
  EDI_DANMARK:    "EDI · Sygesikringen \"danmark\"",
  MEDCOM:         "MedCom XML · afr01",
  KOMMUNAL_API:   "KOMBIT API · kommune",
  FORSIKRING_API: "REST · forsikringsselskab",
  MANUEL:         "Manuel indberetning",
};

const FORMAT_COLOR: Record<string, string> = {
  EDI_DANMARK:    "var(--color-clay)",
  MEDCOM:         "var(--color-accent)",
  KOMMUNAL_API:   "var(--color-signal)",
  FORSIKRING_API: "var(--color-amber)",
  MANUEL:         "var(--color-faint)",
};

export default function ReportingConsole() {
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [selected, setSelected] = useState<Report | null>(reports[2] ?? null);

  const stats = reportStats("bypilar");
  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [statusFilter]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/subsidies" className="kicker hover:underline">← Tilskudsordninger</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Indberetning</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Automatisk indberetning til sygesikring, kommune og private forsikringer · EDI · MedCom XML · KOMBIT API.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost">Eksportér CSV</button>
          <button className="btn btn-primary">Send afventende ({stats.queued})</button>
        </div>
      </div>

      {/* Stats */}
      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-5" style={{ animationDelay: "0.04s" }}>
        <Stat label="I kø" value={stats.queued} color="var(--color-amber)" />
        <Stat label="Sender" value={stats.sending} color="var(--color-accent)" />
        <Stat label="Kvitteret" value={stats.ack} color="var(--color-signal)" />
        <Stat label="Afvist" value={stats.rejected} color="var(--color-clay)" />
        <Stat label="Refunderet i alt" value={`${stats.totalReimbursedKr} kr`} color="var(--color-signal)" highlight />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Liste */}
        <section className="card rise overflow-hidden p-0" style={{ animationDelay: "0.08s" }}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            <h2 className="display text-[16px] font-semibold">Indberetninger</h2>
            <div className="ml-auto flex items-center gap-1 rounded-[10px] border border-line-2 bg-paper p-0.5 text-[11px]">
              {[["all","Alle"],["queued","I kø"],["sending","Sender"],["ack_received","Kvitteret"],["rejected","Afvist"]].map(([k,label]) => (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k as any)}
                  className="rounded-[8px] px-2 py-1"
                  style={{
                    background: statusFilter === k ? "var(--color-ink)" : "transparent",
                    color: statusFilter === k ? "var(--color-paper)" : "var(--color-muted)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="scrollbar-thin max-h-[520px] overflow-y-auto">
            {filtered.map((r) => {
              const st = STATUS_LABEL[r.status];
              const isSelected = selected?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full border-b border-line px-5 py-3 text-left transition-colors hover:bg-paper-2"
                  style={isSelected ? { background: "var(--color-paper-2)", borderLeftWidth: 3, borderLeftColor: "var(--color-ink)" } : {}}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="mono text-[11.5px] font-semibold">{r.id}</span>
                        <span className="mono text-[10.5px] text-faint">→ {r.bookingId}</span>
                      </div>
                      <div className="mt-1 text-[12.5px]">{FORMAT_LABEL[r.format]}</div>
                      <div className="mt-0.5 mono text-[10.5px] text-faint">{r.authority}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono text-[13px] font-semibold">{r.amountKr} kr</div>
                      <div
                        className="mt-1 mono text-[10px]"
                        style={{ color: st.color }}
                      >
                        ● {st.label}
                      </div>
                    </div>
                  </div>
                  {r.errorMessage && (
                    <div className="mt-1.5 rounded-[6px] bg-clay/10 px-2 py-1 text-[10.5px] text-clay">
                      ⚠ {r.errorMessage}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Detalje · payload */}
        {selected ? (
          <section className="card rise overflow-hidden p-0" style={{ animationDelay: "0.12s" }}>
            <div className="border-b border-line px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="kicker">Indberetning · {selected.id}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                  style={{
                    background: `color-mix(in srgb, ${STATUS_LABEL[selected.status].color} 14%, transparent)`,
                    color: STATUS_LABEL[selected.status].color,
                  }}
                >
                  {STATUS_LABEL[selected.status].label}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px]">
                <KV label="Myndighed">{selected.authority}</KV>
                <KV label="Format">{FORMAT_LABEL[selected.format]}</KV>
                <KV label="Booking">
                  <Link href={`/bookings/${selected.bookingId}`} className="mono text-accent hover:underline">{selected.bookingId}</Link>
                </KV>
                <KV label="Beløb"><span className="mono">{selected.amountKr} kr</span></KV>
                <KV label="Service-kode"><span className="mono">{selected.serviceCode}</span></KV>
                <KV label="Oprettet"><span className="mono text-faint">{new Date(selected.createdAt).toLocaleString("da-DK")}</span></KV>
                {selected.sentAt && <KV label="Sendt"><span className="mono text-faint">{new Date(selected.sentAt).toLocaleString("da-DK")}</span></KV>}
                {selected.ackReference && <KV label="Kvittering-ref"><span className="mono text-signal">{selected.ackReference}</span></KV>}
              </div>

              {selected.errorMessage && (
                <div className="mt-3 rounded-[8px] border border-clay/30 bg-clay/[0.06] p-2.5 text-[11.5px] text-ink-soft">
                  <span className="kicker !text-clay">{selected.errorCode}</span>
                  <div className="mt-0.5">{selected.errorMessage}</div>
                </div>
              )}
            </div>

            {/* Payload */}
            <div className="flex items-center justify-between px-5 py-2 text-[10.5px] text-faint">
              <span className="kicker">Payload</span>
              <span className="mono">{FORMAT_LABEL[selected.format]}</span>
            </div>
            <div className="scrollbar-thin overflow-auto bg-ink px-5 py-3 text-paper">
              <pre className="mono text-[10.5px] leading-relaxed whitespace-pre-wrap">{buildPayload(selected)}</pre>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
              {selected.status === "queued" && (
                <button className="btn btn-primary !py-1.5 !text-[11.5px]">Send nu</button>
              )}
              {selected.status === "rejected" && (
                <button className="btn btn-primary !py-1.5 !text-[11.5px]">Genindberet</button>
              )}
              <button className="btn btn-ghost !py-1.5 !text-[11.5px]">Download payload</button>
              <button className="btn btn-ghost !py-1.5 !text-[11.5px]">Audit-log →</button>
            </div>
          </section>
        ) : (
          <section className="card rise p-5 text-center text-[13px] text-faint" style={{ animationDelay: "0.12s" }}>
            Vælg en indberetning til venstre for detaljer
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: string | number; color: string; highlight?: boolean }) {
  return (
    <div
      className="card p-3"
      style={highlight ? { borderColor: color, background: `color-mix(in srgb, ${color} 5%, var(--color-card))` } : {}}
    >
      <div className="kicker !text-[9px]">{label}</div>
      <div className={`mt-1 display text-[20px] font-semibold leading-none`} style={highlight ? { color } : {}}>{value}</div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kicker !text-[8.5px]">{label}</div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}
