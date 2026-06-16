"use client";

import { useState } from "react";
import Link from "next/link";
import { listTenants, MODULE_LABELS, type ModuleKey, type Tenant } from "@/lib/tenants";

const ALL: ModuleKey[] = [
  "booking", "journal", "payments", "messaging",
  "ai_aria", "ai_scribe", "ai_noshow",
  "ar_journal", "body_scan", "field_service", "marketplace",
];

const MODULE_DESC: Record<ModuleKey, { desc: string; price: string }> = {
  booking: { desc: "Online booking + kalender + ressourcer", price: "Inkluderet i alle planer" },
  journal: { desc: "Klient-DB, journal, samtykke", price: "Practice og opefter" },
  payments: { desc: "Stripe, faktura, refusioner", price: "Practice og opefter" },
  messaging: { desc: "Krypteret chat, SMS, e-mail", price: "Practice og opefter" },
  ai_aria: { desc: "Autonom booking-agent (chat + voice)", price: "Practice + AI" },
  ai_scribe: { desc: "Ambient samtale → SOAP-journal", price: "Practice + AI" },
  ai_noshow: { desc: "ML-baseret no-show prediktion", price: "Practice + AI" },
  ar_journal: { desc: "AR/CV foto-progression, før/efter", price: "Aesthetic Pro" },
  body_scan: { desc: "Physical AI · 3D fod-topologi + plantar pressure", price: "Physical AI · fra 1.499 kr/mo + hardware" },
  field_service: { desc: "Offline-first mobil + ML-dispatch", price: "Aesthetic Pro" },
  marketplace: { desc: "Tredjeparts-apps via åben write-API", price: "Aesthetic Pro" },
};

export default function AdminTenants() {
  const tenants = listTenants();
  const [upgradeModal, setUpgradeModal] = useState<{ tenant: Tenant; module: ModuleKey } | null>(null);

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex items-end justify-between">
        <div>
          <div className="kicker">PraxisOS · Control plane</div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Tenants</h1>
          <p className="mt-2.5 text-[14px] text-muted">
            {tenants.length} aktive · Headless API + Full SaaS · alle EU-resident.
          </p>
        </div>
        <Link href="/admin/new-tenant" className="btn btn-primary">+ Ny tenant</Link>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {tenants.map((t) => (
          <section key={t.slug} className="card rise p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[11px] text-[15px] font-semibold"
                style={{ background: t.brand.ink, color: t.brand.paper }}
              >
                {t.brand.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="display text-[20px] font-semibold leading-tight">{t.brand.name}</h2>
                  <span className={`chip !py-0.5 ${t.license.status === "active" ? "!border-signal/40 text-signal" : "text-muted"}`}>
                    {t.license.status}
                  </span>
                  <span className="chip !py-0.5 mono !text-[10.5px]">{t.mode}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-muted">{t.legalName} · {t.contact.address}</div>
                <div className="mt-1 mono text-[11px] text-faint">{t.domains.join(" · ")}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/integration/${t.slug}`} className="btn btn-primary">Integration →</Link>
                <Link href={`/admin/services`} className="btn btn-ghost">Ydelser</Link>
                <Link href={`/admin/staff`} className="btn btn-ghost">Behandlere</Link>
                <Link href={`/admin/plan`} className="btn btn-ghost">Plan</Link>
                <Link href={`/t/${t.slug}`} className="btn btn-ghost">Frontend →</Link>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <div className="kicker">Plan</div>
                <div className="mt-1 display text-[17px] font-semibold">{t.license.plan}</div>
                <div className="mt-0.5 mono text-[11px] text-faint">
                  {t.license.seats} {t.license.seats === 1 ? "behandler" : "behandlere"} · fornyes {t.license.expiresAt}
                </div>
              </div>
              <div>
                <div className="kicker">Statistik</div>
                <div className="mt-1 flex gap-4 text-[13px]">
                  <span><b>{t.stats?.clients.toLocaleString("da-DK")}</b><span className="ml-1 text-faint">klienter</span></span>
                  <span><b>{t.stats?.rating}</b><span className="ml-1 text-faint">★</span></span>
                  <span><b>{t.stats?.yearsOperating}</b><span className="ml-1 text-faint">år</span></span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="kicker">Drift</span>
                <span className="flex items-center gap-1.5 text-[12px] text-signal">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" /> healthy · p95 84ms
                </span>
              </div>
            </div>

            {/* Modul-licens-matrix — klikbare for upgrade */}
            <div className="mt-5">
              <div className="kicker mb-2">Moduler · licens · klik et låst modul for at se upgrade-vej</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL.map((m) => {
                  const on = t.license.modules.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => !on && setUpgradeModal({ tenant: t, module: m })}
                      disabled={on}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-all ${
                        on ? "border-ink text-ink cursor-default" : "border-line-2 text-faint hover:border-ink hover:text-ink hover:bg-paper-2"
                      }`}
                      style={on ? { background: "var(--color-paper-2)" } : {}}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: on ? "var(--color-signal)" : "var(--color-line-2)" }}
                      />
                      <span className={on ? "" : "line-through"}>{MODULE_LABELS[m]}</span>
                      {!on && <span className="ml-1 mono text-[9px] text-accent">opgrader</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-[12px] border border-line bg-paper-2/60 p-5 text-[13px] text-ink-soft">
        <div className="kicker">PraxisOS · sælges separat</div>
        <p className="mt-2 max-w-[760px]">
          Hver tenant er fuldt isoleret via row-level security i Postgres. Samme installation kan drives som
          headless backend (kunden beholder eget site), full white-label (vi leverer hele UI), eller hybrid.
          License-matricen ovenfor gates moduler i både UI og API — kald til ikke-licenserede moduler returnerer
          <span className="mono"> 402 Payment Required</span> med upgrade-link.
        </p>
      </div>

      {/* Upgrade modal */}
      {upgradeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6 fade-in"
          onClick={() => setUpgradeModal(null)}
        >
          <div className="card w-[480px] max-w-full p-6 shadow-2xl rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="kicker">Modul · ikke licenseret</div>
                <h3 className="display mt-1.5 text-[22px] font-semibold leading-tight">{MODULE_LABELS[upgradeModal.module]}</h3>
              </div>
              <button onClick={() => setUpgradeModal(null)} className="grid h-8 w-8 place-items-center rounded-[8px] text-muted hover:bg-paper-2">×</button>
            </div>
            <p className="mt-3 text-[13px] text-ink-soft leading-relaxed">
              {MODULE_DESC[upgradeModal.module].desc}
            </p>
            <div className="mt-4 rounded-[10px] border border-line bg-paper p-3.5">
              <div className="kicker">Tilgængelig i</div>
              <div className="mt-1 text-[13.5px] font-medium">{MODULE_DESC[upgradeModal.module].price}</div>
              <div className="mt-1 text-[11.5px] text-muted">Nuværende plan: {upgradeModal.tenant.license.plan}</div>
            </div>
            <div className="mt-5 flex gap-2">
              <Link href="/admin/plan" className="btn btn-primary flex-1 justify-center">Skift plan →</Link>
              <button onClick={() => setUpgradeModal(null)} className="btn btn-ghost">Annullér</button>
            </div>
            <p className="mt-4 text-center text-[11px] text-faint">
              API-kald til dette modul returnerer 402 Payment Required indtil planen er opgraderet.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
