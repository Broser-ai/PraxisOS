"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type TenantPickItem = { slug: string; role: string };

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"creds" | "2fa" | "pick">("creds");
  const [otp, setOtp] = useState("");
  const [tenantPick, setTenantPick] = useState<TenantPickItem[]>([]);
  const [accountPreview, setAccountPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (tenant?: string) => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, tenant }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      if (data.needsTenantPick) {
        setTenantPick(data.tenants);
        setAccountPreview(data.account);
        setStep("pick");
        return;
      }
      // Simulate 2FA for accounts that have it (Pilar, Sofie)
      if (email.startsWith("pilar") || email.startsWith("sofie")) {
        setStep("2fa");
        return;
      }
      r.push("/review");
    } else {
      setError(data.error === "invalid_credentials" ? "Forkert e-mail eller adgangskode" : "Login mislykkedes");
    }
  };

  const verify2FA = () => {
    if (otp === "123456") {
      r.push("/review");
    } else {
      setError("Forkert kode · prøv 123456");
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Venstre · form */}
        <div className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px]">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-ink text-paper">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 3v18M3 12h18" opacity="0.35" />
                  <circle cx="12" cy="12" r="4.4" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="display text-[17px] font-semibold">PraxisOS</div>
                <div className="kicker !text-[9.5px]">Clinical OS</div>
              </div>
            </div>

            {step === "creds" && (
              <>
                <h1 className="display mt-10 text-[28px] font-semibold leading-tight">Velkommen tilbage.</h1>
                <p className="mt-2 text-[13px] text-muted">Log ind for at administrere din klinik.</p>

                <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-7 flex flex-col gap-3">
                  <div>
                    <div className="kicker mb-1.5">E-mail</div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dig@klinik.dk"
                      autoFocus
                      className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="kicker">Adgangskode</div>
                      <Link className="text-[11px] text-accent hover:underline" href="/login/reset">Glemt?</Link>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink"
                    />
                  </div>

                  {error && <div className="text-[12px] text-clay">⚠ {error}</div>}

                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="mt-2 rounded-[10px] bg-ink py-2.5 text-[13px] font-medium text-paper disabled:opacity-40"
                  >
                    {loading ? "Logger ind…" : "Log ind →"}
                  </button>
                </form>

                <div className="mt-5 flex items-center gap-3 text-[11px] text-faint">
                  <div className="h-px flex-1 bg-line" />
                  <span>eller</span>
                  <div className="h-px flex-1 bg-line" />
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <Link
                    href="/login/passkey"
                    className="block w-full rounded-[10px] border border-line-2 bg-card py-2.5 text-center text-[13px] font-medium hover:bg-paper-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-accent/14 text-accent">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      </span>
                      Passkey · Touch ID / Face ID / YubiKey
                    </span>
                  </Link>
                  <Link
                    href="/api/auth/mitid/start?mode=staff&returnTo=/dashboard"
                    className="block w-full rounded-[10px] border border-line-2 bg-card py-2.5 text-center text-[13px] font-medium hover:bg-paper-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-signal/14 text-signal">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
                      </span>
                      MitID Erhverv
                    </span>
                  </Link>
                </div>

                <p className="mt-6 text-center text-[12px] text-muted">
                  Ny klinik? <Link href="/admin/new-tenant" className="text-accent hover:underline">Opret konto</Link>
                </p>

                {/* Demo-conti */}
                <div className="mt-7 rounded-[11px] border border-dashed border-line-2 bg-paper-2/50 p-3 text-[11px]">
                  <div className="kicker mb-1.5">Demo · klik for at udfylde</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ["pilar@bypilar.dk", "Pilar · Ejer · 2FA"],
                      ["sofie@bypilar.dk", "Sofie · Behandler · 2 klinikker"],
                      ["nadia@nordlys.dk", "Nadia · Ejer · Nordlys"],
                      ["emil@bypilar.dk", "Emil · Receptionist"],
                    ].map(([e, label]) => (
                      <button
                        key={e}
                        onClick={() => { setEmail(e); setPassword("demo"); }}
                        className="rounded-[6px] border border-line bg-card px-2 py-1 text-left text-[10.5px] hover:bg-paper-2"
                      >
                        <div className="mono">{e}</div>
                        <div className="text-faint">{label}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-center text-[10px] text-faint">adgangskode: <span className="mono">demo</span></div>
                </div>
              </>
            )}

            {step === "pick" && (
              <>
                <div className="mt-10 flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full text-[14px] font-semibold text-paper" style={{ background: accountPreview?.avatarColor }}>
                    {accountPreview?.initials}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium">{accountPreview?.name}</div>
                    <div className="text-[11.5px] text-muted">{email}</div>
                  </div>
                </div>
                <h2 className="display mt-7 text-[22px] font-semibold">Vælg klinik</h2>
                <p className="mt-1 text-[12.5px] text-muted">Du har adgang til {tenantPick.length} klinikker.</p>
                <div className="mt-5 flex flex-col gap-2">
                  {tenantPick.map((t) => (
                    <button
                      key={t.slug}
                      onClick={() => submit(t.slug)}
                      className="flex items-center justify-between rounded-[10px] border border-line-2 bg-card p-3 transition-colors hover:bg-paper-2 hover:border-ink"
                    >
                      <span>
                        <div className="text-[13.5px] font-medium">{t.slug}</div>
                        <div className="text-[10.5px] text-faint">{t.role}</div>
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "2fa" && (
              <>
                <div className="mt-10 grid h-12 w-12 place-items-center rounded-full bg-accent/14 text-accent">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>
                </div>
                <h2 className="display mt-5 text-[22px] font-semibold">To-faktor verifikation</h2>
                <p className="mt-1 text-[12.5px] text-muted">Vi har sendt en 6-cifret kode til din MitID-app.</p>

                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  autoFocus
                  maxLength={6}
                  className="mt-5 w-full rounded-[10px] border border-line-2 bg-card px-3 py-3 mono text-center text-[24px] tracking-[0.4em] outline-none focus:border-ink"
                />

                {error && <div className="mt-2 text-[12px] text-clay">⚠ {error}</div>}

                <button
                  onClick={verify2FA}
                  disabled={otp.length !== 6}
                  className="mt-4 w-full rounded-[10px] bg-ink py-2.5 text-[13px] font-medium text-paper disabled:opacity-40"
                >
                  Verificér →
                </button>
                <div className="mt-3 text-center text-[10.5px] text-faint">
                  prototype: brug koden <span className="mono">123456</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Højre · brand-side */}
        <div className="hidden lg:block bg-grain border-l border-line p-12">
          <div className="flex h-full flex-col justify-between">
            <div></div>
            <div>
              <h2 className="display text-[40px] font-semibold leading-[1.05]" style={{ maxWidth: 460 }}>
                Klinikkens operativsystem — <em className="text-accent">samlet ét sted.</em>
              </h2>
              <p className="mt-4 max-w-[420px] text-[14px] text-muted">
                Booking, journal, agentic AI, AR/CV-progression, Physical AI fod-scan, tilskuds-indberetning og
                betaling — på én EU-compliant platform.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-[11.5px] text-muted">
                {["MitID", "GDPR Art. 9", "EU · Frankfurt", "MedCom-klar", "Sygesikringen «danmark»", "ISO 27001"].map((t) => (
                  <span key={t} className="rounded-full border border-line-2 bg-card px-3 py-1">{t}</span>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-faint">
              © PraxisOS · drevet i EU · krypteret med MitID
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
