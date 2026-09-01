"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPlanPrice, listLicenseOrders, PLANS } from "@/lib/plans";
import { listTenants, MODULE_LABELS, type ModuleKey } from "@/lib/tenants";

export default function PlanBilling() {
  const [tenants, setTenants] = useState(() => listTenants());
  const [activeTenant, setActiveTenant] = useState(tenants[0]?.slug ?? "bypilar");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const tenant = tenants.find((t) => t.slug === activeTenant) ?? tenants[0];
  const orders = listLicenseOrders(tenant?.slug);

  const refresh = () => setTenants([...listTenants()]);

  const changePlan = async (planId: string) => {
    if (!tenant) return;
    setBusy(planId);
    setFlash(null);
    try {
      const res = await fetch("/api/license", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: tenant.slug, action: "change_plan", planId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setFlash(json.message ?? "Plan opdateret");
      refresh();
    } catch {
      setFlash("Kunne ikke skifte plan");
    } finally {
      setBusy(null);
    }
  };

  if (!tenant) {
    return <div className="p-10 text-muted">Ingen tenants</div>;
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">
            ← Tenants
          </Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Plan & licens</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            B2B SaaS-licens — skift plan og se mock-ordrer. (PraxisOS Pay er til patientbetalinger.)
          </p>
        </div>
      </div>

      <div className="rise mt-6 flex flex-wrap gap-2">
        {tenants.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => setActiveTenant(t.slug)}
            className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2"
            style={{
              borderColor: activeTenant === t.slug ? "var(--color-ink)" : "var(--color-line-2)",
              background: activeTenant === t.slug ? "var(--color-paper-2)" : "var(--color-card)",
            }}
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold"
              style={{ background: t.brand.ink, color: t.brand.paper }}
            >
              {t.brand.name.charAt(0)}
            </span>
            <span className="text-[13px] font-medium">{t.brand.name}</span>
          </button>
        ))}
      </div>

      <section className="card rise mt-3 p-6">
        <div className="kicker">Nuværende licens</div>
        <div className="mt-1 display text-[24px] font-semibold">{tenant.license.plan}</div>
        <div className="mt-1 text-[12.5px] text-muted">
          {tenant.license.seats} seats · status {tenant.license.status} · udløber {tenant.license.expiresAt}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tenant.license.modules.map((m) => (
            <span key={m} className="rounded-[6px] border border-line px-2 py-0.5 text-[11px]">
              {MODULE_LABELS[m as ModuleKey] ?? m}
            </span>
          ))}
        </div>
        {flash && <p className="mt-4 text-[13px] text-signal">{flash}</p>}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const current = String(tenant.license.planId) === p.id;
          return (
            <div key={p.id} className={`card flex flex-col p-5 ${p.highlighted ? "border-ink/30" : ""}`}>
              <div className="display text-[18px] font-semibold">{p.name}</div>
              <div className="mt-2 text-[22px] font-semibold">
                {formatPlanPrice(p)}
                <span className="text-[12px] font-normal text-muted">/md</span>
              </div>
              <p className="mt-2 flex-1 text-[12px] text-muted">{p.tagline}</p>
              <button
                type="button"
                disabled={current || busy === p.id}
                onClick={() => changePlan(p.id)}
                className="mt-4 rounded-[10px] bg-ink px-3 py-2 text-[13px] font-medium text-paper disabled:opacity-40"
              >
                {current ? "Nuværende" : busy === p.id ? "Skifter…" : "Skift til denne"}
              </button>
            </div>
          );
        })}
      </section>

      <section className="card mt-6 p-5">
        <div className="kicker">Licensordrer (mock)</div>
        {orders.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">Ingen ordrer endnu for denne tenant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-[13px]">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span className="mono text-[12px]">{o.id}</span>
                <span>
                  {o.planId} · {o.status} · {o.amountKr} kr
                </span>
                <span className="text-muted">{o.createdAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
