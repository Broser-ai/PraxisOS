"use client";

import { useState } from "react";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_ICON, TENANT_PAYMENT_CONFIG, type PaymentMethod } from "@/lib/payments";

type Props = {
  tenant: string;
  serviceName: string;
  amountKr: number;
  paymentMode: "prepay" | "auth_only" | "in_clinic";
  onPaid: (method: PaymentMethod) => void;
  onBack: () => void;
};

function MethodIcon({ method }: { method: PaymentMethod }) {
  const color = PAYMENT_METHOD_ICON[method];
  // Stiliserede logo-glyphs · PraxisOS Pay native komponent
  const glyph: Record<PaymentMethod, string> = {
    mobilepay: "M",
    dankort:   "D",
    card:      "▭",
    applepay:  "",
    googlepay: "G",
    klarna:    "K.",
    sepa:      "≡",
    vipps:     "v",
    swish:     "s",
  };
  return (
    <span
      className="grid h-9 w-12 place-items-center rounded-[6px] text-[14px] font-bold text-white"
      style={{ background: color }}
    >
      {glyph[method]}
    </span>
  );
}

export function PaymentStep({ tenant, serviceName, amountKr, paymentMode, onPaid, onBack }: Props) {
  const cfg = TENANT_PAYMENT_CONFIG[tenant] ?? TENANT_PAYMENT_CONFIG.bypilar;
  const [selected, setSelected] = useState<PaymentMethod>(cfg.defaultMethod);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [mobilepayPhone, setMobilepayPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<"select" | "3ds" | "approving">("select");

  const start = () => {
    setProcessing(true);
    setStep("3ds");
    // Simulér 3DS2-flow
    setTimeout(() => setStep("approving"), 1500);
    setTimeout(() => onPaid(selected), 3000);
  };

  const modeText = {
    prepay:    { label: "Trækkes ved booking", color: "var(--color-accent)" },
    auth_only: { label: "Reserveres nu · trækkes ved fremmøde", color: "var(--color-signal)" },
    in_clinic: { label: "Betal i klinikken", color: "var(--color-muted)" },
  }[paymentMode];

  if (step === "3ds" || step === "approving") {
    return (
      <div className="text-center py-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/14 text-accent">
          {step === "3ds" ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1.4s" repeatCount="indefinite" />
            </svg>
          )}
        </div>
        <h2 className="display mt-5 text-[22px] font-semibold">
          {step === "3ds" ? "Bekræft med MitID" : "Godkender betaling…"}
        </h2>
        <p className="mt-2 text-[13px] text-muted">
          {step === "3ds"
            ? "PraxisTrust step-up · vi har sendt en notifikation til din MitID-app."
            : "PraxisOS Pay behandler betalingen · få sekunder."}
        </p>
        <div className="mt-6 inline-flex items-center gap-1.5 mono text-[10.5px] text-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
          praxis-pay · EU-resident · krypteret kommunikation
        </div>
      </div>
    );
  }

  return (
    <section className="rise">
      <h1 className="display text-[24px] font-semibold">Betaling</h1>
      <div className="mt-1 mono text-[12px] text-muted">{serviceName} · {amountKr} kr</div>

      <div className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: modeText.color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: modeText.color }} />
        {modeText.label}
      </div>

      {/* Method picker */}
      <div className="mt-6 grid grid-cols-1 gap-2">
        {cfg.enabledMethods.map((m) => (
          <label
            key={m}
            className="flex cursor-pointer items-center gap-3 rounded-[10px] border p-3 transition-all"
            style={{
              borderColor: selected === m ? "var(--brand-ink, var(--color-ink))" : "var(--color-line-2)",
              background: selected === m ? "var(--color-paper-2)" : "transparent",
            }}
          >
            <input
              type="radio"
              name="method"
              checked={selected === m}
              onChange={() => setSelected(m)}
              className="accent-current"
            />
            <MethodIcon method={m} />
            <span className="flex-1 text-[13.5px] font-medium">{PAYMENT_METHOD_LABEL[m]}</span>
            {m === cfg.defaultMethod && <span className="chip mono !text-[9.5px]">populær</span>}
          </label>
        ))}
      </div>

      {/* Method-specific input */}
      <div className="mt-5">
        {selected === "card" && (
          <div className="rounded-[12px] border border-line-2 bg-card p-4">
            <div className="kicker !text-[9.5px]">Kortdetaljer</div>
            <input
              value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value })}
              placeholder="1234 5678 9012 3456"
              className="mt-2 w-full bg-transparent text-[14px] mono tracking-wider outline-none"
            />
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
              <input
                value={card.expiry}
                onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                placeholder="MM/ÅÅ"
                className="bg-transparent text-[13px] mono outline-none"
              />
              <input
                value={card.cvc}
                onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                placeholder="CVC"
                className="bg-transparent text-[13px] mono outline-none"
              />
            </div>
          </div>
        )}

        {selected === "mobilepay" && (
          <div className="rounded-[12px] p-5" style={{ background: "linear-gradient(135deg, #5A78FF, #354EE8)", color: "white" }}>
            <div className="flex items-center gap-2 text-[13px] font-medium opacity-90">
              <span>MobilePay</span>
              <span className="mono text-[11px] opacity-70">· godkend i din app</span>
            </div>
            <input
              value={mobilepayPhone}
              onChange={(e) => setMobilepayPhone(e.target.value)}
              placeholder="+45 12 34 56 78"
              className="mt-3 w-full bg-white/15 rounded-[8px] px-3 py-2.5 text-[15px] outline-none placeholder:text-white/60"
            />
            <div className="mt-2 text-[11px] opacity-75">Vi sender en betalings-anmodning til din MobilePay-app.</div>
          </div>
        )}

        {selected === "applepay" && (
          <div className="rounded-[12px] bg-black p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="text-[13px] opacity-80">Betal med</span>
              <span className="text-[18px] font-semibold"> Pay</span>
            </div>
            <div className="mt-3 text-[14px] font-medium">{amountKr},00 kr</div>
            <div className="mt-1 text-[11px] opacity-60">Touch ID eller Face ID på din enhed</div>
          </div>
        )}

        {selected === "klarna" && (
          <div className="rounded-[12px] p-5" style={{ background: "#FFA8CD" }}>
            <div className="text-[14px] font-semibold text-black">Klarna · betal i 3 rater</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-black">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-[8px] bg-white/40 p-2.5">
                  <div className="text-[10px] uppercase opacity-70">Rate {i}</div>
                  <div className="mt-0.5 mono text-[13px] font-semibold">{Math.round(amountKr / 3)} kr</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10.5px] text-black/70">Rentefrit · ingen gebyrer · godkendelse på sekunder</div>
          </div>
        )}

        {(selected === "googlepay" || selected === "dankort" || selected === "sepa" || selected === "vipps" || selected === "swish") && (
          <div className="rounded-[12px] border border-line-2 bg-card p-5 text-center text-[12.5px] text-muted">
            Du sendes til {PAYMENT_METHOD_LABEL[selected]} for at færdiggøre betalingen.
          </div>
        )}
      </div>

      {/* Trust row */}
      <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] text-faint">
        <span className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>
          PraxisTrust · MitID step-up
        </span>
        <span>·</span>
        <span>EU-hostet · GDPR Art. 9</span>
        <span>·</span>
        <span>PCI-DSS Level 1</span>
        <span>·</span>
        <span>PraxisRisk aktiv</span>
      </div>

      <div className="mt-6 flex gap-2">
        <button onClick={onBack} disabled={processing} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px] disabled:opacity-40">← Tilbage</button>
        <button
          onClick={start}
          disabled={processing}
          className="flex-1 rounded-[10px] px-5 py-2.5 text-[13.5px] font-medium disabled:opacity-40"
          style={{ background: "var(--brand-ink, var(--color-ink))", color: "var(--brand-paper, var(--color-paper))" }}
        >
          {paymentMode === "prepay" ? `Betal ${amountKr} kr →` : paymentMode === "auth_only" ? `Reservér ${amountKr} kr →` : `Bekræft booking →`}
        </button>
      </div>
    </section>
  );
}
