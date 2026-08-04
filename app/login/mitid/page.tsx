"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CprMatch } from "@/components/CprMatch";

// MitID OIDC stub — efterligner det reelle flow gennem Signaturgruppen-broker
// I prod: redirect til https://broker.signaturgruppen.dk/op/connect/authorize
// scope=openid+nemlogin (Erhverv) eller scope=openid+mitid (privat)

type Phase = "initiating" | "broker" | "app-confirm" | "cpr-match" | "success";

export default function MitIDFlowPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <MitIDFlow />
    </Suspense>
  );
}

function MitIDFlow() {
  const r = useRouter();
  const sp = useSearchParams();
  const isPatient = sp.get("mode") === "patient";
  const [phase, setPhase] = useState<Phase>("initiating");
  const [code, setCode] = useState("4-2-8");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("broker"), 800);
    const t2 = setTimeout(() => setPhase("app-confirm"), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const state = sp.get("state");

  const finishOidc = () => {
    if (state) {
      window.location.href = `/api/auth/mitid/callback?code=mock_ok&state=${encodeURIComponent(state)}`;
      return;
    }
    // Legacy direct visit without start() state
    if (isPatient) {
      setPhase("cpr-match");
    } else {
      setPhase("success");
      setTimeout(() => r.push("/dashboard"), 2200);
    }
  };

  const confirm = () => {
    if (isPatient && !state) {
      setPhase("cpr-match");
      return;
    }
    finishOidc();
  };

  const onCprMatched = () => {
    if (state) {
      finishOidc();
      return;
    }
    setPhase("success");
    setTimeout(() => r.push("/t/bypilar/portal"), 2200);
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[440px] px-6 py-10 lg:py-16">
        {phase === "initiating" && (
          <div className="text-center">
            <div className="mx-auto mt-10 grid h-14 w-14 place-items-center rounded-full border-2 border-accent">
              <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--color-accent)" }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </div>
            <p className="mt-6 text-[13px] text-muted">Initialiserer MitID OIDC-flow…</p>
            <p className="mt-1 mono text-[10px] text-faint">redirect til broker.signaturgruppen.dk</p>
          </div>
        )}

        {phase === "broker" && (
          <>
            <div className="mt-6 flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-[6px] bg-[#0061af] text-white font-bold">
                M
              </div>
              <div className="leading-tight">
                <div className="display text-[15px] font-semibold">MitID</div>
                <div className="kicker !text-[9px]">broker.signaturgruppen.dk</div>
              </div>
            </div>
            <div className="mt-7 rounded-[12px] border border-line bg-card p-5">
              <div className="kicker !text-[9px]">PraxisOS ApS · CVR 99887766</div>
              <h2 className="display mt-1.5 text-[18px] font-semibold leading-tight">Log ind med MitID</h2>
              <p className="mt-2 text-[12.5px] text-muted">
                Du bliver bedt om at bekræfte din identitet i MitID-appen.
              </p>

              <div className="mt-5 flex flex-col gap-2 text-[11px]">
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="text-muted">Service</span>
                  <span>PraxisOS Clinical OS</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="text-muted">Sikkerhedsniveau (NSIS)</span>
                  <span>Substantial</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="text-muted">Dele med PraxisOS</span>
                  <span>Navn · CPR · alder</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="text-muted">Cookie</span>
                  <span>Sessions-cookie · 8t</span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-1 rounded-[8px] border border-amber/40 bg-amber/[0.06] p-2 text-[10.5px] text-ink-soft">
                <span>⏱</span>
                <span>Igangsætter session… vent på notifikation i din MitID-app</span>
              </div>
            </div>
            <p className="mt-4 text-center text-[10.5px] text-faint">prototype — næste skærm efter 1 sekund</p>
          </>
        )}

        {phase === "app-confirm" && (
          <>
            <div className="mt-6 flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-[6px] bg-[#0061af] text-white font-bold">M</div>
              <div className="leading-tight">
                <div className="display text-[15px] font-semibold">MitID-app</div>
                <div className="kicker !text-[9px]">åbn din app på telefonen</div>
              </div>
            </div>

            <div className="mt-7 overflow-hidden rounded-[16px] border-2 border-ink bg-card">
              <div className="bg-[#0061af] px-5 py-4 text-white">
                <div className="text-[11px] opacity-70 uppercase tracking-wider">Verificér</div>
                <div className="mt-1 text-[15px] font-semibold">PraxisOS ApS</div>
              </div>
              <div className="px-5 py-6 text-center">
                <p className="text-[12px] text-muted">Bekræft koden i din MitID-app er identisk med:</p>
                <div className="mt-4 mono text-[42px] font-bold tracking-[0.15em]">{code}</div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button className="rounded-[10px] border border-line-2 px-4 py-2.5 text-[13px]">Annullér</button>
                  <button onClick={confirm} className="rounded-[10px] bg-[#0061af] px-4 py-2.5 text-[13px] font-medium text-white">
                    Bekræft i app
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 mono text-center text-[10px] text-faint">
              NSIS Substantial · session-id 0x7af2…91c · single-use
            </div>
            <Link href="/login" className="mt-4 block text-center text-[12px] text-clay hover:underline">
              Annullér og gå tilbage
            </Link>
          </>
        )}

        {phase === "cpr-match" && (
          <>
            <div className="mt-6 flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-[6px] bg-ink text-paper">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>
              </div>
              <div className="leading-tight">
                <div className="display text-[15px] font-semibold">CPR Match</div>
                <div className="kicker !text-[9px]">obligatorisk for private SaaS-platforme</div>
              </div>
            </div>
            <div className="mt-7">
              <CprMatch
                mitidName="Pilar Mortensen"
                mitidBirthdate="1985-04-12"
                onMatch={onCprMatched}
              />
            </div>
            <p className="mt-4 text-center text-[10.5px] text-faint">
              prototype — taster du <span className="mono">120485-xxxx</span> matcher det
            </p>
          </>
        )}

        {phase === "success" && (
          <div className="text-center">
            <div className="mx-auto mt-10 grid h-14 w-14 place-items-center rounded-full bg-signal/14 text-signal">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
            </div>
            <h1 className="display mt-5 text-[22px] font-semibold">Verificeret med MitID</h1>
            <p className="mt-2 text-[13px] text-muted">Du sendes til PraxisOS…</p>
            <div className="mt-6 inline-block rounded-[8px] border border-line bg-card p-3 text-left text-[10.5px] mono">
              <div className="text-faint">id_token claims:</div>
              <div>sub: pid:9208-2002-2-123456789</div>
              <div>name: "Pilar Mortensen"</div>
              <div>cpr: "********-xxxx"</div>
              <div>nsis_level: "substantial"</div>
              <div>iss: "broker.signaturgruppen.dk"</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
