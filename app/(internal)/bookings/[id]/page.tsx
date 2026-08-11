import Link from "next/link";
import { notFound } from "next/navigation";
import { getBooking, statusLabel, sourceLabel } from "@/lib/bookings";
import { calcFee, TENANT_PAYMENT_CONFIG } from "@/lib/payments";
import { getJournalByBooking, statusLabel as journalStatusLabel } from "@/lib/journal";

export const dynamic = "force-dynamic";

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = getBooking(id);
  if (!b) notFound();
  const journal = getJournalByBooking(b.id);

  const d = new Date(b.startsAt);
  const dateLong = d.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  const endTime = new Date(d.getTime() + b.durationMin * 60_000).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  const st = statusLabel[b.status];

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/bookings" className="kicker hover:underline">← Alle bookings</Link>
          <h1 className="display mt-2 text-[28px] font-semibold leading-tight">{b.service}</h1>
          <div className="mt-1.5 mono text-[12px] text-faint">{b.id}</div>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[12px] font-medium"
          style={{ background: st.bg, color: st.color }}
        >
          {st.label}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr]">
        {/* Detalje */}
        <section className="card rise p-6" style={{ animationDelay: "0.06s" }}>
          <div className="kicker mb-4">Detalje</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
            <Field label="Klient">
              <Link href={`/klienter/${b.clientId}`} className="flex items-center gap-2 hover:underline">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-paper-2 text-[10.5px] font-semibold">{b.clientInitials}</span>
                {b.clientName}
              </Link>
            </Field>
            <Field label="Behandler">{b.practitioner}</Field>
            <Field label="Dato">{dateLong}</Field>
            <Field label="Tid">{time} – {endTime} <span className="mono text-faint">({b.durationMin} min)</span></Field>
            <Field label="Modality">{b.modality}</Field>
            <Field label="Kilde">{sourceLabel[b.source]}</Field>
            <Field label="Pris">{b.priceKr} kr</Field>
            <Field label="Betaling">
              <span className={b.paid ? "text-signal" : "text-amber"}>{b.paid ? "✓ Betalt" : "Afventer"}</span>
            </Field>
            {b.noShowRisk > 0 && (
              <Field label="No-show risiko">
                <span className={b.noShowRisk > 50 ? "text-clay" : b.noShowRisk > 25 ? "text-amber" : "text-signal"}>{b.noShowRisk}%</span>
              </Field>
            )}
          </div>

          {b.notes && (
            <div className="mt-6 rounded-[10px] bg-paper-2 p-3 text-[12.5px] text-ink-soft">
              <div className="kicker mb-1">Note</div>
              {b.notes}
            </div>
          )}

          {/* PraxisOS Pay · payment-info */}
          {(() => {
            const cfg = TENANT_PAYMENT_CONFIG[b.tenant];
            if (!cfg) return null;
            const { feeKr, netKr } = calcFee(b.priceKr, b.tenant);
            const pspRef = "8516" + Math.abs(b.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 1234567).toString().padStart(12, "0").slice(0, 12);
            return (
              <div className="mt-6 overflow-hidden rounded-[12px] border border-line bg-paper-2/40">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="kicker !text-[9px]">PraxisOS Pay · transaktion</span>
                    <span className="mono text-[10.5px] text-faint">pay_{b.id.replace("bk_", "")}</span>
                  </div>
                  <span className={`mono text-[10.5px] ${b.paid ? "text-signal" : "text-amber"}`}>
                    {b.paid ? "● captured" : "○ authorized"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-4 py-3.5 text-[12px]">
                  <div>
                    <div className="kicker !text-[8.5px]">Betalingsmetode</div>
                    <div className="mt-0.5 font-medium">{cfg.defaultMethod === "mobilepay" ? "MobilePay" : "Kort"}</div>
                  </div>
                  <div>
                    <div className="kicker !text-[8.5px]">PraxisTrust</div>
                    <div className="mt-0.5 font-medium text-signal">MitID · frictionless</div>
                  </div>
                  <div>
                    <div className="kicker !text-[8.5px]">PraxisRisk</div>
                    <div className="mt-0.5 font-medium">12 / 100 · lav</div>
                  </div>
                  <div>
                    <div className="kicker !text-[8.5px]">Brutto</div>
                    <div className="mt-0.5 mono">{b.priceKr.toFixed(2)} kr</div>
                  </div>
                  <div>
                    <div className="kicker !text-[8.5px]">Gebyr</div>
                    <div className="mt-0.5 mono text-clay">−{feeKr.toFixed(2)} kr</div>
                  </div>
                  <div>
                    <div className="kicker !text-[8.5px]">Netto til klinik</div>
                    <div className="mt-0.5 mono font-semibold text-signal">{netKr.toFixed(2)} kr</div>
                  </div>
                </div>
                <div className="border-t border-line px-4 py-2.5 flex flex-wrap gap-2">
                  {!b.paid && b.status === "confirmed" && (
                    <button className="rounded-[8px] bg-ink px-3 py-1 text-[11px] font-medium text-paper">Capture nu</button>
                  )}
                  {b.paid && (
                    <button className="rounded-[8px] border border-clay/40 text-clay px-3 py-1 text-[11px] font-medium">Refunder</button>
                  )}
                  <a href="/admin/payments" className="rounded-[8px] border border-line-2 px-3 py-1 text-[11px] text-muted">Åbn i Pay-konsol →</a>
                </div>
              </div>
            );
          })()}
        </section>

        {/* Sidebar */}
        <div className="flex flex-col gap-3">
          <section className="card rise p-5" style={{ animationDelay: "0.1s" }}>
            <h3 className="display text-[15px] font-semibold">Handlinger</h3>
            <div className="mt-3 flex flex-col gap-1.5">
              {b.status === "confirmed" && (
                <>
                  <button className="btn btn-primary justify-center">Marker som ankommet</button>
                  <button className="btn btn-ghost justify-center">Ombook</button>
                  <button className="btn btn-ghost justify-center">Send påmindelse nu</button>
                  <button className="btn btn-ghost justify-center text-clay">Aflys</button>
                </>
              )}
              {b.status === "pending" && (
                <>
                  <button className="btn btn-primary justify-center">Bekræft booking</button>
                  <button className="btn btn-ghost justify-center">Ring til klient</button>
                </>
              )}
              {journal ? (
                <Link href={`/journal/${journal.id}`} className="btn btn-primary justify-center">
                  Åbn journal · {journalStatusLabel[journal.status].label}
                </Link>
              ) : (
                <Link href={`/scribe?booking=${b.id}`} className="btn btn-primary justify-center">
                  Opret journal (AI Scribe)
                </Link>
              )}
              {(b.serviceId === "fod-scan" || b.service.toLowerCase().includes("scan")) && (
                <Link href={`/scan?bookingId=${b.id}`} className="btn btn-ghost justify-center">
                  Start fod-scan · Nexus →
                </Link>
              )}
              {b.status === "completed" && (
                <button className="btn btn-ghost justify-center">Send review-anmodning</button>
              )}
              <Link href={`/scribe?booking=${b.id}`} className="btn btn-ghost justify-center">
                AI Scribe →
              </Link>
              <Link href={`/r/${b.id}`} target="_blank" className="btn btn-ghost justify-center">
                Vis kvittering →
              </Link>
            </div>
          </section>

          <section className="card rise p-5" style={{ animationDelay: "0.14s" }}>
            <h3 className="display text-[15px] font-semibold">Aria · automatisering</h3>
            <div className="mt-3 flex flex-col gap-2 text-[12.5px]">
              {[
                ["✓", "Bekræftelse sendt", "via e-mail · 0 min efter booking"],
                [b.status === "completed" ? "✓" : "○", "Påmindelse 24t før", "SMS"],
                [b.status === "completed" ? "✓" : "○", "Påmindelse 1t før", "SMS · kun ved højrisiko"],
                [b.status === "completed" ? "✓" : "○", "Review-anmodning", "1t efter behandling"],
              ].map(([icon, label, sub]) => (
                <div key={label} className="flex items-start gap-2 border-t border-line pt-2 first:border-t-0 first:pt-0">
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${icon === "✓" ? "bg-signal/14 text-signal" : "bg-paper-2 text-faint"}`}>{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium leading-tight">{label}</div>
                    <div className="text-[11px] text-faint">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}
