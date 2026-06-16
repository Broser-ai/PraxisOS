"use client";

import { useState } from "react";
import Link from "next/link";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { label: "Virksomhed", desc: "Navn, CVR, adresse" },
  { label: "Brand", desc: "Logo, farver, sprog" },
  { label: "Ydelser", desc: "Tilføj eller importér" },
  { label: "Behandlere", desc: "Inviter dit team" },
  { label: "Plan", desc: "Vælg licens" },
  { label: "Færdig", desc: "Tenant oprettet" },
];

const PLAN_OPTIONS = [
  { id: "headless", name: "Headless Starter", price: "199 kr/mo + API-volumen", desc: "Du har eget website. Vi er backend." },
  { id: "practice", name: "Practice", price: "349 kr/behandler/mo", desc: "Booking + journal + betaling." },
  { id: "practice-ai", name: "Practice + AI", price: "549 kr/behandler/mo", desc: "+ Aria, AI Scribe, no-show.", recommended: true },
  { id: "aesthetic", name: "Aesthetic Pro", price: "749 kr/behandler/mo", desc: "+ AR-journal, felt-service." },
];

export default function NewTenantWizard() {
  const [step, setStep] = useState<Step>(0);
  const [data, setData] = useState({
    legalName: "",
    cvr: "",
    address: "",
    phone: "",
    email: "",
    slug: "",
    brandColor: "#2f4a7c",
    accent: "#8a6a3d",
    paper: "#f7f3ec",
    language: "da-DK",
    plan: "practice-ai",
    services: [
      { name: "Konsultation", durationMin: 30, priceKr: 0 },
      { name: "Standard-behandling", durationMin: 45, priceKr: 495 },
    ],
    staff: [{ email: "", role: "Behandler" }],
    importPlanway: false,
  });

  const next = () => setStep((s) => Math.min(5, s + 1) as Step);
  const prev = () => setStep((s) => Math.max(0, s - 1) as Step);

  return (
    <div className="mx-auto max-w-[920px]">
      <div className="rise">
        <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
        <h1 className="display mt-2 text-[30px] font-semibold leading-none">Ny tenant</h1>
        <p className="mt-2 text-[13.5px] text-muted">Opret en ny klinik på under 10 minutter.</p>
      </div>

      {/* Trin-rail */}
      <div className="rise mt-6 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center gap-1.5">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold mono"
                style={{
                  background: step >= i ? "var(--color-ink)" : "var(--color-paper-2)",
                  color: step >= i ? "var(--color-paper)" : "var(--color-muted)",
                }}
              >
                {step > i ? "✓" : i + 1}
              </div>
              <span className="text-[10.5px] text-center font-medium">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-line" style={{ background: step > i ? "var(--color-ink)" : "var(--color-line)" }} />}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="card rise mt-6 p-6" style={{ animationDelay: "0.04s" }}>
        {step === 0 && (
          <>
            <h2 className="display text-[20px] font-semibold">Virksomhed</h2>
            <p className="mt-1 text-[13px] text-muted">Stamoplysninger til faktura og GDPR-grundlag.</p>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Juridisk navn" value={data.legalName} onChange={(v) => setData({ ...data, legalName: v })} placeholder="by Pilar ApS" />
              <Field label="CVR" value={data.cvr} onChange={(v) => setData({ ...data, cvr: v })} placeholder="12345678" />
              <Field label="Adresse" value={data.address} onChange={(v) => setData({ ...data, address: v })} placeholder="Hovedgaden 4, 8000 Aarhus C" />
              <Field label="Sub-domæne" value={data.slug} onChange={(v) => setData({ ...data, slug: v.toLowerCase().replace(/\s+/g, "") })} placeholder="bypilar" suffix=".praxis.app" />
              <Field label="E-mail" value={data.email} onChange={(v) => setData({ ...data, email: v })} placeholder="hej@bypilar.dk" type="email" />
              <Field label="Telefon" value={data.phone} onChange={(v) => setData({ ...data, phone: v })} placeholder="+45 …" />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="display text-[20px] font-semibold">Brand</h2>
            <p className="mt-1 text-[13px] text-muted">Farver, sprog og udtryk. Bruges automatisk på offentlig booking-side, kvitteringer og embed-modal.</p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <ColorField label="Primær farve" value={data.brandColor} onChange={(v) => setData({ ...data, brandColor: v })} />
              <ColorField label="Accent" value={data.accent} onChange={(v) => setData({ ...data, accent: v })} />
              <ColorField label="Baggrund" value={data.paper} onChange={(v) => setData({ ...data, paper: v })} />
              <div>
                <div className="kicker mb-1.5">Sprog</div>
                <select value={data.language} onChange={(e) => setData({ ...data, language: e.target.value })} className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px] outline-none focus:border-ink">
                  <option value="da-DK">Dansk</option>
                  <option value="en-US">English</option>
                  <option value="no-NO">Norsk</option>
                  <option value="sv-SE">Svensk</option>
                </select>
              </div>
            </div>
            {/* Preview */}
            <div className="mt-5 overflow-hidden rounded-[12px] border border-line">
              <div className="p-6" style={{ background: data.paper, color: data.brandColor }}>
                <div className="kicker">live-preview</div>
                <div className="display mt-2 text-[28px] font-semibold leading-tight">{data.legalName || "Din klinik"}</div>
                <div className="mt-2 text-[12px]" style={{ color: data.accent }}>Booking · Journal · {data.language}</div>
                <button className="mt-4 rounded-[8px] px-4 py-2 text-[12px] font-medium" style={{ background: data.brandColor, color: data.paper }}>
                  Book tid →
                </button>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="display text-[20px] font-semibold">Ydelser</h2>
                <p className="mt-1 text-[13px] text-muted">Tilføj de ydelser kunder kan booke. Du kan altid redigere senere.</p>
              </div>
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" checked={data.importPlanway} onChange={(e) => setData({ ...data, importPlanway: e.target.checked })} />
                Importér fra Planway-eksport
              </label>
            </div>
            {data.importPlanway && (
              <div className="mt-4 rounded-[10px] border-2 border-dashed border-line-2 p-6 text-center">
                <div className="text-[13px] font-medium">Træk Planway-eksport hertil</div>
                <div className="mt-1 text-[11.5px] text-faint">eller klik for at vælge fil (.csv eller .xlsx)</div>
                <div className="mt-3 mono text-[10px] text-faint">Vi mapper automatisk ydelser, behandlere og klienter.</div>
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2">
              {data.services.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_100px_60px] items-center gap-3 rounded-[10px] border border-line bg-paper p-3">
                  <input value={s.name} onChange={(e) => { const a = [...data.services]; a[i] = { ...s, name: e.target.value }; setData({ ...data, services: a }); }} placeholder="Ydelsens navn" className="bg-transparent text-[13px] font-medium outline-none" />
                  <input type="number" value={s.durationMin} onChange={(e) => { const a = [...data.services]; a[i] = { ...s, durationMin: +e.target.value }; setData({ ...data, services: a }); }} className="bg-transparent text-[12.5px] outline-none mono" />
                  <input type="number" value={s.priceKr} onChange={(e) => { const a = [...data.services]; a[i] = { ...s, priceKr: +e.target.value }; setData({ ...data, services: a }); }} className="bg-transparent text-[12.5px] outline-none mono text-right" />
                  <button onClick={() => setData({ ...data, services: data.services.filter((_, j) => j !== i) })} className="text-faint hover:text-clay">×</button>
                </div>
              ))}
              <button
                onClick={() => setData({ ...data, services: [...data.services, { name: "", durationMin: 30, priceKr: 0 }] })}
                className="rounded-[10px] border-2 border-dashed border-line-2 py-3 text-[12px] text-muted hover:bg-paper-2"
              >
                + Tilføj ydelse
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="display text-[20px] font-semibold">Behandlere</h2>
            <p className="mt-1 text-[13px] text-muted">Inviter dit team. De får en e-mail med opsætnings-link.</p>
            <div className="mt-5 flex flex-col gap-2">
              {data.staff.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_160px_60px] items-center gap-3 rounded-[10px] border border-line bg-paper p-3">
                  <input value={s.email} onChange={(e) => { const a = [...data.staff]; a[i] = { ...s, email: e.target.value }; setData({ ...data, staff: a }); }} placeholder="behandler@klinik.dk" className="bg-transparent text-[13px] outline-none" />
                  <select value={s.role} onChange={(e) => { const a = [...data.staff]; a[i] = { ...s, role: e.target.value }; setData({ ...data, staff: a }); }} className="bg-transparent text-[12.5px] outline-none">
                    {["Ejer", "Behandler", "Fodterapeut", "Receptionist", "Studerende"].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button onClick={() => setData({ ...data, staff: data.staff.filter((_, j) => j !== i) })} className="text-faint hover:text-clay">×</button>
                </div>
              ))}
              <button
                onClick={() => setData({ ...data, staff: [...data.staff, { email: "", role: "Behandler" }] })}
                className="rounded-[10px] border-2 border-dashed border-line-2 py-3 text-[12px] text-muted hover:bg-paper-2"
              >
                + Inviter behandler
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="display text-[20px] font-semibold">Vælg plan</h2>
            <p className="mt-1 text-[13px] text-muted">Du kan opgradere eller nedgradere når som helst. Første 14 dage er gratis.</p>
            <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
              {PLAN_OPTIONS.map((p) => (
                <label
                  key={p.id}
                  className="card flex cursor-pointer items-start gap-3 p-4 transition-all"
                  style={{
                    borderColor: data.plan === p.id ? "var(--color-ink)" : undefined,
                    background: data.plan === p.id ? "var(--color-paper-2)" : "var(--color-card)",
                  }}
                >
                  <input
                    type="radio"
                    name="plan"
                    checked={data.plan === p.id}
                    onChange={() => setData({ ...data, plan: p.id })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{p.name}</span>
                      {p.recommended && <span className="chip !text-[9px]">anbefalet</span>}
                    </div>
                    <div className="mt-0.5 mono text-[11.5px] text-faint">{p.price}</div>
                    <div className="mt-2 text-[12px] text-ink-soft">{p.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-signal/14 text-signal">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
            </div>
            <h2 className="display mt-5 text-[26px] font-semibold leading-tight">Tenant oprettet</h2>
            <p className="mt-2 text-[13px] text-muted">{data.legalName || "Din nye klinik"} er klar.</p>
            <div className="mt-5 inline-block rounded-[12px] border border-line bg-paper-2 p-4 text-left mono text-[12px]">
              <div className="text-faint">URL</div>
              <div className="mt-0.5">https://{data.slug || "klinik"}.praxis.app</div>
              <div className="mt-3 text-faint">API endpoint</div>
              <div className="mt-0.5">https://api.praxis.app/v1/{data.slug || "klinik"}/</div>
              <div className="mt-3 text-faint">Plan</div>
              <div className="mt-0.5">{PLAN_OPTIONS.find((p) => p.id === data.plan)?.name}</div>
              <div className="mt-3 text-faint">Trial</div>
              <div className="mt-0.5 text-signal">14 dage gratis</div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Link href="/admin/tenants" className="btn btn-primary">Til oversigt</Link>
              <Link href={`/admin/integration/bypilar`} className="btn btn-ghost">Integrations-guide →</Link>
            </div>
          </div>
        )}

        {step < 5 && (
          <div className="mt-7 flex items-center justify-between border-t border-line pt-5">
            <button onClick={prev} disabled={step === 0} className="btn btn-ghost disabled:opacity-40">← Tilbage</button>
            <button onClick={next} className="btn btn-primary">{step === 4 ? "Opret tenant →" : "Næste →"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", suffix }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; suffix?: string }) {
  return (
    <div>
      <div className="kicker mb-1.5">{label}</div>
      <div className="flex items-center gap-1.5 rounded-[10px] border border-line-2 bg-card px-3 py-2 focus-within:border-ink">
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-[13px] outline-none" />
        {suffix && <span className="mono text-[11px] text-faint">{suffix}</span>}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="kicker mb-1.5">{label}</div>
      <div className="flex items-center gap-2 rounded-[10px] border border-line-2 bg-card px-3 py-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-12 cursor-pointer rounded-[6px] border border-line bg-transparent" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent text-[13px] outline-none mono" />
      </div>
    </div>
  );
}
