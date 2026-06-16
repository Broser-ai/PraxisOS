"use client";

import { useState } from "react";
import Link from "next/link";
import { listTenants, MODULE_LABELS, type ModuleKey } from "@/lib/tenants";

type PlanTier = {
  id: string;
  name: string;
  pricePerSeat: number; // kr/md ekskl. moms
  includes: ModuleKey[];
  highlight?: boolean;
};

const PLANS: PlanTier[] = [
  {
    id: "headless",
    name: "Headless Starter",
    pricePerSeat: 199,
    includes: ["booking"],
  },
  {
    id: "practice",
    name: "Practice",
    pricePerSeat: 349,
    includes: ["booking", "journal", "payments", "messaging"],
  },
  {
    id: "practice-ai",
    name: "Practice + AI",
    pricePerSeat: 549,
    includes: ["booking", "journal", "payments", "messaging", "ai_aria", "ai_scribe", "ai_noshow"],
    highlight: true,
  },
  {
    id: "aesthetic-pro",
    name: "Aesthetic Pro",
    pricePerSeat: 749,
    includes: ["booking", "journal", "payments", "messaging", "ai_aria", "ai_scribe", "ai_noshow", "ar_journal", "field_service", "marketplace"],
  },
  {
    id: "physical-ai",
    name: "Physical AI",
    pricePerSeat: 1499,
    includes: ["booking", "journal", "payments", "messaging", "ai_aria", "ai_scribe", "ai_noshow", "ar_journal", "body_scan", "field_service", "marketplace"],
  },
];

const INVOICES = [
  { id: "INV-2026-06", date: "2026-06-01", amount: 1098, status: "paid",   plan: "Practice + AI · 2 behandlere" },
  { id: "INV-2026-05", date: "2026-05-01", amount: 1098, status: "paid",   plan: "Practice + AI · 2 behandlere" },
  { id: "INV-2026-04", date: "2026-04-01", amount: 1098, status: "paid",   plan: "Practice + AI · 2 behandlere" },
  { id: "INV-2026-03", date: "2026-03-01", amount: 549,  status: "paid",   plan: "Practice + AI · 1 behandler · upgrade" },
  { id: "INV-2026-02", date: "2026-02-01", amount: 349,  status: "paid",   plan: "Practice · 1 behandler" },
];

export default function PlanBilling() {
  const tenants = listTenants();
  const [activeTenant, setActiveTenant] = useState(tenants[0].slug);
  const tenant = tenants.find((t) => t.slug === activeTenant)!;
  const currentTierIdx = PLANS.findIndex((p) => tenant.license.modules.length >= p.includes.length);
  const monthly = (PLANS.find((p) => p.name === tenant.license.plan)?.pricePerSeat ?? 549) * tenant.license.seats;

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Plan & fakturering</h1>
          <p className="mt-2 text-[13.5px] text-muted">Skift plan, juster antal behandlere, og se fakturahistorik.</p>
        </div>
      </div>

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

      {/* Nuværende plan */}
      <section className="card rise mt-3 p-6" style={{ animationDelay: "0.06s" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="kicker">Nuværende plan</div>
            <div className="mt-1 display text-[24px] font-semibold">{tenant.license.plan}</div>
            <div className="mt-1 text-[12.5px] text-muted">{tenant.license.seats} behandler{tenant.license.seats > 1 ? "e" : ""} · fornyes {tenant.license.expiresAt}</div>
          </div>
          <div className="text-right">
            <div className="display text-[28px] font-semibold leading-none">{monthly.toLocaleString("da-DK")} kr</div>
            <div className="mt-0.5 text-[11.5px] text-faint">pr. måned · ekskl. moms</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {tenant.license.modules.map((m) => (
            <span key={m} className="rounded-full border border-line-2 bg-paper-2 px-2.5 py-0.5 text-[10.5px]">{MODULE_LABELS[m]}</span>
          ))}
        </div>
      </section>

      {/* Plan-stige */}
      <section className="rise mt-3" style={{ animationDelay: "0.1s" }}>
        <div className="kicker mb-3">Vælg plan</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
          {PLANS.map((p) => {
            const isCurrent = p.name === tenant.license.plan;
            return (
              <div
                key={p.id}
                className="card flex flex-col p-4 transition-all"
                style={{
                  borderColor: isCurrent ? "var(--color-ink)" : p.highlight ? "color-mix(in srgb, var(--color-accent) 40%, transparent)" : undefined,
                  boxShadow: isCurrent ? "0 0 0 1px var(--color-ink)" : undefined,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="text-[13.5px] font-semibold">{p.name}</div>
                  {isCurrent && <span className="chip !border-signal/40 text-signal !py-0">aktiv</span>}
                  {p.highlight && !isCurrent && <span className="chip !text-[9px]">populær</span>}
                </div>
                <div className="mt-3 display text-[22px] font-semibold leading-none">{p.pricePerSeat} kr</div>
                <div className="mt-0.5 text-[10.5px] text-faint">pr. behandler / md</div>
                <ul className="mt-4 flex flex-col gap-1.5 text-[11.5px] flex-1">
                  {p.includes.map((m) => (
                    <li key={m} className="flex items-center gap-1.5">
                      <span className="grid h-3 w-3 place-items-center rounded-full bg-signal/14 text-signal">
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
                      </span>
                      {MODULE_LABELS[m]}
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-4 w-full rounded-[8px] py-1.5 text-[11.5px] font-medium"
                  style={{
                    background: isCurrent ? "var(--color-paper-2)" : "var(--color-ink)",
                    color: isCurrent ? "var(--color-muted)" : "var(--color-paper)",
                    cursor: isCurrent ? "default" : "pointer",
                  }}
                  disabled={isCurrent}
                >
                  {isCurrent ? "Nuværende" : "Skift til denne"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Fakturahistorik */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.14s" }}>
        <h2 className="display text-[17px] font-semibold">Fakturahistorik</h2>
        <div className="mt-4 flex flex-col">
          {INVOICES.map((inv) => (
            <div key={inv.id} className="grid grid-cols-[140px_1fr_100px_100px_80px] items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
              <span className="mono text-[12.5px] font-medium">{inv.id}</span>
              <span className="text-[12.5px] text-muted">{inv.plan}</span>
              <span className="mono text-[12px] text-faint">{new Date(inv.date).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}</span>
              <span className="mono text-[13px] font-semibold">{inv.amount.toLocaleString("da-DK")} kr</span>
              <a className="text-right text-[12px] text-accent hover:underline" href="#">PDF →</a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
