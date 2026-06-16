"use client";

// DAWA-integration · Danmarks Adressers Web API
// https://dawa.aws.dk / api.dataforsyningen.dk
//
// Vi proxyer kald gennem /api/dawa/* for at undgå CORS-issues + tilføje caching.
// Endpoint: GET https://api.dataforsyningen.dk/autocomplete?q=...&type=adresse

import { useState, useEffect, useRef } from "react";

export type DanishAddress = {
  vejnavn: string;
  husnr: string;
  etage?: string;
  doer?: string;
  postnr: string;
  postnrnavn: string;
  fuldText: string;     // "Hovedgaden 4, 8000 Aarhus C"
  kommunekode?: string;
  vejkode?: string;
  betegnelse?: string;  // unik DAWA-id
};

type Suggestion = {
  tekst: string;
  forslagstekst: string;
  caretpos: number;
  type: "adresse" | "vejnavn" | "postnummer";
  adresse?: DanishAddress;
};

type Props = {
  label?: string;
  value: DanishAddress | null;
  onChange: (a: DanishAddress | null) => void;
  required?: boolean;
};

export function AddressAutocomplete({ label = "Adresse", value, onChange, required }: Props) {
  const [query, setQuery] = useState(value?.fuldText ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search via vores DAWA-proxy
  useEffect(() => {
    if (!focused) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dawa/autocomplete?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, focused]);

  // Luk dropdown ved klik udenfor
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (s: Suggestion) => {
    if (s.type === "adresse" && s.adresse) {
      onChange(s.adresse);
      setQuery(s.adresse.fuldText);
      setOpen(false);
    } else {
      // For vejnavn/postnummer-forslag fortsætter vi søgningen
      setQuery(s.tekst);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div className="kicker mb-1.5">{label}{required && <span className="text-clay"> *</span>}</div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(null); }}
          onFocus={() => { setFocused(true); if (suggestions.length) setOpen(true); }}
          placeholder="Vejnavn husnummer, postnr by"
          className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink pr-9"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          </div>
        )}
        {value && !loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full bg-signal/14 text-signal">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
          </span>
        )}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[10px] border border-line-2 bg-card shadow-lg">
          {suggestions.slice(0, 8).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(s)}
              className="flex w-full items-start gap-3 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-paper-2"
            >
              <span className="mt-0.5 text-[10px] text-faint">
                {s.type === "adresse" ? "📍" : s.type === "vejnavn" ? "🛣️" : "🏘️"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{s.tekst}</div>
                <div className="mono text-[10px] text-faint">
                  {s.type === "adresse" ? "fuld adresse" : s.type === "vejnavn" ? "vej · vælg husnr" : "postnummer"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* DAWA-attribution når der ER suggestions */}
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-faint">
        <span className="h-1 w-1 rounded-full bg-signal" />
        <span>Adresser fra <code className="mono">dawa.aws.dk</code> · Danmarks Adressers Web API</span>
      </div>

      {/* Vist adresse-struktur når valgt */}
      {value && (
        <div className="mt-2 rounded-[8px] border border-line bg-paper p-2.5 mono text-[10.5px]">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-faint">
            <span>Vej</span><span className="text-ink">{value.vejnavn} {value.husnr}{value.etage ? `, ${value.etage}` : ""}{value.doer ? `. ${value.doer}` : ""}</span>
            <span>Postnr</span><span className="text-ink">{value.postnr} {value.postnrnavn}</span>
            {value.kommunekode && <><span>Kommune</span><span className="text-ink">{value.kommunekode}</span></>}
          </div>
        </div>
      )}
    </div>
  );
}
