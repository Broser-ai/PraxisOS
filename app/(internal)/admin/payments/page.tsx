"use client";

import { useState } from "react";
import Link from "next/link";
import { listTenants } from "@/lib/tenants";
import { TENANT_PAYMENT_CONFIG, PAYMENT_METHOD_LABEL, PAYMENT_METHOD_ICON, PRAXIS_PAY_EVENTS, TRUST_METHODS, type PaymentMethod } from "@/lib/payments";

const ALL_METHODS: PaymentMethod[] = ["mobilepay", "dankort", "card", "applepay", "googlepay", "klarna", "sepa", "vipps", "swish"];

const RECENT_TRANSACTIONS = [
  { id: "pay_a1c92",  booking: "bk_a3", amount: 395, method: "mobilepay" as PaymentMethod, status: "captured" as const, trust: "frictionless", risk: 8,  at: "08:31" },
  { id: "pay_a2b88",  booking: "bk_a4", amount: 495, method: "mobilepay" as PaymentMethod, status: "authorized" as const, trust: "step_up", risk: 28, at: "06:42" },
  { id: "pay_a3e14",  booking: "bk_a5", amount: 545, method: "card" as PaymentMethod, status: "captured" as const, trust: "frictionless", risk: 12, at: "I går 14:18" },
  { id: "pay_a4f77",  booking: "bk_b1", amount: 745, method: "applepay" as PaymentMethod, status: "authorized" as const, trust: "biometric", risk: 6, at: "I går 10:05" },
  { id: "pay_a5g23",  booking: "bk_p5", amount: 745, method: "klarna" as PaymentMethod, status: "refunded" as const, trust: "frictionless", risk: 18, at: "30 dage" },
];

