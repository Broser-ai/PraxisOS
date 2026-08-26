"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CvrLookup } from "@/components/CvrLookup";
import { formatPlanPrice, getPlan, PLANS } from "@/lib/plans";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState({
    cvr: "",
    legalName: "",
    address: "",
    email: "",
    phone: "",
    contactName: "",
    slug: "",
    plan: "practice",
  });

  useEffect(() => {
    const plan = searchParams.get("plan");
    if (plan && PLANS.some((p) => p.id === plan)) {
      setData((d) => ({ ...d, plan }));
    }
  }, [searchParams]);

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        const messages: Record<string, string> = {
          slug_taken: `Slug «${data.slug}» er optaget — vælg et andet.`,
          email_taken: "E-mailen er allerede i brug.",
          invalid_cvr: "CVR skal være 8 cifre.",
          invalid_email: "Ugyldig e-mail.",
          missing_fields: "Udfyld alle påkrævede felter.",
          rate_limited: "For mange forsøg — prøv igen om lidt.",
        };
        setError(messages[json.error] ?? `Kunne ikke oprette klinik (${json.error ?? res.status}).`);
        return;
      }
      router.push(json.next?.setupUrl ?? `/t/${data.slug}/setup`);
    } catch {
      setError("Netværksfejl — prøv igen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[800px] items-center justify-between px-6 py-4">
          <Link href="/" className="display text-[16px] font-semibold">
            PraxisOS
          </Link>
          <span className="mono text-[11px] text-faint">trin {step}/3 · B2B licens · 30 dages trial</span>
        </div>
      </header>

      <div className="mx-auto max-w-[640px] px-6 py-12">
        <div className="mb-8 flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1 flex-1 rounded-full ${n <= step ? "bg-ink" : "bg-paper-2"}`} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h1 className="display text-[32px] font-semibold">Hvilken klinik?</h1>
            <p className="mt-2 text-[13.5px] text-ink-soft">Slå op i CVR — vi forfylder resten.</p>
            <div className="mt-6">
              <CvrLookup
                onResult={(c) => {
                  setData({
                    ...data,
                    cvr: c.cvr,
                    legalName: c.name,
                    address: `${c.address}, ${c.zipcode} ${c.city}`,
                    phone: c.phone || data.phone,
                    email: c.email || data.email,
                    slug: slugify(c.name),
                  });
                }}
              />
            </div>
            {data.legalName && (
              <div className="mt-5 rounded-[12px] border border-line bg-card p-4">
                <div className="kicker">Bekræft</div>
                <div className="mt-2 mono text-[12px]">CVR {data.cvr}</div>
                <div className="display mt-1 text-[16px] font-semibold">{data.legalName}</div>
                <div className="text-[12px] text-muted">{data.address}</div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="kicker">Tenant-slug</span>
                  <input
                    value={data.slug}
                    onChange={(e) => setData({ ...data, slug: slugify(e.target.value) })}
                    className="mono flex-1 rounded-[6px] border border-line bg-paper px-2 py-1 text-[11.5px]"
                  />
                  <span className="kicker">.praxis.app</span>
                </div>
              </div>
            )}
            <button
              disabled={!data.legalName || !data.slug}
              onClick={() => setStep(2)}
              className="mt-8 w-full rounded-[10px] bg-ink px-4 py-3 text-[13.5px] font-medium text-paper disabled:opacity-40"
            >
              Fortsæt →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="display text-[32px] font-semibold">Hvem er kontaktperson?</h1>
            <p className="mt-2 text-[13.5px] text-ink-soft">Du bliver klinikkens admin.</p>
            <div className="mt-6 flex flex-col gap-3">
              <Field label="Navn" value={data.contactName} onChange={(v) => setData({ ...data, contactName: v })} placeholder="Pilar Mortensen" />
              <Field label="E-mail" value={data.email} onChange={(v) => setData({ ...data, email: v })} placeholder="hej@klinik.dk" type="email" />
              <Field label="Mobil" value={data.phone} onChange={(v) => setData({ ...data, phone: v })} placeholder="+45 00 00 00 00" />
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setStep(1)} className="rounded-[10px] border border-line bg-card px-4 py-2.5 text-[13px]">
                ← Tilbage
              </button>
              <button
                disabled={!data.contactName || !data.email}
                onClick={() => setStep(3)}
                className="flex-1 rounded-[10px] bg-ink px-4 py-2.5 text-[13.5px] font-medium text-paper disabled:opacity-40"
              >
                Fortsæt →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="display text-[32px] font-semibold">Vælg licens</h1>
            <p className="mt-2 text-[13.5px] text-ink-soft">30 dages gratis trial. Aktiver betaling i setup.</p>
            <div className="mt-6 flex flex-col gap-2">
              {PLANS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-[10px] border bg-card p-4 ${
                    data.plan === p.id ? "border-ink" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    checked={data.plan === p.id}
                    onChange={() => setData({ ...data, plan: p.id })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold">{p.name}</span>
                      <span className="mono text-[12px]">
                        {formatPlanPrice(p)}
                        {p.periodLabel.replace("/md", "").trim() ? ` ${p.periodLabel}` : "/md"}
                      </span>
                    </div>
                    <div className="text-[12px] text-muted">{p.tagline}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 rounded-[12px] border border-line bg-paper-2/40 p-4 text-[12.5px]">
              <strong>{data.legalName}</strong> · CVR {data.cvr}
              <br />
              Admin: {data.contactName} · {data.email}
              <br />
              Tenant: <span className="mono">{data.slug}.praxis.app</span>
              <br />
              Plan: {getPlan(data.plan).name}
            </div>

            {error && (
              <div className="mt-4 rounded-[10px] border border-line bg-paper-2/60 px-3 py-2 text-[12px] text-clay">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button onClick={() => setStep(2)} className="rounded-[10px] border border-line bg-card px-4 py-2.5 text-[13px]">
                ← Tilbage
              </button>
              <button
                disabled={submitting}
                onClick={submit}
                className="flex-1 rounded-[10px] bg-ink px-4 py-2.5 text-[13.5px] font-medium text-paper disabled:opacity-40"
              >
                {submitting ? "Opretter…" : "Opret klinik + start trial"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-10 text-center text-[11px] text-faint">
          Har du allerede en konto?{" "}
          <Link href="/login" className="text-clay hover:underline">
            Log ind
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="kicker mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:ring-1 focus:ring-ink"
      />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper p-10 text-muted">Indlæser…</div>}>
      <SignupForm />
    </Suspense>
  );
}
