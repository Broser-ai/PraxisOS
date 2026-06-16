"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenant } from "@/lib/tenants";
import { listClipPackages, type ClipPackage } from "@/lib/vouchers";

type Step = 1 | 2 | 3 | 4;

export default function KlippekortKoebPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = use(params);
  const t = getTenant(tenant);
  if (!t) notFound();

  const packages = listClipPackages(tenant);
  const services = Array.from(new Set(packages.map((p) => p.serviceName)));
  const [serviceFilter, setServiceFilter] = useState<string>(services[0] ?? "");
  const filtered = packages.filter((p) => p.serviceName === serviceFilter);

  const [step, setStep] = useState<Step>(1);
  const [picked, setPicked] = useState<ClipPackage | null>(null);
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const generateCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ234567";
    const pick = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    return `CLIP-${pick(4)}-${pick(4)}`;
  };

  const submit = async () => {
    await new Promise((r) => setTimeout(r, 1200));
    setGeneratedCode(generateCode());
    setStep(4);
  };

  return (
    <div className="mx-auto max-w-[860px]">
      <ol className="mb-8 flex items-center gap-2 text-[12px] text-muted">
        {[["1", "Pakke"], ["2", "Oplysninger"], ["3", "Betaling"], ["4", "Færdig"]].map(([n, label], idx) => (
          <li key={n} className="flex items-center gap-2">
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold"
              style={{
                background: step >= +n ? "var(--brand-ink)" : "transparent",
                color: step >= +n ? "var(--brand-paper)" : "var(--brand-ink)",
                border: step >= +n ? "none" : "1px solid var(--color-line-2)",
              }}
            >
              {n}
            </span>
            <span className={step >= +n ? "font-medium" : ""}>{label}</span>
            {idx < 3 && <span className="mx-2 h-px w-6 bg-line-2" />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="rise">
          <div className="kicker">Klippekort</div>
          <h1 className="display mt-2 text-[32px] font-semibold">Forudbetal og spar.</h1>
          <p className="mt-2 text-[14px]" style={{ color: t.brand.secondary }}>
            Køb et bundt sessioner på forhånd · få rabat · brug dem når det passer dig.
          </p>

          {/* Service-filter */}
          <div className="mt-7 flex flex-wrap gap-2">
            {services.map((s) => (
              <button
                key={s}
                onClick={() => setServiceFilter(s)}
                className="rounded-[10px] border px-3.5 py-2 text-[12.5px]"
                style={{
                  borderColor: serviceFilter === s ? "var(--brand-ink)" : "var(--color-line-2)",
                  background: serviceFilter === s ? "var(--brand-ink)" : "var(--color-card)",
                  color: serviceFilter === s ? "var(--brand-paper)" : "inherit",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Pakker */}
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {filtered.map((p) => {
              const isSelected = picked?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPicked(p)}
                  className="relative overflow-hidden rounded-[14px] border p-5 text-left transition-all"
                  style={{
                    borderColor: isSelected ? "var(--brand-ink)" : p.highlighted ? `color-mix(in srgb, ${t.brand.accent} 40%, transparent)` : "var(--color-line-2)",
                    background: isSelected ? "var(--color-paper-2)" : "var(--color-card)",
                    boxShadow: isSelected ? "0 0 0 2px var(--brand-ink)" : undefined,
                  }}
                >
                  {p.highlighted && (
                    <span className="absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide" style={{ background: t.brand.accent, color: t.brand.paper }}>
                      populær
                    </span>
                  )}
                  <div className="display text-[36px] font-semibold leading-none">{p.sessions}</div>
                  <div className="mt-1 text-[11px]" style={{ color: t.brand.secondary }}>sessioner</div>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="display text-[20px] font-semibold">{p.priceKr.toLocaleString("da-DK")} kr</span>
                    <span className="text-[11px] line-through" style={{ color: t.brand.secondary }}>{p.faceValueKr} kr</span>
                  </div>
                  <div className="mt-0.5 mono text-[11px]" style={{ color: "var(--color-signal)" }}>
                    −{p.discountPct}% rabat
                  </div>

                  <div className="mt-4 border-t border-line pt-2.5 text-[11px]" style={{ color: t.brand.secondary }}>
                    <div>{(p.priceKr / p.sessions).toFixed(0)} kr / session</div>
                    <div className="mono text-[10px]">udløber efter {p.expiryMonths} mdr.</div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!picked}
            className="mt-6 w-full rounded-[10px] py-3 text-[14px] font-medium disabled:opacity-40"
            style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
          >
            {picked ? `Fortsæt med ${picked.sessions} × ${picked.serviceName} →` : "Vælg en pakke"}
          </button>
        </section>
      )}

      {step === 2 && picked && (
        <section className="rise">
          <h1 className="display text-[26px] font-semibold">Dine oplysninger</h1>
          <p className="mt-1 text-[13px]" style={{ color: t.brand.secondary }}>
            Klippekortet bliver knyttet til din e-mail og kan bruges ved alle fremtidige bookinger.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldInput label="Navn" value={buyer.name} onChange={(v) => setBuyer({ ...buyer, name: v })} placeholder="Mette Lindqvist" />
            <FieldInput label="E-mail" value={buyer.email} onChange={(v) => setBuyer({ ...buyer, email: v })} placeholder="mette.l@example.com" />
            <FieldInput label="Telefon · valgfri" value={buyer.phone} onChange={(v) => setBuyer({ ...buyer, phone: v })} placeholder="+45 …" />
          </div>

          <div className="mt-5 rounded-[12px] border border-line bg-card p-4">
            <div className="kicker mb-2">Ordreoversigt</div>
            <div className="flex items-center justify-between text-[13px]">
              <span>{picked.sessions} × {picked.serviceName}</span>
              <span className="mono">{picked.faceValueKr.toLocaleString("da-DK")} kr</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px]" style={{ color: "var(--color-signal)" }}>
              <span>Rabat −{picked.discountPct}%</span>
              <span className="mono">−{(picked.faceValueKr - picked.priceKr).toLocaleString("da-DK")} kr</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[14px] font-semibold">
              <span>Du betaler</span>
              <span className="display text-[18px]">{picked.priceKr.toLocaleString("da-DK")} kr</span>
            </div>
            <div className="mt-2 text-[10.5px]" style={{ color: t.brand.secondary }}>
              Medicinske ydelser · momsfritaget · udløber {picked.expiryMonths} mdr. efter køb
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button onClick={() => setStep(1)} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]">Tilbage</button>
            <button
              onClick={() => setStep(3)}
              disabled={!buyer.name || !buyer.email}
              className="flex-1 rounded-[10px] py-2.5 text-[13.5px] font-medium disabled:opacity-40"
              style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
            >
              Til betaling →
            </button>
          </div>
        </section>
      )}

      {step === 3 && picked && (
        <section className="rise">
          <h1 className="display text-[26px] font-semibold">Betaling</h1>
          <p className="mt-1 mono text-[12px]" style={{ color: t.brand.secondary }}>
            {picked.sessions} × {picked.serviceName} · {picked.priceKr.toLocaleString("da-DK")} kr
          </p>

          <div className="mt-5 flex flex-col gap-2">
            {[
              { id: "mobilepay", label: "MobilePay", color: "#5A78FF" },
              { id: "card", label: "Kort · Visa / MC / Amex", color: "#1b1a17" },
              { id: "klarna", label: "Klarna · 3 rentefri rater", color: "#FFA8CD" },
              { id: "applepay", label: "Apple Pay", color: "#000" },
            ].map((m, i) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line-2 bg-card p-3 hover:border-ink">
                <input type="radio" name="pay" defaultChecked={i === 0} />
                <span className="grid h-7 w-10 place-items-center rounded-[6px] text-[12px] font-bold text-white" style={{ background: m.color }}>
                  {m.label.charAt(0)}
                </span>
                <span className="flex-1 text-[13px] font-medium">{m.label}</span>
                {m.id === "klarna" && (
                  <span className="mono text-[10px]" style={{ color: t.brand.secondary }}>
                    3 × {Math.round(picked.priceKr / 3)} kr
                  </span>
                )}
              </label>
            ))}
          </div>

          <button
            onClick={submit}
            className="mt-5 w-full rounded-[10px] py-3 text-[14px] font-medium"
            style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
          >
            Betal {picked.priceKr.toLocaleString("da-DK")} kr →
          </button>
        </section>
      )}

      {step === 4 && generatedCode && picked && (
        <section className="rise text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-signal/14 text-signal">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
          </div>
          <h1 className="display mt-5 text-[28px] font-semibold">Dit klippekort er klar!</h1>
          <p className="mt-2 text-[13.5px]" style={{ color: t.brand.secondary }}>
            Vi har sendt en bekræftelse til <b>{buyer.email}</b>. Du kan bruge klippekortet ved alle fremtidige bookinger.
          </p>

          <div
            className="mx-auto mt-7 max-w-[400px] overflow-hidden rounded-[14px] border border-line"
            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${t.brand.accent} 8%, white), white)` }}
          >
            <div className="p-5 text-left">
              <div className="flex items-center justify-between">
                <span className="kicker !text-[10px]" style={{ color: t.brand.ink }}>Klippekort · {t.brand.name}</span>
                <span className="display text-[22px] font-semibold">{picked.sessions}</span>
              </div>
              <div className="mt-1.5 text-[13px] font-medium">{picked.serviceName}</div>
              <div className="mt-4 mono text-[18px] font-bold tracking-wider">{generatedCode}</div>
              <div className="mt-1 text-[10.5px]" style={{ color: t.brand.secondary }}>
                {picked.sessions} sessioner · udløber {new Date(Date.now() + picked.expiryMonths * 30 * 86400 * 1000).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-2">
            <Link href={`/t/${tenant}/book`} className="rounded-[10px] px-5 py-2.5 text-[13px] font-medium" style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}>
              Book første session →
            </Link>
            <Link href={`/t/${tenant}/portal`} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]">
              Til min side
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="kicker">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink"
      />
    </label>
  );
}
