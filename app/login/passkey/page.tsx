"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Phase = "ready" | "browser" | "biometric" | "success";

export default function PasskeyLogin() {
  const r = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");

  const start = () => {
    setPhase("browser");
    setTimeout(() => setPhase("biometric"), 800);
    setTimeout(() => setPhase("success"), 2400);
    setTimeout(() => r.push("/review"), 3800);
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[440px] px-6 py-10 lg:py-16">
        <Link href="/login" className="kicker hover:underline">← Tilbage til login</Link>

        {phase === "ready" && (
          <>
            <div className="mt-10 grid h-16 w-16 place-items-center rounded-full bg-accent/14 text-accent">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
                <circle cx="12" cy="16" r="1.5" />
              </svg>
            </div>

            <h1 className="display mt-6 text-[26px] font-semibold leading-tight">Log ind med passkey</h1>
            <p className="mt-2 text-[13px] text-muted">
              Phishing-resistant, password-fri authentication. Brug Touch ID, Face ID, Windows Hello eller en YubiKey.
            </p>

            <button
              onClick={start}
              className="mt-7 w-full rounded-[10px] bg-ink py-3 text-[13px] font-medium text-paper"
            >
              Brug passkey →
            </button>

            <div className="mt-6 rounded-[10px] border border-line bg-card p-3.5">
              <div className="kicker mb-2 !text-signal">CISA · phishing-resistant</div>
              <ul className="space-y-1.5 text-[11.5px] text-ink-soft">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-signal">✓</span>
                  Origin-bound: virker kun på det rigtige praxis-domæne
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-signal">✓</span>
                  Asymmetrisk kryptering: dit private nøgle forlader aldrig enheden
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-signal">✓</span>
                  Ingen kode at indtaste — ingen at lure af
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-signal">✓</span>
                  WebAuthn-standard · understøttet på iOS 16+, Android 9+, macOS 13+, Windows 11
                </li>
              </ul>
            </div>

            <div className="mt-4 rounded-[10px] border border-line bg-paper-2/60 p-3 text-[11px] text-muted">
              <b>Klinisk personale med skrive-adgang</b> til journal/AR-scans skal bruge passkey eller YubiKey
              (NSIS-niveau High). Patienter kan vælge TOTP eller MitID. Påkrævet af GDPR Art. 32 + Datatilsynets
              vejledning for sundhedsdata.
            </div>

            <div className="mt-6 flex flex-col gap-1 text-center text-[11.5px]">
              <span className="text-faint">Andre metoder:</span>
              <Link href="/login" className="text-accent hover:underline">E-mail + adgangskode + TOTP</Link>
              <Link href="/login/mitid" className="text-accent hover:underline">MitID Erhverv</Link>
            </div>
          </>
        )}

        {phase === "browser" && (
          <div className="text-center">
            <div className="mx-auto mt-10 grid h-14 w-14 place-items-center rounded-full border-2 border-accent">
              <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--color-accent)" }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </div>
            <h2 className="display mt-6 text-[20px] font-semibold">Anmoder browseren</h2>
            <p className="mt-2 text-[12.5px] text-muted">
              Bekræft i din browser at du vil logge ind på <b>praxis.app</b>
            </p>
            <div className="mt-4 mono text-[10.5px] text-faint">
              <code>navigator.credentials.get({"{"} publicKey: {"{...}"} {"}"})</code>
            </div>
          </div>
        )}

        {phase === "biometric" && (
          <>
            <div className="mx-auto mt-10 grid h-20 w-20 place-items-center rounded-full bg-ink text-paper">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 11a2 2 0 100-4 2 2 0 000 4z" />
                <path d="M19 12a7 7 0 11-14 0 7 7 0 0114 0z" opacity="0.5" />
                <path d="M5 7c2-2 4.5-3 7-3s5 1 7 3M5 17c2 2 4.5 3 7 3s5-1 7-3" />
              </svg>
            </div>
            <h2 className="display mt-6 text-center text-[20px] font-semibold">Tryk på fingeraftryks-sensoren</h2>
            <p className="mt-2 text-center text-[12.5px] text-muted">
              Touch ID / Face ID / Windows Hello…
            </p>
            <div className="mt-6 inline-block rounded-[8px] border border-line bg-card p-3 text-left mono text-[10.5px]">
              <div className="text-faint">credential request:</div>
              <div>rpId: <span className="text-ink">praxis.app</span></div>
              <div>challenge: <span className="text-ink">a3f7…b29c</span></div>
              <div>userVerification: <span className="text-ink">required</span></div>
              <div>timeout: <span className="text-ink">60000</span></div>
            </div>
          </>
        )}

        {phase === "success" && (
          <div className="text-center">
            <div className="mx-auto mt-10 grid h-14 w-14 place-items-center rounded-full bg-signal/14 text-signal">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
            </div>
            <h1 className="display mt-5 text-[22px] font-semibold">Verificeret</h1>
            <p className="mt-2 text-[13px] text-muted">Passkey godkendt · du sendes til PraxisOS…</p>
            <div className="mt-6 inline-block rounded-[8px] border border-line bg-card p-3 text-left mono text-[10.5px]">
              <div className="text-faint">attestation verified:</div>
              <div>aaguid: <span className="text-ink">Apple Touch ID</span></div>
              <div>aal: <span className="text-ink">AAL3 · phishing-resistant</span></div>
              <div>nsis_equivalent: <span className="text-ink">High</span></div>
              <div>session_age: <span className="text-ink">8h · single-device</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
