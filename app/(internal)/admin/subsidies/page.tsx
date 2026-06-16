"use client";

import { useState } from "react";
import Link from "next/link";
import { subsidyRules, SCHEME_LABEL, SCHEME_AUTHORITY, patientProfiles, calculateSubsidies, bestSubsidy, type SubsidyScheme } from "@/lib/subsidies";

const SCHEME_GROUPS: { title: string; schemes: SubsidyScheme[] }[] = [
  { title: "Sygeforsikringen \"danmark\" · privat", schemes: ["danmark_g1", "danmark_g2", "danmark_g5"] },
  { title: "Den offentlige sygesikring", schemes: ["offentlig_g1", "offentlig_g2"] },
  { title: "Kommunale tilskud", schemes: ["helbredstillaeg", "diabetes", "kronisk_p7"] },
  { title: "Private behandlingsforsikringer", schemes: ["privat_forsikring"] },
];

export default function SubsidiesAdmin() {
  const [demoClient, setDemoClient] = useState("per");
  const [demoService, setDemoService] = useState("fod-med");
  const [demoPrice, setDemoPrice] = useState(495);

  const calculated = calculateSubsidies({ serviceId: demoService, servicePriceKr: demoPrice, clientId: demoClient });
  const best = bestSubsidy(calculated);

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Tilskudsordninger</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Danske refusions-ordninger · sygeforsikring, kommunal støtte, private forsikringer · automatisk
            beregning + indberetning ved gennemført behandling.
          </p>
        </div>
        <Link href="/admin/reporting" className="btn btn-primary">Indberetnings-konsol →</Link>
      </div>

      {/* Ordninger pr. gruppe */}
      <div className="mt-6 flex flex-col gap-3">
        {SCHEME_GROUPS.map((g, gi) => (
          <section key={g.title} className="card rise p-5" style={{ animationDelay: `${0.06 + gi * 0.04}s` }}>
            <h2 className="display text-[17px] font-semibold">{g.title}</h2>
            <div className="mt-4 flex flex-col gap-2">
              {g.schemes.map((s) => {
                const auth = SCHEME_AUTHORITY[s];
                const rulesForScheme = subsidyRules.filter((r) => r.scheme === s);
                return (
                  <details key={s} className="rounded-[11px] border border-line bg-paper">
                    <summary className="cursor-pointer list-none px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid h-2 w-2 place-items-center rounded-full bg-signal" />
                        <span className="text-[13px] font-medium flex-1">{SCHEME_LABEL[s]}</span>
                        <span className="mono text-[10.5px] text-faint">{rulesForScheme.length} ydelser</span>
                        <span className="mono text-[10.5px] text-accent">{auth.reportingMethod}</span>
                      </div>
                      <div className="ml-5 mt-1 text-[11px] text-muted">
                        Myndighed: {auth.name}
                      </div>
                    </summary>
                    {rulesForScheme.length > 0 && (
                      <div className="border-t border-line px-4 py-3">
                        <table className="w-full text-[12px]">
                          <thead className="text-faint">
                            <tr><th className="kicker pb-1 text-left font-normal">Ydelse</th><th className="kicker pb-1 text-right font-normal">Tilskud</th><th className="kicker pb-1 text-right font-normal">Loft / krav</th></tr>
                          </thead>
                          <tbody>
                            {rulesForScheme.map((r, i) => (
                              <tr key={i} className="border-t border-line/60">
                                <td className="py-1.5">{r.serviceName}</td>
                                <td className="py-1.5 text-right mono">
                                  {r.amountKr !== undefined ? `${r.amountKr} kr` : `${(r.percentBp! / 100).toFixed(0)}%`}
                                </td>
                                <td className="py-1.5 text-right mono text-[10.5px] text-faint">
                                  {r.maxPerYearKr && `max ${r.maxPerYearKr} kr/år`}
                                  {r.maxSessionsPerYear && `${r.maxSessionsPerYear} sessioner/år`}
                                  {r.minAge && ` · ≥${r.minAge} år`}
                                  {r.requiresReferral && " · henvisning"}
                                  {r.requiresDiagnosisCode && ` · dx ${r.requiresDiagnosisCode.join("/")}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </details>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Live beregnings-eksempel */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center gap-2">
          <h2 className="display text-[17px] font-semibold">Live tilskuds-beregning</h2>
          <span className="chip mono !text-[10px] text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
            samme motor som booking-flow
          </span>
        </div>
        <p className="mt-2 text-[12.5px] text-muted">
          Prøv beregneren — vælg klient og ydelse, og se hvilke ordninger der gælder.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="kicker mb-1.5">Klient</div>
            <select value={demoClient} onChange={(e) => setDemoClient(e.target.value)} className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px] outline-none focus:border-ink">
              {Object.entries(patientProfiles).map(([id, p]) => (
                <option key={id} value={id}>{id} · {p.age} år · {p.schemes.length} ordninger</option>
              ))}
            </select>
          </div>
          <div>
            <div className="kicker mb-1.5">Ydelse</div>
            <select value={demoService} onChange={(e) => setDemoService(e.target.value)} className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px] outline-none focus:border-ink">
              <option value="fod-med">Medicinsk fodpleje</option>
              <option value="fod-lux">Luksus fodpleje</option>
              <option value="fod-scan">Fod-scan · Physical AI</option>
            </select>
          </div>
          <div>
            <div className="kicker mb-1.5">Pris (kr)</div>
            <input
              type="number"
              value={demoPrice}
              onChange={(e) => setDemoPrice(+e.target.value)}
              className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 mono text-[13px] outline-none focus:border-ink"
            />
          </div>
        </div>

        {best && (
          <div className="mt-5 rounded-[12px] border border-signal/30 bg-signal/[0.06] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="kicker !text-signal">Bedste tilskud · anbefales</div>
                <div className="mt-1 text-[15px] font-semibold">{best.schemeLabel}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">Indberettes til {best.authority} via {best.reportingMethod}</div>
              </div>
              <div className="text-right">
                <div className="display text-[28px] font-semibold leading-none text-signal">−{best.subsidyKr} kr</div>
                <div className="mt-1 mono text-[10.5px] text-muted">patient betaler {demoPrice - best.subsidyKr} kr</div>
              </div>
            </div>
          </div>
        )}

        {calculated.length === 0 ? (
          <div className="mt-3 rounded-[10px] border border-line bg-paper-2/40 p-3 text-center text-[12.5px] text-muted">
            Patienten er ikke i nogen af de ordninger der gælder for denne ydelse.
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-1.5">
            {calculated.map((c, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-[10px] border border-line bg-paper px-3 py-2.5"
                style={c.eligible && c === best ? { borderColor: "color-mix(in srgb, var(--color-signal) 40%, transparent)" } : {}}
              >
                <div>
                  <div className="text-[12.5px] font-medium">{c.schemeLabel}</div>
                  <div className="mt-0.5 text-[10.5px] text-faint">
                    {c.authority} · {c.reportingMethod}
                    {c.reason && <span className="text-clay"> · {c.reason}</span>}
                  </div>
                </div>
                {c.remainingThisYearKr !== undefined && (
                  <span className="mono text-[10.5px] text-faint">{c.remainingThisYearKr} kr tilbage i år</span>
                )}
                <span className={`mono text-[13px] font-semibold ${c.eligible ? "text-signal" : "text-faint line-through"}`}>
                  −{c.subsidyKr} kr
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
