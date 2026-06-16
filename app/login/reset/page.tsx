"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Step = "email" | "method" | "mitid" | "code" | "newpass" | "done";

export default function PasswordReset() {
  const r = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"mitid" | "code">("mitid");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [strength, setStrength] = useState({ score: 0, label: "Svag", color: "var(--color-clay)" });
  const [breachWarning, setBreachWarning] = useState(false);

  // Password strength check (simulerer HIBP k-anonymity check)
  useEffect(() => {
    if (!newPass) { setStrength({ score: 0, label: "Indtast adgangskode", color: "var(--color-line-2)" }); return; }
    let score = 0;
    if (newPass.length >= 8) score++;
    if (newPass.length >= 12) score++;
    if (newPass.length >= 16) score++;
    if (/[A-Z]/.test(newPass) && /[a-z]/.test(newPass)) score++;
    if (/\d/.test(newPass)) score++;
    if (/[^A-Za-z0-9]/.test(newPass)) score++;
    if (newPass.length >= 20) score++;

    // Almindelige adgangskoder (simulerer HIBP)
    const common = ["password", "123456", "qwerty", "admin", "welcome", "demo1234"];
    const isCommon = common.some((c) => newPass.toLowerCase().includes(c));
    setBreachWarning(isCommon);

    const labels = [
      { min: 0, label: "Meget svag", color: "var(--color-clay)" },
      { min: 2, label: "Svag", color: "var(--color-clay)" },
      { min: 4, label: "Acceptabel", color: "var(--color-amber)" },
      { min: 5, label: "Stærk", color: "var(--color-signal)" },
      { min: 6, label: "Meget stærk", color: "var(--color-signal)" },
    ];
    const matched = labels.reverse().find((l) => score >= l.min) ?? labels[labels.length - 1];
    setStrength({ score, label: matched.label, color: matched.color });
  }, [newPass]);

  const sendCode = () => {
    setStep(method === "mitid" ? "mitid" : "code");
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[440px] px-6 py-10 lg:py-20">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-ink text-paper">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 3v18M3 12h18" opacity="0.35" />
              <circle cx="12" cy="12" r="4.4" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="display text-[17px] font-semibold">PraxisOS</div>
            <div className="kicker !text-[9.5px]">Genaktivér konto</div>
          </div>
        </div>

        {/* Step 1 — email */}
        {step === "email" && (
          <>
            <h1 className="display mt-10 text-[26px] font-semibold leading-tight">Glemt adgangskode?</h1>
            <p className="mt-2 text-[13px] text-muted">Indtast din e-mail. Vi sender en sikker reset-vej.</p>

            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dig@klinik.dk"
              className="mt-6 w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink"
            />

            <button
              onClick={() => setStep("method")}
              disabled={!email || !/.+@.+\..+/.test(email)}
              className="mt-4 w-full rounded-[10px] bg-ink py-2.5 text-[13px] font-medium text-paper disabled:opacity-40"
            >
              Fortsæt →
            </button>

            <Link href="/login" className="mt-4 block text-center text-[12px] text-accent hover:underline">
              ← Tilbage til login
            </Link>
          </>
        )}

        {/* Step 2 — vælg metode */}
        {step === "method" && (
          <>
            <h1 className="display mt-10 text-[26px] font-semibold leading-tight">Sådan får du adgang igen</h1>
            <p className="mt-2 text-[13px] text-muted">Vi anbefaler MitID — det er den sikreste metode.</p>

            <div className="mt-6 flex flex-col gap-2">
              <label
                className="flex cursor-pointer items-start gap-3 rounded-[12px] border p-4 transition-all"
                style={{
                  borderColor: method === "mitid" ? "var(--color-ink)" : "var(--color-line-2)",
                  background: method === "mitid" ? "var(--color-paper-2)" : "var(--color-card)",
                }}
              >
                <input type="radio" checked={method === "mitid"} onChange={() => setMethod("mitid")} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold">MitID-verifikation</span>
                    <span className="chip mono !text-[9px] !border-signal/40 text-signal">anbefalet</span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    Bekræft din identitet med MitID — den sikreste vej. Tager ~10 sekunder.
                  </p>
                </div>
              </label>

              <label
                className="flex cursor-pointer items-start gap-3 rounded-[12px] border p-4 transition-all"
                style={{
                  borderColor: method === "code" ? "var(--color-ink)" : "var(--color-line-2)",
                  background: method === "code" ? "var(--color-paper-2)" : "var(--color-card)",
                }}
              >
                <input type="radio" checked={method === "code"} onChange={() => setMethod("code")} className="mt-1" />
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold">Engangskode på e-mail</div>
                  <p className="mt-1 text-[12px] text-muted">
                    Vi sender en 6-cifret kode til <b>{email}</b>. Kode udløber efter 15 minutter.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => setStep("email")} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]">Tilbage</button>
              <button onClick={sendCode} className="flex-1 rounded-[10px] bg-ink py-2.5 text-[13px] font-medium text-paper">
                {method === "mitid" ? "Start MitID-verifikation →" : "Send engangskode →"}
              </button>
            </div>

            <div className="mt-4 rounded-[8px] border border-line bg-paper-2 p-2.5 text-[10.5px] text-muted">
              <b>SMS er bevidst fravalgt</b> som backup-metode. SMS er ikke en sikker kanal til
              kontogenoprettelse (SIM-swap-angreb). Vi bruger MitID eller e-mail med ny enheds-verifikation.
            </div>
          </>
        )}

        {/* Step 3a — MitID-verifikation (stub) */}
        {step === "mitid" && (
          <>
            <div className="mt-10 grid h-14 w-14 place-items-center rounded-full bg-accent/14 text-accent">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h1 className="display mt-5 text-[22px] font-semibold">Verificér med MitID</h1>
            <p className="mt-2 text-[13px] text-muted">
              Vi har sendt en notifikation til din MitID-app. Bekræft for at fortsætte.
            </p>

            <div className="mt-5 rounded-[12px] border border-line bg-card p-5">
              <div className="kicker !text-[9px]">MitID Broker · Signaturgruppen</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-ink text-paper">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] font-medium">PraxisOS</div>
                  <div className="mono text-[10.5px] text-faint">vil verificere din identitet</div>
                </div>
              </div>
              <div className="mt-4 mono text-[11px] text-muted">
                <div className="flex items-center justify-between border-t border-line py-1.5">
                  <span>NSIS-niveau</span><span className="text-ink">Substantial</span>
                </div>
                <div className="flex items-center justify-between border-t border-line py-1.5">
                  <span>Scopes</span><span className="text-ink">openid · cpr · identity</span>
                </div>
                <div className="flex items-center justify-between border-t border-line py-1.5">
                  <span>Session</span><span className="text-ink">single use · 5 min</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep("newpass")}
              className="mt-5 w-full rounded-[10px] bg-ink py-2.5 text-[13px] font-medium text-paper"
            >
              Jeg har bekræftet — fortsæt
            </button>
            <div className="mt-3 text-center text-[10.5px] text-faint">prototype: tryk for at simulere godkendelse</div>
          </>
        )}

        {/* Step 3b — e-mail-kode */}
        {step === "code" && (
          <>
            <div className="mt-10 grid h-14 w-14 place-items-center rounded-full bg-accent/14 text-accent">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM3 6l9 7 9-7"/></svg>
            </div>
            <h1 className="display mt-5 text-[22px] font-semibold">Indtast koden</h1>
            <p className="mt-2 text-[13px] text-muted">Vi har sendt en 6-cifret kode til <b>{email}</b>.</p>

            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              className="mt-5 w-full rounded-[10px] border border-line-2 bg-card px-3 py-3 mono text-center text-[24px] tracking-[0.4em] outline-none focus:border-ink"
            />

            <button
              onClick={() => setStep("newpass")}
              disabled={code.length !== 6}
              className="mt-4 w-full rounded-[10px] bg-ink py-2.5 text-[13px] font-medium text-paper disabled:opacity-40"
            >
              Verificér →
            </button>
            <div className="mt-3 text-center text-[10.5px] text-faint">prototype: tast hvad som helst (6 cifre)</div>
          </>
        )}

        {/* Step 4 — ny adgangskode */}
        {step === "newpass" && (
          <>
            <h1 className="display mt-10 text-[22px] font-semibold">Vælg ny adgangskode</h1>
            <p className="mt-2 text-[13px] text-muted">Minimum 12 tegn anbefales. Vi tjekker mod kendte breaches.</p>

            <div className="mt-5">
              <div className="kicker mb-1.5">Ny adgangskode</div>
              <input
                type="password"
                autoFocus
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Min. 12 tegn"
                className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink"
              />
              {newPass && (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (strength.score / 7) * 100)}%`, background: strength.color }}
                      />
                    </div>
                    <span className="mono text-[11px]" style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                  {breachWarning && (
                    <div className="mt-2 flex items-start gap-2 rounded-[8px] border border-clay/40 bg-clay/[0.06] p-2 text-[11px] text-clay">
                      <span>⚠</span>
                      <span>Denne adgangskode er fundet i tidligere data-breaches (HIBP-k-anonymity). Vælg en anden.</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-3">
              <div className="kicker mb-1.5">Bekræft</div>
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Skriv adgangskoden igen"
                className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink"
              />
              {confirmPass && confirmPass !== newPass && (
                <div className="mt-1 text-[11px] text-clay">Adgangskoderne matcher ikke</div>
              )}
            </div>

            <button
              onClick={() => setStep("done")}
              disabled={strength.score < 4 || breachWarning || newPass !== confirmPass}
              className="mt-5 w-full rounded-[10px] bg-ink py-2.5 text-[13px] font-medium text-paper disabled:opacity-40"
            >
              Gem ny adgangskode →
            </button>

            <div className="mt-4 rounded-[8px] border border-line bg-paper-2/60 p-2.5 text-[10.5px] text-muted">
              <b>NIST 800-63B:</b> Vi bruger Argon2id-hashing (memory-hard), <b>ingen</b> krav om symbol/cifre eller
              tvungen rotation. Længde slår kompleksitet.
            </div>
          </>
        )}

        {/* Step 5 — done */}
        {step === "done" && (
          <div className="mt-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-signal/14 text-signal">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
            </div>
            <h1 className="display mt-5 text-[22px] font-semibold">Adgangskode ændret</h1>
            <p className="mt-2 text-[13px] text-muted">
              Alle aktive sessioner er blevet logget ud — du skal logge ind igen på alle enheder.
            </p>
            <Link href="/login" className="mt-6 inline-block rounded-[10px] bg-ink px-6 py-2.5 text-[13px] font-medium text-paper">
              Til login →
            </Link>
            <div className="mt-6 rounded-[8px] border border-line bg-paper-2/60 p-3 text-left text-[11px] text-muted">
              <div className="kicker mb-1">Hvad skete der bag kulisserne</div>
              <ul className="space-y-1 ml-3 list-disc">
                <li>Ny adgangskode hashet med Argon2id (m=64MiB, t=3, p=4)</li>
                <li>Alle eksisterende sessioner invalideret</li>
                <li>Notifikation sendt til kontoens primær-email</li>
                <li>Audit-log opdateret: <code className="mono text-[10px]">password_reset · method=mitid</code></li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
