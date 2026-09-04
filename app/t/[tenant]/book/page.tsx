"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PaymentStep } from "@/components/PaymentStep";
import { SubsidyBanner, type SubsidyOption } from "@/components/SubsidyBanner";
import { VoucherInput, type VoucherSummary } from "@/components/VoucherInput";
import { AddressAutocomplete, type DanishAddress } from "@/components/AddressAutocomplete";
import { TENANT_PAYMENT_CONFIG, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";

type Service = {
  id: string; name: string; description: string; durationMin: number; price: number;
  currency: string; category: string; modality: string[];
};
type Slots = { day: string; times: string[] }[];
type Step = 1 | 2 | 3 | 4 | 5;

type Lookup = {
  known: boolean;
  client?: { name: string; age: number; mitidVerified: boolean };
  subsidies?: SubsidyOption[];
  vouchers?: VoucherSummary[];
};

export default function BookPage({ params }: { params: Promise<{ tenant: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <BookPageInner params={params} />
    </Suspense>
  );
}

function BookPageInner({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = use(params);
  const sp = useSearchParams();
  const isEmbed = sp.get("embed") === "1";

  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(sp.get("service"));
  const [slots, setSlots] = useState<Slots>([]);
  const [pick, setPick] = useState<{ day: string; time: string } | null>(null);
  const [client, setClient] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState<DanishAddress | null>(null);
  const [modality, setModality] = useState<string>("Klinik");
  const [step, setStep] = useState<Step>(serviceId ? 2 : 1);
  const [confirm, setConfirm] = useState<any | null>(null);
  const [paymentResult, setPaymentResult] = useState<{ method: PaymentMethod; pspRef: string } | null>(null);

  // Subsidy + voucher state
  const [lookup, setLookup] = useState<Lookup>({ known: false });
  const [selectedScheme, setSelectedScheme] = useState<string | null>(null);
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherSummary | null>(null);

  // MitID + adresse state
  const [mitidVerified, setMitidVerified] = useState(false);
  const [showMitidModal, setShowMitidModal] = useState(false);

  const paymentCfg = TENANT_PAYMENT_CONFIG[tenant] ?? TENANT_PAYMENT_CONFIG.bypilar;

  // Embed parent origin for postMessage (bypilar.dk). Fall back to * only when
  // referrer is absent so WordPress modal handshake still works.
  const embedParentOrigin = (() => {
    if (!isEmbed || typeof document === "undefined") return "*";
    try {
      const ref = document.referrer;
      if (!ref) return "*";
      return new URL(ref).origin;
    } catch {
      return "*";
    }
  })();

  useEffect(() => {
    if (isEmbed) {
      document.documentElement.classList.add("praxis-embed");
      window.parent?.postMessage({ source: "praxisos", type: "ready" }, embedParentOrigin);
    }
    return () => document.documentElement.classList.remove("praxis-embed");
  }, [isEmbed, embedParentOrigin]);

  useEffect(() => {
    fetch(`/api/v1/${tenant}/services`).then((r) => r.json()).then((d) => {
      setServices(d.services ?? []);
      if (!serviceId && d.services?.[0]) setServiceId(d.services[0].id);
    });
  }, [tenant]);

  useEffect(() => {
    if (!serviceId) return;
    fetch(`/api/v1/${tenant}/availability?service=${serviceId}&days=7`).then((r) => r.json()).then((d) => setSlots(d.slots ?? []));
  }, [tenant, serviceId]);

  // Lookup på email + service — kører når email ændres
  useEffect(() => {
    if (!client.email || !serviceId) { setLookup({ known: false }); return; }
    if (!/.+@.+\..+/.test(client.email)) return;
    const ctrl = new AbortController();
    fetch(`/api/v1/${tenant}/lookup?email=${encodeURIComponent(client.email)}&service=${serviceId}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: Lookup) => {
        setLookup(d);
        if (d.client && !client.name) setClient((c) => ({ ...c, name: d.client!.name }));
        // Vælg automatisk bedste tilskud
        const best = d.subsidies?.filter((s) => s.eligible).sort((a, b) => b.subsidyKr - a.subsidyKr)[0];
        if (best) setSelectedScheme(best.scheme);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [client.email, tenant, serviceId]);

  const service = services.find((s) => s.id === serviceId);
  const subsidyKr = lookup.subsidies?.find((s) => s.scheme === selectedScheme && s.eligible)?.subsidyKr ?? 0;
  const voucherAmountKr = appliedVoucher?.kind === "clip"
    ? (service?.price ?? 0)
    : Math.min(appliedVoucher?.balanceKr ?? 0, (service?.price ?? 0) - subsidyKr);
  const amountToPay = Math.max(0, (service?.price ?? 0) - subsidyKr - voucherAmountKr);
  const skipPayment = paymentCfg.paymentMode === "in_clinic" || amountToPay === 0;

  const finalize = async (method?: PaymentMethod) => {
    if (!pick || !service) return;
    const pspRef = "pay_" + Math.random().toString(36).slice(2, 14);
    if (method) setPaymentResult({ method, pspRef });

    const res = await fetch(`/api/v1/${tenant}/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        serviceId: service.id,
        startsAt: `${pick.day}T${pick.time}:00+02:00`,
        modality,
        client,
        subsidy: selectedScheme ? { scheme: selectedScheme, amountKr: subsidyKr } : null,
        voucher: appliedVoucher ? { code: appliedVoucher.code, amountKr: voucherAmountKr } : null,
        payment: method ? { method, pspRef, mode: paymentCfg.paymentMode, amountKr: amountToPay } : null,
      }),
    });
    const data = await res.json();
    setConfirm(data);
    setStep(5);

    if (isEmbed && data?.id) {
      window.parent?.postMessage(
        { source: "praxisos", type: "booking_confirmed", booking: data },
        embedParentOrigin,
      );
    }
  };

  const proceedFromContact = () => {
    if (skipPayment) finalize();
    else setStep(4);
  };

  const STEPS = skipPayment
    ? [[1, "Ydelse"], [2, "Tid"], [3, "Kontakt"], [5, "Bekræftet"]]
    : [[1, "Ydelse"], [2, "Tid"], [3, "Kontakt"], [4, "Betaling"], [5, "Bekræftet"]];

  return (
    <div className="mx-auto max-w-[860px]">
      <ol className="mb-8 flex flex-wrap items-center gap-y-2 text-[12px] text-muted">
        {STEPS.map(([n, label], idx) => (
          <li key={n as number} className="flex items-center gap-2">
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold"
              style={{
                background: step >= (n as number) ? "var(--brand-ink)" : "transparent",
                color: step >= (n as number) ? "var(--brand-paper)" : "var(--brand-ink)",
                border: step >= (n as number) ? "none" : "1px solid var(--color-line-2)",
              }}
            >
              {idx + 1}
            </span>
            <span className={step >= (n as number) ? "font-medium" : ""}>{label}</span>
            {idx < STEPS.length - 1 && <span className="mx-2 h-px w-6 bg-line-2" />}
          </li>
        ))}
      </ol>

      {/* Step 1 — service */}
      {step === 1 && (
        <section className="rise">
          <h1 className="display text-[28px] font-semibold">Vælg en ydelse</h1>
          <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => { setServiceId(s.id); setStep(2); }}
                className="text-left rounded-[12px] border border-line bg-white/40 p-4 transition-all hover:border-ink"
              >
                <div className="kicker">{s.category}</div>
                <div className="display mt-1.5 text-[17px] font-semibold">{s.name}</div>
                <div className="mt-1 text-[12.5px] text-muted">{s.description}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="mono text-[11.5px] text-muted">{s.durationMin} min</span>
                  <span className="display text-[16px] font-semibold">{s.price} kr</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2 — time */}
      {step === 2 && service && (
        <section className="rise">
          <div className="flex items-center justify-between">
            <div>
              <div className="kicker">{service.category}</div>
              <h1 className="display mt-1 text-[24px] font-semibold">{service.name} · {service.durationMin} min · {service.price} kr</h1>
            </div>
            <button onClick={() => setStep(1)} className="text-[12px] underline">Skift ydelse</button>
          </div>

          {service.modality.length > 1 && (
            <div className="mt-4 flex items-center gap-1.5">
              {service.modality.map((m) => (
                <button
                  key={m}
                  onClick={() => setModality(m)}
                  className="rounded-full border px-3 py-1 text-[12px]"
                  style={{
                    borderColor: modality === m ? "var(--brand-ink)" : "var(--color-line-2)",
                    background: modality === m ? "var(--brand-ink)" : "transparent",
                    color: modality === m ? "var(--brand-paper)" : "inherit",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          <div className="scrollbar-thin mt-6 grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(140px, 1fr))` }}>
            {slots.map((s) => {
              const d = new Date(s.day);
              const label = d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" });
              return (
                <div key={s.day} className="rounded-[12px] border border-line p-3">
                  <div className="kicker">{label}</div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {s.times.map((t) => {
                      const active = pick?.day === s.day && pick?.time === t;
                      return (
                        <button
                          key={t}
                          onClick={() => { setPick({ day: s.day, time: t }); setStep(3); }}
                          className="rounded-[9px] border px-3 py-1.5 text-[13px] font-medium mono transition-all"
                          style={{
                            borderColor: active ? "var(--brand-ink)" : "var(--color-line-2)",
                            background: active ? "var(--brand-ink)" : "transparent",
                            color: active ? "var(--brand-paper)" : "inherit",
                          }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Step 3 — contact */}
      {step === 3 && pick && service && (
        <section className="rise">
          <h1 className="display text-[24px] font-semibold">Dine oplysninger</h1>
          <div className="mt-2 mono text-[12px] text-muted">
            {service.name} · {new Date(pick.day).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })} kl. {pick.time} · {modality}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              ["name", "Navn", "Jane Doe"],
              ["email", "E-mail", "jane@example.com"],
              ["phone", "Telefon", "+45 12 34 56 78"],
            ].map(([k, label, ph]) => (
              <label key={k} className="flex flex-col gap-1.5">
                <span className="kicker">{label}</span>
                <input
                  value={(client as any)[k]}
                  onChange={(e) => setClient({ ...client, [k]: e.target.value })}
                  placeholder={ph as string}
                  className="rounded-[10px] border border-line-2 bg-white/60 px-3 py-2.5 text-[14px] outline-none focus:border-ink"
                />
              </label>
            ))}
          </div>

          {/* Subsidy-banner */}
          <SubsidyBanner
            subsidies={lookup.subsidies ?? []}
            selectedScheme={selectedScheme}
            setSelectedScheme={setSelectedScheme}
            clientKnown={lookup.known}
            clientName={lookup.client?.name}
          />

          {/* Voucher-input */}
          <div className="mt-3">
            <VoucherInput
              tenant={tenant}
              serviceId={service.id}
              appliedVoucher={appliedVoucher}
              setAppliedVoucher={setAppliedVoucher}
              suggestedVouchers={lookup.vouchers ?? []}
            />
          </div>

          {/* Pris-summary */}
          <div className="mt-4 rounded-[12px] border border-line bg-white/50 p-4">
            <div className="kicker mb-2">Pris-oversigt</div>
            <div className="flex flex-col gap-1.5 text-[13px]">
              <Row label={service.name}>{service.price} kr</Row>
              {subsidyKr > 0 && <Row label={`Tilskud · ${lookup.subsidies?.find((s) => s.scheme === selectedScheme)?.schemeLabel}`} className="text-signal">−{subsidyKr} kr</Row>}
              {voucherAmountKr > 0 && <Row label={`Voucher · ${appliedVoucher!.code}`} className="text-signal">−{voucherAmountKr} kr</Row>}
              <div className="mt-1.5 flex items-center justify-between border-t border-line pt-2.5">
                <span className="text-[14px] font-semibold">Du betaler</span>
                <span className="display text-[20px] font-semibold">{amountToPay} kr</span>
              </div>
            </div>
          </div>

          {/* Adresse via DAWA */}
          {modality === "Hjemmebesøg" && (
            <div className="mt-4">
              <AddressAutocomplete
                label="Hjemmebesøgs-adresse"
                required
                value={address}
                onChange={setAddress}
              />
            </div>
          )}

          {/* MitID-verifikation */}
          <div className="mt-4">
            {!mitidVerified ? (
              <div className="rounded-[12px] border border-accent/30 bg-accent/[0.04] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-[8px] bg-[#0061af] text-white text-[13px] font-bold">M</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">Verificér med MitID</div>
                    <div className="text-[11px] text-muted">
                      Sikker booking + automatisk tilskuds-beregning · 20 sek
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMitidModal(true)}
                    className="rounded-[10px] bg-[#0061af] px-4 py-2 text-[12.5px] font-medium text-white"
                  >
                    Verificér →
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-[10px] border border-signal/30 bg-signal/[0.06] p-3 text-[12px] text-ink-soft">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-signal/14 text-signal">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
                </span>
                <b>MitID-verificeret</b> · {client.name || "Pilar Mortensen"} · NSIS Substantial · GDPR Art. 9 · EU-data
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-2">
            <button onClick={() => setStep(2)} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]">Tilbage</button>
            <button
              onClick={proceedFromContact}
              disabled={!client.name || !client.email}
              className="flex-1 rounded-[10px] px-5 py-2.5 text-[13px] font-medium disabled:opacity-40"
              style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
            >
              {skipPayment ? (amountToPay === 0 ? "Bekræft booking (dækket fuldt)" : "Bekræft booking →") : `Til betaling · ${amountToPay} kr →`}
            </button>
          </div>
        </section>
      )}

      {/* Step 4 — payment */}
      {step === 4 && service && pick && (
        <PaymentStep
          tenant={tenant}
          serviceName={service.name}
          amountKr={amountToPay}
          paymentMode={paymentCfg.paymentMode}
          onPaid={(method) => finalize(method)}
          onBack={() => setStep(3)}
        />
      )}

      {/* Step 5 — confirmation */}
      {step === 5 && confirm && (
        <section className="rise">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-signal/14 text-signal">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
            </div>
            <h1 className="display mt-5 text-[28px] font-semibold">Tak — vi ses!</h1>
            <p className="mt-2 text-[13.5px] text-muted">{confirm.aria?.message}</p>
          </div>

          <div className="mt-6 overflow-hidden rounded-[14px] border border-line bg-white/60">
            <div className="px-5 py-4">
              <div className="kicker !text-[9px]">Booking</div>
              <div className="display mt-1 text-[19px] font-semibold">{confirm.service.name}</div>
              <div className="mt-1 mono text-[12px] text-muted">
                {new Date(confirm.startsAt).toLocaleString("da-DK", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {confirm.modality}
              </div>
            </div>

            {/* Pris-detalje med tilskud + voucher */}
            <div className="border-t border-line bg-paper-2/40 px-5 py-4">
              <div className="kicker !text-[9px] mb-2">Pris-detalje</div>
              <div className="flex flex-col gap-1 text-[12.5px]">
                <Row label={service?.name ?? ""}>{service?.price} kr</Row>
                {subsidyKr > 0 && (
                  <Row label={`Tilskud · ${lookup.subsidies?.find((s) => s.scheme === selectedScheme)?.schemeLabel?.split("·")[0].trim()}`} className="text-signal">−{subsidyKr} kr</Row>
                )}
                {voucherAmountKr > 0 && <Row label={`Voucher ${appliedVoucher?.code}`} className="text-signal">−{voucherAmountKr} kr</Row>}
                <div className="mt-1 flex items-center justify-between border-t border-line pt-1.5">
                  <span className="text-[13px] font-semibold">{amountToPay === 0 ? "Dækket fuldt" : "Betalt"}</span>
                  <span className="display text-[16px] font-semibold">{amountToPay} kr</span>
                </div>
              </div>
            </div>

            {selectedScheme && (
              <div className="border-t border-line bg-paper-2/40 px-5 py-3 text-[11.5px] text-ink-soft">
                <span className="kicker !text-[9px] text-signal">Indberetning</span>
                <div className="mt-0.5">
                  Tilskud bliver automatisk indberettet til{" "}
                  <b>{lookup.subsidies?.find((s) => s.scheme === selectedScheme)?.authority}</b>{" "}
                  efter behandlingen. Du behøver ikke gøre noget.
                </div>
              </div>
            )}

            {/* NemSMS-bekræftelse */}
            <div className="border-t border-line bg-paper-2/40 px-5 py-3 text-[11.5px] text-ink-soft">
              <div className="flex items-center gap-2">
                <span className="grid h-4 w-4 place-items-center rounded-[3px] bg-[#0061af] text-white text-[8px] font-bold">N</span>
                <span className="kicker !text-[9px]">NemSMS sendt</span>
              </div>
              <div className="mt-1">
                Officiel sundheds-SMS afsendt fra <b>BY PILAR</b> til {client.phone || "+45 ** ** ** **"}.
                <span className="block mt-0.5 text-[10.5px] text-faint mono">
                  praxis_nsms_{confirm.id.replace("bk_", "")} · 0,50 kr · leveret 12:42:08
                </span>
              </div>
            </div>

            {/* Påmindelse-plan */}
            <div className="border-t border-line bg-paper-2/40 px-5 py-3 text-[11px]">
              <span className="kicker !text-[9px]">Påmindelser · automatisk</span>
              <div className="mt-1 flex flex-col gap-0.5 text-ink-soft">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#0061af]">●</span>
                  <span className="mono">{new Date(new Date(confirm.startsAt).getTime() - 86400000).toLocaleString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span>· NemSMS påmindelse · 24t før</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-amber">○</span>
                  <span className="mono">{new Date(new Date(confirm.startsAt).getTime() - 3600000).toLocaleString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span>· valgfri 1t før (ikke aktiveret)</span>
                </div>
              </div>
            </div>

            {paymentResult && (
              <div className="border-t border-line bg-paper-2/40 px-5 py-3 text-[11px] text-faint">
                <span className="kicker !text-[9px]">Betalingsmetode</span>
                <div className="mt-0.5 text-ink">
                  {PAYMENT_METHOD_LABEL[paymentResult.method]} · ref {paymentResult.pspRef} · verificeret
                </div>
              </div>
            )}

            <div className="border-t border-line px-5 py-3 text-[11px] text-faint">
              <span className="kicker !text-[9px]">Booking-id</span>
              <div className="mono mt-0.5 text-[12.5px] text-ink">{confirm.id}</div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <a href={`/r/${confirm.id}`} target="_blank" className="flex-1 rounded-[10px] px-5 py-2.5 text-center text-[13px] font-medium" style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}>
              Vis kvittering →
            </a>
            <button className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]" onClick={() => isEmbed && window.parent?.postMessage({ source: "praxisos", type: "close" }, embedParentOrigin)}>
              Luk
            </button>
          </div>
        </section>
      )}

      {/* MitID-verifikations-modal */}
      {showMitidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6 fade-in" onClick={() => setShowMitidModal(false)}>
          <div className="w-[440px] max-w-full overflow-hidden rounded-[16px] border-2 border-[#0061af] bg-card shadow-2xl rise" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#0061af] px-5 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] opacity-70 uppercase tracking-wider">Verificér</div>
                  <div className="mt-1 text-[15px] font-semibold">Booking hos {tenant === "bypilar" ? "by Pilar" : "Nordlys"}</div>
                </div>
                <button onClick={() => setShowMitidModal(false)} className="text-white/80 hover:text-white text-[20px]">×</button>
              </div>
            </div>
            <div className="px-5 py-6 text-center">
              <p className="text-[12px] text-muted">Bekræft koden i din MitID-app er identisk med:</p>
              <div className="mt-4 mono text-[42px] font-bold tracking-[0.15em]">7-3-9</div>
              <div className="mt-2 mono text-[10px] text-faint">
                NSIS Substantial · scope=openid+mitid · single-use 5 min
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowMitidModal(false)}
                  className="rounded-[10px] border border-line-2 px-4 py-2.5 text-[13px]"
                >Annullér</button>
                <button
                  onClick={() => {
                    setMitidVerified(true);
                    setShowMitidModal(false);
                    // Auto-prefil hvis tomt
                    if (!client.name) setClient({ ...client, name: "Pilar Mortensen" });
                  }}
                  className="rounded-[10px] bg-[#0061af] px-4 py-2.5 text-[13px] font-medium text-white"
                >Bekræft i app</button>
              </div>
            </div>
            <div className="border-t border-line bg-paper-2/40 px-5 py-2 text-center mono text-[10px] text-faint">
              broker.signaturgruppen.dk · prototype: tryk for at simulere
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <span className="text-muted">{label}</span>
      <span className="mono">{children}</span>
    </div>
  );
}
