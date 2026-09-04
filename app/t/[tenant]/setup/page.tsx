"use client";

import Link from "next/link";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import { getTenant, MODULE_LABELS, type ModuleKey } from "@/lib/tenants";
import { formatPlanPrice, getPlan } from "@/lib/plans";

type Step = "welcome" | "brand" | "license" | "done";

export default function ClinicSetupPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = use(params);
  const t = getTenant(slug);
  if (!t) notFound();

  const plan = getPlan(String(t.license.planId ?? "practice"));
  const [step, setStep] = useState<Step>("welcome");
  const [brandName, setBrandName] = useState(t.brand.name);
  const [tagline, setTagline] = useState(t.brand.tagline);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState(t.license.status);

  const saveBrand = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tenant/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: slug, brandName, tagline, setupComplete: false }),
      });
      if (!res.ok) throw new Error("fail");
      setStep("license");
    } catch {
      setMsg("Kunne ikke gemme — prøv igen.");
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/license", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: slug, action: "activate" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "fail");
      setLicenseStatus("active");
      setMsg(json.message ?? "Licens aktiveret");
      await fetch("/api/tenant/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: slug, brandName, tagline, setupComplete: true }),
      });
      setStep("done");
    } catch {
      setMsg("Aktivering fejlede — prøv igen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="kicker">Klinik-setup</div>
      <h1 className="display mt-2 text-[34px] font-semibold leading-tight">
        {step === "done" ? "Klinikken er klar" : `Velkommen, ${t.legalName}`}
      </h1>

      {step === "welcome" && (
        <section className="mt-8 space-y-4">
          <p className="text-[14px] text-muted">
            Din klinik-tenant er oprettet med <strong>{plan.name}</strong>
            {t.license.status === "trial" ? " (30 dages trial)" : ""}.
            Næste skridt: brand + aktiver licens.
          </p>
          <ul className="rounded-[12px] border border-line bg-card p-4 text-[13px]">
            {(plan.modules as ModuleKey[]).map((m) => (
              <li key={m} className="flex items-center gap-2 border-b border-line/60 py-2 last:border-0">
                <span className="text-signal">✓</span> {MODULE_LABELS[m]}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStep("brand")}
            className="w-full rounded-[12px] bg-ink px-4 py-3 text-[14px] font-medium text-paper"
          >
            Start setup →
          </button>
        </section>
      )}

      {step === "brand" && (
        <section className="mt-8 space-y-4">
          <p className="text-[14px] text-muted">Sådan ser kunderne dig i booking og shop.</p>
          <label className="block">
            <span className="kicker">Kliniknavn</span>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="mt-1 w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px]"
            />
          </label>
          <label className="block">
            <span className="kicker">Tagline</span>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="mt-1 w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px]"
            />
          </label>
          {msg && <p className="text-[12px] text-clay">{msg}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep("welcome")} className="rounded-[10px] border border-line px-4 py-2.5 text-[13px]">
              ←
            </button>
            <button
              type="button"
              disabled={busy || !brandName}
              onClick={saveBrand}
              className="flex-1 rounded-[12px] bg-ink px-4 py-3 text-[14px] font-medium text-paper disabled:opacity-40"
            >
              {busy ? "Gemmer…" : "Fortsæt til licens →"}
            </button>
          </div>
        </section>
      )}

      {step === "license" && (
        <section className="mt-8 space-y-4">
          <div className="rounded-[14px] border border-line bg-card p-5">
            <div className="kicker">Din plan</div>
            <div className="display mt-2 text-[24px] font-semibold">{plan.name}</div>
            <div className="mt-1 text-[14px] text-muted">
              {formatPlanPrice(plan)}
              {plan.periodLabel} · {plan.seats} seats
            </div>
            <p className="mt-3 text-[13px] text-muted">{plan.tagline}</p>
            <div className="mt-4 rounded-[8px] bg-paper-2/60 px-3 py-2 text-[12px] text-muted">
              Status: <strong>{licenseStatus === "trial" ? "Trial (30 dage)" : "Aktiv"}</strong>
              {plan.priceMonthlyKr > 0 && licenseStatus === "trial"
                ? " — aktiver for at gå til betalt licens (mock-betaling)."
                : null}
            </div>
          </div>
          {msg && <p className="text-[12px] text-signal">{msg}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={activate}
            className="w-full rounded-[12px] bg-ink px-4 py-3 text-[14px] font-medium text-paper disabled:opacity-40"
          >
            {busy
              ? "Aktiverer…"
              : plan.priceMonthlyKr === 0
                ? "Aktiver Starter-licens"
                : `Aktiver licens · ${formatPlanPrice(plan)}/md (mock)`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await fetch("/api/tenant/setup", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ tenant: slug, brandName, tagline, setupComplete: true }),
              });
              setStep("done");
            }}
            className="w-full rounded-[12px] border border-line px-4 py-3 text-[13px]"
          >
            Fortsæt på trial uden betaling
          </button>
        </section>
      )}

      {step === "done" && (
        <section className="mt-8 space-y-4 text-center">
          <p className="text-[14px] text-muted">
            Log ind med din e-mail og adgangskode <span className="mono">demo</span>.
            Kunder booker under dit clinic-brand.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/login?next=/dashboard"
              className="rounded-[12px] bg-ink px-5 py-3 text-[14px] font-medium text-paper"
            >
              Klinik-login · Staff
            </Link>
            <Link
              href={`/t/${slug}`}
              className="rounded-[12px] border border-line px-5 py-3 text-[14px]"
            >
              Se kunde-frontend
            </Link>
            <Link
              href={`/t/${slug}/book`}
              className="rounded-[12px] border border-line px-5 py-3 text-[14px]"
            >
              Test booking
            </Link>
          </div>
          <div className="mt-6 text-left">
            <div className="kicker mb-2 text-center">Åbn klinik-OS efter login</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["/dashboard", "Overblik"],
                ["/kalender", "Kalender"],
                ["/klienter", "Klienter"],
                ["/journal", "Journal"],
                ["/scan", "Fod-scan"],
                ["/admin/packaging", "Admin"],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-[10px] border border-line px-3 py-2.5 text-[12.5px] hover:bg-paper-2"
                >
                  {label}
                  <div className="mono text-[10px] text-faint">{href}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
