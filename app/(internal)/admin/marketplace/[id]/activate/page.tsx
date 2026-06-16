"use client";

import { use, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { getModule, MODULES, isModuleActive, calculateTotalCost } from "@/lib/modules";

type Step = 1 | 2 | 3 | 4 | 5;

export default function ModuleActivate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const m = getModule(id);
  if (!m) notFound();

  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [seats, setSeats] = useState(2);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [activatedDeps, setActivatedDeps] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<Record<string, any>>({});

  // Find missing dependencies
  const missingDeps = (m.dependsOn ?? [])
    .filter((d) => !isModuleActive("bypilar", d))
    .map((d) => getModule(d))
    .filter(Boolean) as NonNullable<ReturnType<typeof getModule>>[];

  const cost = m.pricingModel === "flat" ? m.priceMonthly :
               m.pricingModel === "per_seat" ? m.pricePerSeat * seats : 0;
  const depsCost = missingDeps.reduce((s, d) => {
    if (!activatedDeps[d.id]) return s;
    return s + (d.pricingModel === "flat" ? d.priceMonthly : d.pricePerSeat * seats);
  }, 0);
  const totalCost = cost + depsCost;

  const next = () => setStep((s) => Math.min(5, s + 1) as Step);
  const prev = () => setStep((s) => Math.max(1, s - 1) as Step);

  const STEPS = [
    { n: 1, label: "Bekræft" },
    { n: 2, label: "Afhængigheder" },
    { n: 3, label: "Konfiguration" },
    { n: 4, label: "Pris" },
    { n: 5, label: "Aktivér" },
  ];

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="rise">
        <Link href={`/admin/marketplace/${m.id}`} className="kicker hover:underline">← Tilbage til modul</Link>
        <h1 className="display mt-2 text-[28px] font-semibold leading-tight">Aktivér {m.name}</h1>
        <p className="mt-1 text-[13px] text-muted">{m.trialDays > 0 ? `${m.trialDays} dages gratis prøveperiode · ingen kortdata` : "Uden prøveperiode · faktureres straks"}</p>
      </div>

      {/* Progress-rail */}
      <ol className="rise mt-7 flex flex-wrap items-center gap-y-2 text-[12px] text-muted">
        {STEPS.map((s, idx) => (
          <li key={s.n} className="flex items-center gap-2 shrink-0">
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold"
              style={{
                background: step >= s.n ? "var(--color-ink)" : "transparent",
                color: step >= s.n ? "var(--color-paper)" : "var(--color-ink)",
                border: step >= s.n ? "none" : "1px solid var(--color-line-2)",
              }}
            >
              {step > s.n ? "✓" : s.n}
            </span>
            <span className={step >= s.n ? "font-medium" : ""}>{s.label}</span>
            {idx < STEPS.length - 1 && <span className="mx-2 h-px w-5 bg-line-2" />}
          </li>
        ))}
      </ol>

      <div className="mt-7">
        {/* Step 1 — Bekræft */}
        {step === 1 && (
          <section className="rise card p-7">
            <div className="flex items-start gap-4">
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-[12px] text-paper"
                style={{ background: m.iconColor }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={m.icon} />
                </svg>
              </span>
              <div>
                <h2 className="display text-[22px] font-semibold">{m.name}</h2>
                <p className="mt-1 text-[13px] text-muted">{m.tagline}</p>
                {m.agentRole && (
                  <div className="mt-2 inline-flex items-center gap-2 chip mono !text-[10px]">
                    Drevet af {m.agentRole}
                  </div>
                )}
              </div>
            </div>

            <p className="mt-5 text-[13.5px] leading-relaxed text-ink-soft">{m.description}</p>

            <div className="mt-5">
              <div className="kicker mb-2">Hvad du får</div>
              <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                {m.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-[8px] border border-line bg-paper p-2.5">
                    <span className="mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-signal/14 text-signal text-[9px]">✓</span>
                    <span className="text-[11.5px]">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={next} className="btn btn-primary">Fortsæt →</button>
            </div>
          </section>
        )}

        {/* Step 2 — Afhængigheder */}
        {step === 2 && (
          <section className="rise card p-7">
            <h2 className="display text-[20px] font-semibold">Afhængigheder</h2>
            {missingDeps.length === 0 ? (
              <>
                <p className="mt-2 text-[13px] text-muted">Alle nødvendige moduler er allerede aktive — vi kan gå videre.</p>
                <div className="mt-4 rounded-[10px] border border-signal/30 bg-signal/[0.06] p-3.5 text-[12.5px]">
                  <div className="kicker !text-signal mb-1">Klar til aktivering</div>
                  <span className="text-ink-soft">Ingen yderligere moduler skal aktiveres.</span>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-[13px] text-muted">
                  {m.shortName} kræver {missingDeps.length} {missingDeps.length === 1 ? "modul" : "moduler"} for at fungere. Vi kan aktivere dem nu — med samme prøveperiode.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {missingDeps.map((d) => (
                    <label key={d.id} className="flex items-start gap-3 rounded-[10px] border border-line bg-paper p-3.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activatedDeps[d.id] ?? true}
                        onChange={(e) => setActivatedDeps((a) => ({ ...a, [d.id]: e.target.checked }))}
                        className="mt-1"
                      />
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-paper"
                        style={{ background: d.iconColor }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d={d.icon} />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold">{d.name}</div>
                        <div className="text-[11px] text-muted">{d.tagline}</div>
                        <div className="mt-1 mono text-[10px] text-faint">
                          {d.pricingModel === "flat" ? `${d.priceMonthly} kr/md` :
                            d.pricingModel === "per_seat" ? `${d.pricePerSeat} kr/behandler/md` : "volumen-baseret"}
                          {" · "}{d.trialDays} dages prøve
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="mt-6 flex justify-between">
              <button onClick={prev} className="btn btn-ghost">← Tilbage</button>
              <button onClick={next} className="btn btn-primary">Fortsæt →</button>
            </div>
          </section>
        )}

        {/* Step 3 — Konfiguration */}
        {step === 3 && (
          <section className="rise card p-7">
            <h2 className="display text-[20px] font-semibold">Konfiguration</h2>
            <p className="mt-2 text-[13px] text-muted">Tilpas modulet til klinikken.</p>

            <div className="mt-5 flex flex-col gap-4">
              {/* Seats hvis per-seat */}
              {m.pricingModel === "per_seat" && (
                <div>
                  <div className="kicker mb-1.5">Antal behandlere</div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSeats(Math.max(1, seats - 1))} className="grid h-9 w-9 place-items-center rounded-[8px] border border-line-2 text-[14px]">−</button>
                    <span className="mono w-10 text-center text-[18px] font-semibold">{seats}</span>
                    <button onClick={() => setSeats(seats + 1)} className="grid h-9 w-9 place-items-center rounded-[8px] border border-line-2 text-[14px]">+</button>
                    <span className="ml-2 text-[12px] text-muted">{m.pricePerSeat} kr · behandler · md</span>
                  </div>
                </div>
              )}

              {/* Modul-specifik konfig */}
              {m.agentRole && (
                <div>
                  <div className="kicker mb-1.5">Hvordan skal {m.agentRole} håndtere eskalation?</div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      ["always",   `${m.agentRole} kalder altid mig ved tvivl`, "Anbefalet for nye agenter"],
                      ["business",  "Kun i åbningstider", "Bjørn dækker resten via Slack"],
                      ["never",     "Aldrig — fuld autonomi", "Kun for veletablerede agenter"],
                    ].map(([k, label, hint]) => (
                      <label key={k as string} className="flex items-start gap-2.5 rounded-[8px] border border-line bg-paper p-2.5 cursor-pointer">
                        <input type="radio" name="escal" defaultChecked={k === "always"} className="mt-1" />
                        <div>
                          <div className="text-[12.5px] font-medium">{label}</div>
                          <div className="text-[10.5px] text-muted">{hint}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Compliance-modul specifik */}
              {m.category === "compliance" && (
                <div>
                  <div className="kicker mb-1.5">Compliance-region</div>
                  <select className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[13px] outline-none focus:border-ink">
                    <option>Danmark (DK) · Datatilsynet · GDPR Art. 9</option>
                    <option disabled>Norge (NO) · kommer 2026 Q3</option>
                    <option disabled>Sverige (SE) · kommer 2026 Q4</option>
                  </select>
                </div>
              )}

              {/* AI-modul specifik */}
              {m.category === "ai" && (
                <div className="rounded-[10px] border border-line bg-paper-2/60 p-3.5">
                  <div className="kicker mb-1.5">EU-LLM-konfiguration</div>
                  <div className="flex flex-col gap-1.5 text-[11.5px]">
                    {[
                      ["Model", "Mistral Large 3 · EU-hosted"],
                      ["AI-træning på dine data", "Slået FRA · default"],
                      ["Data-residency", "EU · Frankfurt"],
                      ["Audit-log", "Alt agent-output logges + er patient-synligt"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-t border-line py-1.5 first:border-t-0 first:pt-0">
                        <span className="text-muted">{k}</span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={prev} className="btn btn-ghost">← Tilbage</button>
              <button onClick={next} className="btn btn-primary">Fortsæt →</button>
            </div>
          </section>
        )}

        {/* Step 4 — Pris */}
        {step === 4 && (
          <section className="rise card p-7">
            <h2 className="display text-[20px] font-semibold">Pris-oversigt</h2>

            <div className="mt-5 overflow-hidden rounded-[12px] border border-line">
              <div className="border-b border-line bg-paper-2/40 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium">{m.name}</div>
                  <div className="mono text-[14px] font-semibold">{cost.toLocaleString("da-DK")} kr/md</div>
                </div>
              </div>
              {missingDeps.filter((d) => activatedDeps[d.id] ?? true).map((d) => {
                const c = d.pricingModel === "flat" ? d.priceMonthly : d.pricePerSeat * seats;
                return (
                  <div key={d.id} className="border-b border-line px-5 py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] text-muted">+ {d.shortName}</div>
                      <div className="mono text-[12px] text-muted">{c.toLocaleString("da-DK")} kr/md</div>
                    </div>
                  </div>
                );
              })}
              <div className="bg-paper-2/60 px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold">I alt</span>
                  <span className="display text-[24px] font-semibold">{totalCost.toLocaleString("da-DK")} kr/md</span>
                </div>
                {m.trialDays > 0 && (
                  <div className="mt-1 text-[11.5px] text-signal">
                    Første {m.trialDays} dage er gratis · faktureres ikke før {new Date(Date.now() + m.trialDays * 86400 * 1000).toLocaleDateString("da-DK", { day: "numeric", month: "long" })}
                  </div>
                )}
              </div>
            </div>

            <label className="mt-5 flex items-start gap-2.5 rounded-[10px] border border-line bg-paper p-3.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1"
              />
              <span className="text-[11.5px] text-ink-soft">
                Jeg accepterer at modulet faktureres månedligt efter prøveperioden, og at jeg kan slå det fra når som helst på Min Side.
                Læs <a href="#" className="underline">vilkår</a> og <a href="#" className="underline">DPA</a>.
              </span>
            </label>

            <div className="mt-6 flex justify-between">
              <button onClick={prev} className="btn btn-ghost">← Tilbage</button>
              <button onClick={next} disabled={!acceptedTerms} className="btn btn-primary disabled:opacity-40">
                Aktivér {m.shortName} →
              </button>
            </div>
          </section>
        )}

        {/* Step 5 — Aktiveret */}
        {step === 5 && (
          <section className="rise card p-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-signal/14 text-signal">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
            </div>
            <h2 className="display mt-5 text-[26px] font-semibold">{m.name} er aktiveret</h2>
            <p className="mt-2 text-[13.5px] text-muted">
              {m.trialDays > 0
                ? `Du har ${m.trialDays} dages gratis prøveperiode. Vi sender en venlig påmindelse 3 dage før faktureringen starter.`
                : `Faktureres fra i dag · ${totalCost.toLocaleString("da-DK")} kr/md.`
              }
            </p>

            <div className="mt-6 inline-block rounded-[12px] border border-line bg-card p-5 text-left">
              <div className="kicker mb-2">Næste skridt</div>
              <ul className="flex flex-col gap-1.5 text-[12.5px]">
                {m.agentRole && <li className="flex items-center gap-2"><span className="text-signal">●</span> {m.agentRole} er nu aktiv og klar til at hjælpe</li>}
                <li className="flex items-center gap-2"><span className="text-signal">●</span> Modul tilføjet til din license-matrix</li>
                <li className="flex items-center gap-2"><span className="text-signal">●</span> Audit-log opdateret · Frej har noteret aktiveringen</li>
                <li className="flex items-center gap-2"><span className="text-signal">●</span> Faktura-prognose opdateret · Vega har nye tal</li>
                <li className="flex items-center gap-2"><span className="text-signal">●</span> Setup-tid: {m.setupTimeMin} min · hjælp tilgængelig via chat</li>
              </ul>
            </div>

            <div className="mt-6 flex justify-center gap-2">
              <Link href={`/admin/marketplace`} className="btn btn-ghost">Til marketplace</Link>
              <Link href={`/admin/marketplace/${m.id}`} className="btn btn-primary">Konfigurér nu →</Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
