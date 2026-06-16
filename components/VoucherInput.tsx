"use client";

import { useState } from "react";

export type VoucherSummary = {
  code: string;
  kind: "clip" | "gift";
  sessionsRemaining?: number;
  balanceKr?: number;
  serviceName?: string;
  expiresAt: string;
};

type Props = {
  tenant: string;
  serviceId: string;
  appliedVoucher: VoucherSummary | null;
  setAppliedVoucher: (v: VoucherSummary | null) => void;
  suggestedVouchers?: VoucherSummary[]; // hvis brugeren er kendt klient
};

export function VoucherInput({ tenant, serviceId, appliedVoucher, setAppliedVoucher, suggestedVouchers = [] }: Props) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(suggestedVouchers.length > 0);

  const apply = async (codeToTry?: string) => {
    const c = (codeToTry ?? code).trim().toUpperCase();
    if (!c) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/${tenant}/voucher?code=${encodeURIComponent(c)}&service=${serviceId}`);
      const data = await res.json();
      if (!data.valid) {
        setError(data.error || "Voucher er ikke gyldig");
      } else {
        setAppliedVoucher(data.voucher);
        setCode("");
      }
    } catch {
      setError("Kunne ikke validere koden lige nu");
    }
    setChecking(false);
  };

  if (appliedVoucher) {
    return (
      <div className="rounded-[12px] border border-signal/40 bg-signal/[0.06] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-signal/14 text-signal">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
              </span>
              <span className="text-[12.5px] font-semibold text-signal">
                {appliedVoucher.kind === "clip" ? "Klippekort aktiveret" : "Gavekort aktiveret"}
              </span>
            </div>
            <div className="mono mt-1.5 text-[13px] font-semibold">{appliedVoucher.code}</div>
            <div className="mt-0.5 text-[11.5px] text-muted">
              {appliedVoucher.kind === "clip"
                ? `${appliedVoucher.sessionsRemaining} sessioner tilbage · ${appliedVoucher.serviceName}`
                : `${appliedVoucher.balanceKr?.toFixed(2)} kr tilbage`
              }
            </div>
          </div>
          <button
            onClick={() => setAppliedVoucher(null)}
            className="grid h-7 w-7 place-items-center rounded-[8px] text-muted hover:bg-paper-2"
          >×</button>
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-[10px] border border-dashed border-line-2 px-3 py-2.5 text-left text-[12.5px] text-muted hover:bg-paper-2"
      >
        + Brug klippekort eller gavekort
      </button>
    );
  }

  return (
    <div className="rounded-[12px] border border-line-2 bg-paper p-4">
      <div className="flex items-center justify-between">
        <div className="kicker">Klippekort eller gavekort</div>
        <button onClick={() => setExpanded(false)} className="text-[11px] text-faint hover:text-ink">skjul</button>
      </div>

      {suggestedVouchers.length > 0 && (
        <>
          <div className="mt-3 text-[11.5px] text-muted">Du har {suggestedVouchers.length === 1 ? "denne voucher" : `${suggestedVouchers.length} vouchers`} der kan bruges:</div>
          <div className="mt-2 flex flex-col gap-1.5">
            {suggestedVouchers.map((v) => (
              <button
                key={v.code}
                onClick={() => apply(v.code)}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-[8px] border border-line bg-card px-3 py-2 text-left transition-colors hover:bg-paper-2"
              >
                <div>
                  <div className="mono text-[12px] font-semibold">{v.code}</div>
                  <div className="text-[10.5px] text-faint">{v.kind === "clip" ? v.serviceName : "Gavekort"}</div>
                </div>
                <span className="mono text-[11px]">
                  {v.kind === "clip" ? `${v.sessionsRemaining} stk.` : `${v.balanceKr?.toFixed(0)} kr`}
                </span>
                <span className="rounded-[6px] bg-ink px-2 py-0.5 text-[10px] font-medium text-paper">Brug</span>
              </button>
            ))}
          </div>
          <div className="my-3 border-t border-line"></div>
          <div className="text-[11px] text-faint">Eller indtast en kode manuelt:</div>
        </>
      )}

      <div className="mt-2 flex gap-2">
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
          placeholder="CLIP-XXXX-XXXX eller GIFT-XXXX-XXXX"
          className="flex-1 rounded-[8px] border border-line-2 bg-card px-3 py-2 mono text-[12.5px] uppercase outline-none focus:border-ink"
        />
        <button
          onClick={() => apply()}
          disabled={checking || !code}
          className="rounded-[8px] bg-ink px-3 py-2 text-[12px] font-medium text-paper disabled:opacity-40"
        >
          {checking ? "..." : "Anvend"}
        </button>
      </div>
      {error && <div className="mt-2 text-[11px] text-clay">⚠ {error}</div>}
    </div>
  );
}
