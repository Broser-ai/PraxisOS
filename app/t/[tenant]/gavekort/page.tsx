"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenants";
import Link from "next/link";

const AMOUNTS = [500, 1000, 1500, 2000, 3000, 5000];

type Step = 1 | 2 | 3 | 4;

export default function GavekortKoebPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = use(params);
  const t = getTenant(tenant);
  if (!t) notFound();

  const [step, setStep] = useState<Step>(1);
  const [amount, setAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [recipient, setRecipient] = useState({ name: "", email: "" });
  const [buyer, setBuyer] = useState({ name: "", email: "" });
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const finalAmount = customAmount ? Number(customAmount) : amount;
  const exp = new Date();
  exp.setFullYear(exp.getFullYear() + 3);

  const generateCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ234567";
    const pick = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    return `GIFT-${pick(4)}-${pick(4)}`;
  };

  const submit = async () => {
    // Simulér køb
    await new Promise((r) => setTimeout(r, 1200));
    setGeneratedCode(generateCode());
    setStep(4);
  };

  return (
    <div className="mx-auto max-w-[680px]">
      {/* Progress */}
      <ol className="mb-8 flex items-center gap-2 text-[12px] text-muted">
        {[["1", "Beløb"], ["2", "Modtager"], ["3", "Betaling"], ["4", "Færdig"]].map(([n, label], idx) => (
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
          <div className="kicker">Gavekort</div>
          <h1 className="display mt-2 text-[32px] font-semibold">Forkæl én du holder af</h1>
          <p className="mt-2 text-[14px]" style={{ color: t.brand.secondary }}>
            Et gavekort til {t.brand.name} kan bruges til alle ydelser · gælder i 3 år iht. dansk lov · sendes som e-mail.
          </p>

          {/* Gavekort preview */}
          <div
            className="mt-7 overflow-hidden rounded-[16px] border border-line"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${t.brand.accent} 25%, white), color-mix(in srgb, ${t.brand.accent} 8%, white))`,
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="kicker !text-[10px]" style={{ color: t.brand.ink }}>{t.brand.name}</span>
                  <div className="display mt-1 text-[22px] font-semibold">Gavekort</div>
                </div>
                <span style={{ color: t.brand.accent }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
                </span>
              </div>
              <div className="mt-8 display text-[40px] font-semibold leading-none">
                {finalAmount.toLocaleString("da-DK")} kr
              </div>
              <div className="mt-2 text-[11px]" style={{ color: t.brand.secondary }}>
                udløber {exp.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Beløbsvalg */}
          <div className="mt-6">
            <div className="kicker mb-2">Vælg beløb</div>
            <div className="grid grid-cols-3 gap-2">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setAmount(a); setCustomAmount(""); }}
                  className="rounded-[10px] border px-3 py-3 text-[14px] font-semibold transition-all"
                  style={{
                    borderColor: (!customAmount && amount === a) ? "var(--brand-ink)" : "var(--color-line-2)",
                    background: (!customAmount && amount === a) ? "var(--brand-ink)" : "var(--color-card)",
                    color: (!customAmount && amount === a) ? "var(--brand-paper)" : "inherit",
                  }}
                >
                  {a.toLocaleString("da-DK")} kr
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-line-2 bg-card px-3 py-2">
              <span className="text-[12px] text-muted">eller eget beløb</span>
              <input
                type="number"
                min={100}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent text-right mono text-[14px] outline-none"
              />
              <span className="text-[12px] text-muted">kr</span>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={finalAmount < 100}
            className="mt-6 w-full rounded-[10px] py-3 text-[14px] font-medium disabled:opacity-40"
            style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
          >
            Fortsæt →
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="rise">
          <h1 className="display text-[26px] font-semibold">Til hvem?</h1>
          <p className="mt-1 text-[13px]" style={{ color: t.brand.secondary }}>Modtagerens oplysninger.</p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldInput label="Modtagerens navn" value={recipient.name} onChange={(v) => setRecipient({ ...recipient, name: v })} placeholder="Lise Brandt" />
            <FieldInput label="Modtagerens e-mail" value={recipient.email} onChange={(v) => setRecipient({ ...recipient, email: v })} placeholder="lise.b@example.com" />
          </div>

          <div className="mt-3">
            <div className="kicker mb-1.5">Hilsen · valgfri</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tillykke med fødselsdagen — håber du nyder det. ❤️"
              maxLength={280}
              rows={3}
              className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[13.5px] outline-none focus:border-ink resize-none"
            />
            <div className="mt-1 text-right mono text-[10.5px] text-faint">{message.length}/280</div>
          </div>

          <div className="mt-3">
            <div className="kicker mb-1.5">Send gavekortet</div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeliveryDate(new Date().toISOString().slice(0, 10))}
                className="flex-1 rounded-[10px] border px-3 py-2 text-[12.5px]"
                style={{
                  borderColor: deliveryDate === new Date().toISOString().slice(0, 10) ? "var(--brand-ink)" : "var(--color-line-2)",
                  background: deliveryDate === new Date().toISOString().slice(0, 10) ? "var(--brand-ink)" : "var(--color-card)",
                  color: deliveryDate === new Date().toISOString().slice(0, 10) ? "var(--brand-paper)" : "inherit",
                }}
              >
                Med det samme
              </button>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[12.5px] mono outline-none focus:border-ink"
              />
            </div>
          </div>

          <h2 className="display mt-7 text-[16px] font-semibold">Dine oplysninger</h2>
          <p className="mt-1 text-[12px]" style={{ color: t.brand.secondary }}>Bruges til faktura.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldInput label="Dit navn" value={buyer.name} onChange={(v) => setBuyer({ ...buyer, name: v })} placeholder="Jonas Brandt" />
            <FieldInput label="Din e-mail" value={buyer.email} onChange={(v) => setBuyer({ ...buyer, email: v })} placeholder="jonas@brandt.dk" />
          </div>

          <div className="mt-6 flex gap-2">
            <button onClick={() => setStep(1)} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]">Tilbage</button>
            <button
              onClick={() => setStep(3)}
              disabled={!recipient.name || !recipient.email || !buyer.name || !buyer.email}
              className="flex-1 rounded-[10px] py-2.5 text-[13.5px] font-medium disabled:opacity-40"
              style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
            >
              Til betaling →
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rise">
          <h1 className="display text-[26px] font-semibold">Betaling</h1>
          <p className="mt-1 mono text-[12px]" style={{ color: t.brand.secondary }}>Gavekort · {finalAmount.toLocaleString("da-DK")} kr</p>

          <div className="mt-5 flex flex-col gap-2">
            {[
              { id: "mobilepay", label: "MobilePay", color: "#5A78FF" },
              { id: "card", label: "Kort · Visa / MC / Amex", color: "#1b1a17" },
              { id: "applepay", label: "Apple Pay", color: "#000" },
            ].map((m, i) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line-2 bg-card p-3 hover:border-ink">
                <input type="radio" name="pay" defaultChecked={i === 0} />
                <span className="grid h-7 w-10 place-items-center rounded-[6px] text-[12px] font-bold text-white" style={{ background: m.color }}>
                  {m.label.charAt(0)}
                </span>
                <span className="text-[13px] font-medium">{m.label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={submit}
            className="mt-5 w-full rounded-[10px] py-3 text-[14px] font-medium"
            style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
          >
            Betal {finalAmount.toLocaleString("da-DK")} kr →
          </button>

          <div className="mt-3 text-center text-[10.5px] text-faint">
            PraxisTrust · MitID step-up · krypteret betaling
          </div>
        </section>
      )}

      {step === 4 && generatedCode && (
        <section className="rise text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-signal/14 text-signal">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
          </div>
          <h1 className="display mt-5 text-[28px] font-semibold">Gavekort sendt!</h1>
          <p className="mt-2 text-[13.5px]" style={{ color: t.brand.secondary }}>
            {recipient.name} modtager gavekortet på <b>{recipient.email}</b>{" "}
            {new Date(deliveryDate).toDateString() === new Date().toDateString() ? "lige nu" : `den ${new Date(deliveryDate).toLocaleDateString("da-DK")}`}.
          </p>

          <div className="mt-7 inline-block rounded-[14px] border border-line bg-card p-6 text-left">
            <div className="kicker">Gavekort-kode</div>
            <div className="mono mt-2 text-[24px] font-bold tracking-wider">{generatedCode}</div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
              <Field label="Beløb">{finalAmount.toLocaleString("da-DK")} kr</Field>
              <Field label="Modtager">{recipient.name}</Field>
              <Field label="Udløber">{exp.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}</Field>
              <Field label="Voucher-id">{`vou_${generatedCode.replace(/-/g, "").toLowerCase()}`}</Field>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-2">
            <button className="rounded-[10px] px-5 py-2.5 text-[13px] font-medium" style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}>
              Print som PDF
            </button>
            <Link href={`/t/${tenant}`} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]">
              Til forsiden
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}
