"use client";

import { useState } from "react";
import Link from "next/link";
import { MODULES, CATEGORIES, TENANT_ACTIVE_MODULES, calculateTotalCost, isModuleActive } from "@/lib/modules";
import { listTenants } from "@/lib/tenants";

export default function ModuleMarketplace() {
  const tenants = listTenants();
  const [activeTenant, setActiveTenant] = useState(tenants[0].slug);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [seats, setSeats] = useState(2);

  const activeIds = TENANT_ACTIVE_MODULES[activeTenant] ?? [];
  const filtered = activeCategory === "all" ? MODULES : MODULES.filter((m) => m.category === activeCategory);
  const cost = calculateTotalCost(activeTenant, seats);

  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants (Broser)</Link>
          <h1 className="display mt-2 text-[32px] font-semibold leading-none">Modul-tilvalg</h1>
          <p className="mt-2 max-w-[560px] text-[13.5px] text-muted">
            Kundens tilvalg. Nyt pakke-udkast:{" "}
            <Link href="/admin/packaging" className="font-medium text-ink underline-offset-2 hover:underline">
              Produktpakke · udkast
            </Link>
            {" "}— kerne obligatorisk, tilvalg (inkl. fod-scan), API skjult for kunden.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-[12px] text-muted">Aktive moduler for valgt klinik</div>
          <div className="flex items-center gap-2">
            <span className="display text-[24px] font-semibold">{cost.total.toLocaleString("da-DK")} kr</span>
            <span className="text-[12px] text-muted">/ md</span>
          </div>
          <div className="mono text-[10px] text-faint">{activeIds.length} af {MODULES.length} moduler · {seats} behandlere</div>
        </div>
      </div>

      {/* Tenant + seats */}
      <div className="rise mt-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
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
        <div className="ml-auto flex items-center gap-2 rounded-[10px] border border-line-2 bg-card px-3 py-2">
          <span className="text-[12px] text-muted">Behandlere:</span>
          <button onClick={() => setSeats(Math.max(1, seats - 1))} className="grid h-6 w-6 place-items-center rounded-md border border-line-2 text-[14px]">−</button>
          <span className="mono w-6 text-center text-[13px] font-semibold">{seats}</span>
          <button onClick={() => setSeats(seats + 1)} className="grid h-6 w-6 place-items-center rounded-md border border-line-2 text-[14px]">+</button>
        </div>
      </div>

      {/* Category-tabs */}
      <div className="rise mt-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveCategory("all")}
          className="rounded-[8px] px-3 py-1.5 text-[12px]"
          style={{
            background: activeCategory === "all" ? "var(--color-ink)" : "var(--color-card)",
            color: activeCategory === "all" ? "var(--color-paper)" : "var(--color-muted)",
            border: "1px solid var(--color-line-2)",
          }}
        >
          Alle moduler ({MODULES.length})
        </button>
        {CATEGORIES.map((c) => {
          const count = MODULES.filter((m) => m.category === c.id).length;
          const isActive = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className="rounded-[8px] px-3 py-1.5 text-[12px] border border-line-2"
              style={{
                background: isActive ? c.color : "var(--color-card)",
                color: isActive ? "var(--color-paper)" : "var(--color-muted)",
                borderColor: isActive ? c.color : undefined,
              }}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Module grid */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => {
          const active = isModuleActive(activeTenant, m.id);
          const cost = m.pricingModel === "flat" ? m.priceMonthly :
                       m.pricingModel === "per_seat" ? m.pricePerSeat * seats :
                       m.pricingModel === "volume" ? 0 :
                       0;
          return (
            <Link
              key={m.id}
              href={`/admin/marketplace/${m.id}`}
              className="card relative flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-ink"
              style={active ? { borderColor: "color-mix(in srgb, var(--color-signal) 50%, var(--color-line))", background: "color-mix(in srgb, var(--color-signal) 3%, var(--color-card))" } : {}}
            >
              {m.popular && !active && (
                <span className="absolute -top-2 left-4 rounded-full bg-clay px-2 py-0.5 text-[10px] font-medium text-paper">populær</span>
              )}
              {m.enterprise && (
                <span className="absolute -top-2 right-4 rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-paper">enterprise</span>
              )}

              <div className="flex items-start justify-between gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-paper"
                  style={{ background: m.iconColor }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={m.icon} />
                  </svg>
                </span>
                {active && (
                  <span className="chip mono !text-[10px] !border-signal/40 text-signal">● aktiv</span>
                )}
              </div>

              <div>
                <div className="display text-[16px] font-semibold leading-tight">{m.name}</div>
                <div className="mt-1 text-[11.5px] text-muted">{m.tagline}</div>
              </div>

              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <div>
                  {cost === 0 ? (
                    <span className="display text-[18px] font-semibold text-signal">
                      {m.pricingModel === "volume" ? "Volumen" : "Gratis"}
                    </span>
                  ) : (
                    <>
                      <span className="display text-[18px] font-semibold">{cost.toLocaleString("da-DK")} kr</span>
                      <span className="ml-1 text-[10.5px] text-muted">
                        {m.pricingModel === "per_seat" ? `/ ${seats} beh / md` : "/ md"}
                      </span>
                    </>
                  )}
                </div>
                {m.agentRole && (
                  <span className="mono text-[10px] text-faint">drevet af {m.agentRole}</span>
                )}
              </div>

              <div className="border-t border-line pt-2.5">
                <div className="kicker !text-[8.5px]">{m.metricLabel}</div>
                <div className="mono mt-0.5 text-[13px] font-semibold">{m.metricValue}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Cost breakdown */}
      <section className="card rise mt-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Total · {tenants.find((t) => t.slug === activeTenant)?.brand.name}</h2>
          <span className="mono text-[11px] text-faint">{activeIds.length} aktive moduler</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          {cost.modules.filter((m) => m.cost > 0).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-[10px] border border-line bg-paper px-3 py-2">
              <span className="text-[12px]">{m.name}</span>
              <span className="mono text-[12px] font-semibold">{m.cost.toLocaleString("da-DK")} kr</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-[10px] border-2 border-ink bg-paper-2 px-4 py-3">
          <span className="text-[13px] font-semibold">I alt pr. måned</span>
          <span className="display text-[22px] font-semibold">{cost.total.toLocaleString("da-DK")} kr</span>
        </div>
      </section>

      <div className="mt-3 rounded-[12px] border border-line bg-paper-2/60 p-5 text-[12.5px] text-ink-soft">
        <div className="kicker">Modulær prismodel</div>
        <p className="mt-2 max-w-[860px]">
          Hvert modul har sin egen prismodel: <b>flat</b> (fast pris/md), <b>per_seat</b> (pr. behandler/md),
          <b>volume</b> (pr. transaktion fx NemSMS 0,50 kr/SMS) eller <b>gratis</b> (kerne). Alle moduler har 14-30 dages
          gratis prøveperiode. Afhængigheder vises automatisk · konflikter (fx Sundhed.dk kræver Trustaftale) markeres som "enterprise".
        </p>
      </div>
    </div>
  );
}
