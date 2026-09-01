"use client";

import { useState } from "react";

// CPR Match — påkrævet når klinikken ikke kan hente CPR direkte fra MitID.
// MitID giver os navn + fødselsdato. Patient taster CPR selv.
// Vi verificerer at CPR-formatet er gyldigt og at fødselsdato matcher de første 6 cifre.

type Props = {
  mitidName: string;
  mitidBirthdate: string; // YYYY-MM-DD
  onMatch: (cprHash: string) => void;
};

export function CprMatch({ mitidName, mitidBirthdate, onMatch }: Props) {
  const [cpr, setCpr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const formatCpr = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    return d.length > 6 ? `${d.slice(0, 6)}-${d.slice(6)}` : d;
  };

  const verify = () => {
    const raw = cpr.replace(/\D/g, "");
    if (raw.length !== 10) { setError("CPR skal være 10 cifre"); return; }

    // Match fødselsdato mod MitID-claim
    const [yy, mm, dd] = [raw.slice(4, 6), raw.slice(2, 4), raw.slice(0, 2)];
    const [bYear, bMonth, bDay] = mitidBirthdate.split("-");
    if (dd !== bDay || mm !== bMonth || !bYear.endsWith(yy)) {
      setError("CPR matcher ikke MitID-identitet · prøv igen");
      return;
    }

    setError(null);
    setVerified(true);
    // Genererer en pseudo-hash til prototype
    const hash = "cpr_" + btoa(raw).replace(/[+/=]/g, "").slice(0, 16);
    setTimeout(() => onMatch(hash), 700);
  };

  if (verified) {
    return (
      <div className="rounded-[12px] border border-signal/40 bg-signal/[0.06] p-5 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-signal/14 text-signal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
        </div>
        <div className="mt-3 text-[14px] font-semibold">CPR verificeret</div>
        <div className="mt-1 text-[11.5px] text-muted">Identitet matcher MitID · vi opretter din profil…</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-card">
      <div className="border-b border-line bg-paper-2/40 px-4 py-3">
        <div className="kicker !text-[9px]">MitID-verificeret identitet</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/14 text-accent">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
          </span>
          <div className="text-[13px] font-medium">{mitidName}</div>
        </div>
        <div className="mt-1 mono text-[10.5px] text-faint">Fødselsdato fra MitID · ********-xxxx</div>
      </div>

      <div className="p-4">
        <div className="kicker mb-1.5">Bekræft dit CPR-nummer</div>
        <input
          autoFocus
          value={cpr}
          onChange={(e) => { setCpr(formatCpr(e.target.value)); setError(null); }}
          placeholder="ddmmåå-xxxx"
          className="w-full rounded-[10px] border border-line-2 bg-paper px-3 py-2.5 mono text-[16px] outline-none focus:border-ink"
          maxLength={11}
        />
        {error && <div className="mt-2 text-[11.5px] text-clay">⚠ {error}</div>}

        <button
          onClick={verify}
          disabled={cpr.replace(/\D/g, "").length !== 10}
          className="mt-3 w-full rounded-[10px] bg-ink py-2.5 text-[13px] font-medium text-paper disabled:opacity-40"
        >
          Verificér →
        </button>

        <p className="mt-3 text-[10.5px] text-faint">
          <b>Hvorfor taster jeg CPR selv?</b> Klinikken kan ikke hente dit CPR direkte fra MitID.
          Vi tjekker at det matcher din MitID-identitet og opbevarer det krypteret (hash).
        </p>
      </div>
    </div>
  );
}