export default function PraxisPayConsole() {
  const tenants = listTenants();
  const [activeTenant, setActiveTenant] = useState(tenants[0].slug);
  const cfg = TENANT_PAYMENT_CONFIG[activeTenant];

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">PraxisOS Pay</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Vores egen betalings-engine — intent-baseret flow, PraxisRisk scoring, PraxisTrust step-up
            via MitID, intern event-bus og daglig settlement pr. tenant.
          </p>
        </div>
        <Link href="/api/events?tenant=bypilar&type=payment" target="_blank" className="btn btn-ghost">
          <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
          Event-feed →
        </Link>
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

      {/* Ledger overview */}
      <div className="rise mt-3 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        <Stat label="Ledger-ID" value={cfg.payLedgerId} mono />
        <Stat label="Gebyr · tenant betaler" value={`${(cfg.feeRateBp / 100).toFixed(2)}% + ${(cfg.fixedFeeOere / 100).toFixed(2)} kr`} />
        <Stat label="Payout · NemKonto" value={`D+${cfg.payoutDelayDays} bankdage`} />
        <Stat label="Betalings-tilstand" value={
          cfg.paymentMode === "prepay" ? "Forudbetaling"
            : cfg.paymentMode === "auth_only" ? "Reservér + capture ved fremmøde"
            : "Betal i klinikken"
        } />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Methods */}
        <section className="card rise p-5 lg:col-span-2" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-center justify-between">
            <h2 className="display text-[17px] font-semibold">Betalingsmetoder</h2>
            <span className="mono text-[11px] text-faint">{cfg.enabledMethods.length} / {ALL_METHODS.length} aktive</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {ALL_METHODS.map((m) => {
              const on = cfg.enabledMethods.includes(m);
              const isDefault = cfg.defaultMethod === m;
              return (
                <div key={m} className="flex items-center gap-3 rounded-[11px] border border-line bg-paper p-3">
                  <span className="grid h-9 w-12 place-items-center rounded-[6px] text-[11px] font-bold text-white" style={{ background: PAYMENT_METHOD_ICON[m] }}>
                    {m.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      {PAYMENT_METHOD_LABEL[m]}
                      {isDefault && <span className="chip mono !text-[9px]">default</span>}
                    </div>
                    <div className="mono text-[10.5px] text-faint">
                      {m === "mobilepay" ? "DK · ~95% adoption · billigste rail" :
                       m === "dankort" ? "DK · domestic kort" :
                       m === "klarna" ? "Split-betaling · 3 rater" :
                       m === "applepay" ? "Via biometric trust" :
                       m === "googlepay" ? "Via biometric trust" :
                       m === "card" ? "Visa · MC · Amex" :
                       m === "sepa" ? "Kun til klippekort/abonnement" :
                       m === "vipps" ? "Norge" : "Sverige"}
                    </div>
                  </div>
                  <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${on ? "bg-signal" : "bg-line-2"}`}>
                    <span className={`block h-4 w-4 rounded-full bg-paper transition-transform ${on ? "translate-x-4" : ""}`} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* PraxisTrust + Risk */}
        <section className="card rise p-5" style={{ animationDelay: "0.12s" }}>
          <h2 className="display text-[17px] font-semibold">PraxisTrust 2</h2>
          <p className="mt-1 text-[12px] text-muted">Vores egen step-up verifikation · MitID-baseret.</p>
          <div className="mt-3 flex flex-col gap-2">
            {Object.entries(TRUST_METHODS).map(([key, m]) => (
              <div key={key} className="flex items-center justify-between rounded-[9px] border border-line bg-paper px-3 py-2">
                <div>
                  <div className="text-[12.5px] font-medium">{m.label}</div>
                  <div className="mono text-[10px] text-faint">latency {m.latency}</div>
                </div>
                <span className="chip !py-0 !text-[9.5px] !border-signal/40 text-signal">aktiv</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[11px] border border-line bg-paper-2/60 p-3">
            <div className="flex items-center justify-between">
              <span className="kicker">PraxisRisk-tærskel</span>
              <span className="mono text-[14px] font-semibold">{cfg.riskThreshold} / 100</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
              <div className="h-full bg-accent" style={{ width: `${cfg.riskThreshold}%` }} />
            </div>
            <p className="mt-2 text-[10.5px] text-muted">
              Score ≥ tærskel udløser step-up. Score ≥ 70 afvises automatisk.
            </p>
          </div>
        </section>
      </div>

      {/* Recent transactions */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.16s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Seneste transaktioner</h2>
          <span className="chip mono !text-[10px] text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
            live · 5 events i dag
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-faint">
              <tr className="border-b border-line">
                {["ID", "Booking", "Beløb", "Metode", "Trust", "Risk", "Status", "Tid"].map((h) => (
                  <th key={h} className="kicker text-left py-2 pr-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT_TRANSACTIONS.map((tx) => (
                <tr key={tx.id} className="border-b border-line last:border-b-0">
                  <td className="py-2.5 pr-3 mono text-[11.5px]">{tx.id}</td>
                  <td className="py-2.5 pr-3"><Link href={`/bookings/${tx.booking}`} className="mono text-accent hover:underline">{tx.booking}</Link></td>
                  <td className="py-2.5 pr-3 mono font-semibold">{tx.amount} kr</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-4 rounded-[3px]" style={{ background: PAYMENT_METHOD_ICON[tx.method] }} />
                      {PAYMENT_METHOD_LABEL[tx.method].split(" ")[0]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-[11.5px]">{tx.trust}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`mono ${tx.risk < 20 ? "text-signal" : tx.risk < 50 ? "text-amber" : "text-clay"}`}>{tx.risk}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`mono text-[10.5px] ${
                      tx.status === "captured" ? "text-signal" :
                      tx.status === "refunded" ? "text-faint" : "text-amber"
                    }`}>
                      ● {tx.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 mono text-[10.5px] text-faint">{tx.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Event-bus */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.20s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Intern event-bus</h2>
          <span className="chip mono !text-[10px] text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            healthy
          </span>
        </div>
        <p className="mt-2 text-[12.5px] text-muted">
          Hver betalings-hændelse publiceres på den interne bus. Andre moduler (Aria, Journal, Marketing,
          Settlement) abonnerer på hvad de bryder sig om. Endpoint: <code className="mono">POST /api/events</code>.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {Object.entries(PRAXIS_PAY_EVENTS).map(([code, desc]) => (
            <div key={code} className="flex items-center gap-2.5 rounded-[8px] border border-line bg-paper px-2.5 py-1.5">
              <span className="mono text-[10.5px] font-semibold text-accent">{code}</span>
              <span className="text-[11.5px] text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Settlement */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.24s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Settlement · næste payout</h2>
          <span className="mono text-[11px] text-faint">batch_2026_06_08 · D+{cfg.payoutDelayDays}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Bruttoomsætning" value="48.250 kr" sub="seneste 7 dage" />
          <Stat label="Rail-gebyr · inkøb" value="−712 kr" sub="kort + MobilePay" />
          <Stat label="PraxisOS-margin" value="−241 kr" sub="0.50% · vores omsætning" />
          <Stat label="Netto til klinik" value="47.297 kr" sub="udbetales tirsdag" highlight />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-paper-2/60 p-3 text-[11.5px] text-ink-soft">
          <span className="kicker">Forretningsmodel</span>
          <span className="text-muted">PraxisOS Pay tjener 0,50% af bruttoomsætningen + 0,50 kr pr. transaktion.
          Den underliggende payment-rail (kort, MobilePay) er en intern detalje — kan swappes mellem providers.</span>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, mono, highlight }: { label: string; value: string; sub?: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="card p-3" style={highlight ? { borderColor: "var(--color-signal)", background: "color-mix(in srgb, var(--color-signal) 5%, var(--color-card))" } : {}}>
      <div className="kicker !text-[9px]">{label}</div>
      <div className={`mt-1 ${mono ? "mono" : ""} text-[14px] font-semibold ${highlight ? "text-signal" : ""}`}>{value}</div>
      {sub && <div className="mono text-[10px] text-faint">{sub}</div>}
    </div>
  );
}
