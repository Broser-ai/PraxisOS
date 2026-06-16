"use client";

import type { Dispatch, SetStateAction } from "react";

export type SubsidyOption = {
  scheme: string;
  schemeLabel: string;
  subsidyKr: number;
  eligible: boolean;
  reason?: string;
  authority: string;
};

type Props = {
  subsidies: SubsidyOption[];
  selectedScheme: string | null;
  setSelectedScheme: Dispatch<SetStateAction<string | null>>;
  clientKnown: boolean;
  clientName?: string;
};

export function SubsidyBanner({ subsidies, selectedScheme, setSelectedScheme, clientKnown, clientName }: Props) {
  const eligible = subsidies.filter((s) => s.eligible);
  const ineligible = subsidies.filter((s) => !s.eligible);

  if (!clientKnown) {
    return (
      <div className="mt-4 rounded-[10px] border border-line-2 bg-paper-2/50 p-3 text-[12px] text-muted">
        Indtast e-mail for at se om du har ret til tilskud · vi tjekker automatisk dine ordninger.
      </div>
    );
  }

  if (subsidies.length === 0) {
    return (
      <div className="mt-4 rounded-[10px] border border-line-2 bg-paper-2/50 p-3 text-[12px] text-muted">
        <b>Hej {clientName?.split(" ")[0]}!</b> Du er ikke registreret i nogen tilskuds-ordninger for denne ydelse.
        Tilføj fx Sygesikringen "danmark"-medlemsnummer på Min Side for at få tilskud næste gang.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-[12px] border border-signal/30 bg-signal/[0.06]">
      <div className="border-b border-signal/20 px-4 py-3">
        <div className="kicker !text-signal">Du har ret til tilskud</div>
        <div className="mt-1 text-[13px] text-ink-soft">
          {eligible.length === 0
            ? "Du er medlem af relevante ordninger, men opfylder ikke kravene denne gang."
            : <>Vi har fundet <b>{eligible.length} {eligible.length === 1 ? "ordning" : "ordninger"}</b> der dækker behandlingen. Vælg den du vil bruge:</>}
        </div>
      </div>
      <div className="flex flex-col">
        {eligible.map((s) => (
          <label
            key={s.scheme}
            className="flex cursor-pointer items-center gap-3 border-t border-signal/15 px-4 py-2.5 first:border-t-0 transition-colors hover:bg-signal/[0.04]"
          >
            <input
              type="radio"
              name="subsidy"
              checked={selectedScheme === s.scheme}
              onChange={() => setSelectedScheme(s.scheme)}
              className="accent-current"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{s.schemeLabel}</div>
              <div className="text-[10.5px] text-muted">indberettes automatisk til {s.authority}</div>
            </div>
            <div className="mono text-[14px] font-semibold text-signal">−{s.subsidyKr} kr</div>
          </label>
        ))}
        {eligible.length > 0 && (
          <label className="flex cursor-pointer items-center gap-3 border-t border-signal/15 px-4 py-2.5 transition-colors hover:bg-signal/[0.04]">
            <input
              type="radio"
              name="subsidy"
              checked={selectedScheme === null}
              onChange={() => setSelectedScheme(null)}
            />
            <span className="flex-1 text-[12.5px] text-muted">Brug ikke tilskud denne gang</span>
          </label>
        )}
        {ineligible.length > 0 && (
          <details className="border-t border-signal/15 bg-paper-2/30">
            <summary className="cursor-pointer px-4 py-2 text-[11px] text-faint">{ineligible.length} ordning(er) kunne ikke bruges</summary>
            {ineligible.map((s) => (
              <div key={s.scheme} className="border-t border-line/40 px-4 py-1.5 text-[10.5px] text-faint">
                <span className="font-medium">{s.schemeLabel}</span>: <span className="text-clay">{s.reason}</span>
              </div>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}
