"use client";

import { useState } from "react";

export type CvrResult = {
  cvr: string;
  name: string;
  vat: boolean;
  address: string;
  zipcode: string;
  city: string;
  phone?: string;
  email?: string;
  industryCode: string;
  industryDesc: string;
  companyDesc: string;
  startdate: string;
  employees?: string;
  owners?: { name: string; type: string }[];
  productionUnits?: { pno: string; name: string; address: string }[];
};

type Props = {
  onResult: (r: CvrResult) => void;
  initialCvr?: string;
};

export function CvrLookup({ onResult, initialCvr = "" }: Props) {
  const [cvr, setCvr] = useState(initialCvr);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CvrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    const clean = cvr.replace(/\D/g, "");
    if (clean.length !== 8) {
      setError("CVR-nummer skal være 8 cifre");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cvr/lookup?cvr=${clean}`);
      const data = await res.json();
      if (data.result) {
        setResult(data.result);
        onResult(data.result);
      } else if (data.fallback) {
        setError("CVR-API midlertidig utilgængelig · brug fallback eller prøv igen");
        setResult(data.fallback);
      } else {
        setError("CVR ikke fundet · tjek nummeret");
      }
    } catch {
      setError("Netværksfejl · kunne ikke nå CVR-API");
    }
    setLoading(false);
  };

  return (
    <div className="rounded-[12px] border border-line-2 bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-amber/14 text-amber font-bold">
          CVR
        </span>
        <div className="flex-1">
          <div className="text-[13px] font-semibold">CVR-opslag · Erhvervsstyrelsen</div>
          <div className="text-[10.5px] text-faint">Auto-udfyld firma · adresse · branche</div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={cvr}
          onChange={(e) => { setCvr(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(null); }}
          placeholder="8-cifret CVR"
          maxLength={8}
          className="flex-1 rounded-[10px] border border-line-2 bg-paper px-3 py-2 mono text-[14px] outline-none focus:border-ink"
        />
        <button
          onClick={lookup}
          disabled={loading || cvr.length !== 8}
          className="rounded-[10px] bg-ink px-4 py-2 text-[12.5px] font-medium text-paper disabled:opacity-40"
        >
          {loading ? "…" : "Slå op"}
        </button>
      </div>

      {error && <div className="mt-2 text-[11px] text-clay">⚠ {error}</div>}

      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-faint">
        <span className="h-1 w-1 rounded-full bg-signal" />
        Data fra <code className="mono">cvrapi.dk</code> · Erhvervsstyrelsens åbne register
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <div className="text-[10.5px] text-faint">Prøv:</div>
        <button onClick={() => setCvr("43947079")} className="text-[10.5px] text-accent hover:underline">43947079 (by Pilar)</button>
        <button onClick={() => setCvr("12345678")} className="text-[10.5px] text-accent hover:underline">12345678 (Nordlys)</button>
      </div>

      {result && (
        <div className="mt-4 overflow-hidden rounded-[10px] border border-signal/30 bg-signal/[0.04]">
          <div className="border-b border-signal/20 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-signal/14 text-signal text-[9px]">✓</span>
              <span className="text-[13px] font-semibold">{result.name}</span>
              <span className="ml-auto mono text-[10.5px] text-faint">CVR {result.cvr}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">{result.address}, {result.zipcode} {result.city}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-[11px]">
            <Row label="Selskabsform">{result.companyDesc}</Row>
            <Row label="Branche">{result.industryDesc}</Row>
            <Row label="Branchekode">{result.industryCode}</Row>
            <Row label="Stiftet">{result.startdate ? new Date(result.startdate).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" }) : "—"}</Row>
            {result.employees && <Row label="Medarbejdere">{result.employees}</Row>}
            <Row label="Moms-registreret">{result.vat ? "Ja" : "Nej"}</Row>
            {result.phone && <Row label="Telefon">{result.phone}</Row>}
            {result.email && <Row label="E-mail"><a href={`mailto:${result.email}`} className="text-accent hover:underline">{result.email}</a></Row>}
          </div>
          {result.owners && result.owners.length > 0 && (
            <div className="border-t border-signal/20 px-4 py-3">
              <div className="kicker mb-1.5">Ejere / ledelse</div>
              <div className="flex flex-col gap-1">
                {result.owners.map((o, i) => (
                  <div key={i} className="flex items-center justify-between text-[11.5px]">
                    <span className="font-medium">{o.name}</span>
                    <span className="text-faint">{o.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.productionUnits && result.productionUnits.length > 0 && (
            <div className="border-t border-signal/20 px-4 py-3">
              <div className="kicker mb-1.5">Produktionsenheder ({result.productionUnits.length})</div>
              {result.productionUnits.map((p) => (
                <div key={p.pno} className="flex items-center justify-between text-[11px] py-0.5">
                  <span>{p.name}</span>
                  <span className="mono text-[10px] text-faint">P-nr {p.pno}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kicker !text-[8.5px]">{label}</div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}
