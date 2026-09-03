"use client";

import { use, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { getTenant } from "@/lib/tenants";
import { AddressAutocomplete, type DanishAddress } from "@/components/AddressAutocomplete";
import { CprMatch } from "@/components/CprMatch";
import { NemSmsOptIn } from "@/components/NemSmsOptIn";
import { NEMSMS_CONFIG, type NemSmsCategory } from "@/lib/nemsms";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Velkommen" },
  { n: 2, label: "Samtykke" },
  { n: 3, label: "MitID" },
  { n: 4, label: "Stamdata" },
  { n: 5, label: "Sundhed" },
  { n: 6, label: "NemSMS" },
  { n: 7, label: "Færdig" },
];

export default function PatientOnboarding({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = use(params);
  const t = getTenant(tenant);
  if (!t) notFound();

  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Samtykke
  const [consents, setConsents] = useState({
    treatment: false,
    journal: false,
    marketing: false,
    research: false,
  });
  // Stable client id for consent_events (F17) — generated once per onboarding session
  const [onboardingClientId] = useState(
    () => "cli_" + Math.random().toString(36).slice(2, 11),
  );
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  // MitID
  const [mitidVerified, setMitidVerified] = useState(false);

  // Stamdata
  const [stamdata, setStamdata] = useState({
    name: "Pilar Mortensen",          // pre-fyldt fra MitID-claim
    birthdate: "1985-04-12",
    cprHash: "",
    phone: "",
    email: "",
    address: null as DanishAddress | null,
  });

  // Sundheds-info
  const [health, setHealth] = useState({
    allergies: "",
    medications: "",
    chronicConditions: [] as string[],
    pregnant: false,
    diabetes: false,
    hasReferral: false,
  });

  // NemSMS-præferencer
  const [nemsmsPrefs, setNemsmsPrefs] = useState<Record<NemSmsCategory, boolean> | null>(null);

  const nemsmsConfig = NEMSMS_CONFIG[tenant];

  const next = () => setStep((s) => Math.min(7, s + 1) as Step);
  const prev = () => setStep((s) => Math.max(1, s - 1) as Step);

  /** F17 · POST checked purposes → recordConsentEvent (channel web_onboarding).
   *  F79 · treat already-recorded (200) as success; map error codes for UX. */
  function consentErrorMessage(body: { error?: string; retryAfter?: number }): string {
    switch (body?.error) {
      case "rate_limited":
        return body.retryAfter
          ? `For mange forsøg — vent ${body.retryAfter}s og prøv igen.`
          : "For mange forsøg — vent et øjeblik og prøv igen.";
      case "required_consents_missing":
        return "Behandling og journalvisning er påkrævet før du kan fortsætte.";
      case "no_consents":
        return "Vælg mindst behandling og journal før du fortsætter.";
      case "invalid_json":
        return "Ugyldigt svar — prøv igen.";
      case "tenant_not_found":
        return "Klinikken findes ikke. Tjek linket og prøv igen.";
      default:
        return typeof body?.error === "string"
          ? `Kunne ikke gemme samtykke (${body.error}). Prøv igen.`
          : "Kunne ikke gemme samtykke. Prøv igen.";
    }
  }

  async function acceptConsentsAndContinue() {
    if (!consents.treatment || !consents.journal || consentSaving) return;
    setConsentSaving(true);
    setConsentError(null);
    try {
      const res = await fetch(`/api/v1/${tenant}/consent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: onboardingClientId,
          consents,
          consentVersion: `${tenant}-onboarding-v1`,
        }),
      });
      const body = await res.json().catch(() => ({}));
      // F79 · 200 alreadyRecorded OR 201 created → continue
      if (res.ok && (body?.ok === true || body?.alreadyRecorded === true)) {
        next();
        return;
      }
      if (!res.ok) {
        setConsentError(consentErrorMessage(body));
        return;
      }
      setConsentError("Kunne ikke gemme samtykke. Prøv igen.");
    } catch {
      setConsentError("Netværksfejl — prøv igen om et øjeblik.");
    } finally {
      setConsentSaving(false);
    }
  }

  /** Enrich consent evidence with contact once stamdata is filled (best-effort). */
  async function continueFromStamdata() {
    if (!stamdata.phone || !stamdata.email || !stamdata.address) return;
    try {
      await fetch(`/api/v1/${tenant}/consent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: onboardingClientId,
          email: stamdata.email,
          name: stamdata.name,
          phone: stamdata.phone,
          consents,
          consentVersion: `${tenant}-onboarding-v1`,
        }),
      });
    } catch {
      // Non-blocking — grants already recorded at step 2
    }
    next();
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="rise mb-2">
        <div className="kicker">Velkommen til {t.brand.name}</div>
      </div>

      {/* Progress-rail */}
      <ol className="mb-8 flex items-center gap-y-2 text-[12px] text-muted overflow-x-auto pb-1">
        {STEPS.map((s, idx) => (
          <li key={s.n} className="flex items-center gap-2 shrink-0">
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold"
              style={{
                background: step >= s.n ? "var(--brand-ink)" : "transparent",
                color: step >= s.n ? "var(--brand-paper)" : "var(--brand-ink)",
                border: step >= s.n ? "none" : "1px solid var(--color-line-2)",
              }}
            >
              {step > s.n ? "✓" : s.n}
            </span>
            <span className={step >= s.n ? "font-medium" : ""}>{s.label}</span>
            {idx < STEPS.length - 1 && <span className="mx-2 h-px w-5 bg-line-2" />}
          </li>
        ))}
      </ol>

      {/* Step 1 — Velkommen */}
      {step === 1 && (
        <section className="rise">
          <h1 className="display text-[32px] font-semibold leading-tight">
            Velkommen til <em style={{ color: t.brand.accent }}>{t.brand.name}</em>.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed" style={{ color: t.brand.secondary }}>
            Vi opretter din profil i 5 hurtige trin. Når det er klart, kan du booke tider,
            få overblik over din behandling, og se hvilke tilskud du har ret til.
          </p>

          <div className="mt-7 rounded-[14px] border border-line bg-white/40 p-5">
            <div className="kicker mb-3">Hvad sker der i de næste 6 trin</div>
            <ol className="flex flex-col gap-2.5">
              {[
                ["Samtykke", "GDPR Art. 9 · særlige kategorier · sundhedsdata", "30 sek"],
                ["MitID-verifikation", "Vi bekræfter din identitet via Signaturgruppen-broker", "20 sek"],
                ["Stamdata", "Navn, adresse, kontakt · adresse via DAWA-opslag", "1 min"],
                ["Sundheds-info", "Allergier, medicin, kroniske diagnoser", "1 min"],
                ["NemSMS · valgfri", "Tilmeld officiel sundheds-SMS · gratis at modtage", "30 sek"],
                ["Færdig", "Du sendes til booking", "—"],
              ].map(([title, desc, time], i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold" style={{ background: t.brand.accent, color: t.brand.paper }}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{title}</div>
                    <div className="text-[11.5px]" style={{ color: t.brand.secondary }}>{desc}</div>
                  </div>
                  <span className="mono text-[10.5px] text-faint">{time}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-5 rounded-[10px] border border-signal/30 bg-signal/[0.06] p-3 text-[11.5px]" style={{ color: t.brand.ink }}>
            <b>Alt opbevares EU · Frankfurt</b> · GDPR Art. 9 · krypteret · du kan til enhver tid se hvem
            der har set dine data under "Min Side · indsigt".
          </div>

          <button
            onClick={next}
            className="mt-6 w-full rounded-[10px] py-3 text-[14px] font-medium"
            style={{ background: t.brand.ink, color: t.brand.paper }}
          >
            Lad os komme i gang →
          </button>
        </section>
      )}

      {/* Step 2 — Samtykke */}
      {step === 2 && (
        <section className="rise">
          <h1 className="display text-[26px] font-semibold">Samtykke</h1>
          <p className="mt-2 text-[13px]" style={{ color: t.brand.secondary }}>
            Vi behandler dine data efter GDPR Art. 9 (særlige kategorier · sundhedsdata).
            Du kan altid trække samtykke tilbage på Min Side.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <ConsentRow
              checked={consents.treatment}
              onChange={(v) => setConsents({ ...consents, treatment: v })}
              required
              title="Behandling og journalføring"
              desc="Lovkrav. Tillader os at modtage dig som klient og føre journal efter sundhedsloven."
            />
            <ConsentRow
              checked={consents.journal}
              onChange={(v) => setConsents({ ...consents, journal: v })}
              required
              title="Visning af journal i Min Side"
              desc="Du kan selv se hele din journal, AR-scans og fod-scan-resultater."
            />
            <ConsentRow
              checked={consents.marketing}
              onChange={(v) => setConsents({ ...consents, marketing: v })}
              title="Marketing-kommunikation (valgfri)"
              desc="Tilbud, nyhedsbrev og produkt-anbefalinger. Kan altid afmeldes."
            />
            <ConsentRow
              checked={consents.research}
              onChange={(v) => setConsents({ ...consents, research: v })}
              title="Anonymiseret forskning (valgfri)"
              desc="Bidrag til at forbedre AI-modeller. Dine data anonymiseres fuldstændigt."
            />
          </div>

          {consentError && (
            <div
              role="alert"
              className="mt-3 rounded-[10px] border border-clay/40 bg-clay/[0.06] px-3 py-2 text-[12px] text-ink"
            >
              {consentError}
              <button
                type="button"
                onClick={() => setConsentError(null)}
                className="ml-2 text-[11px] underline opacity-80 hover:opacity-100"
              >
                Luk
              </button>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button onClick={prev} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]">← Tilbage</button>
            <button
              onClick={() => void acceptConsentsAndContinue()}
              disabled={!consents.treatment || !consents.journal || consentSaving}
              className="flex-1 rounded-[10px] py-2.5 text-[13.5px] font-medium disabled:opacity-40"
              style={{ background: t.brand.ink, color: t.brand.paper }}
            >
              {consentSaving ? "Gemmer samtykke…" : "Acceptér og fortsæt →"}
            </button>
          </div>
        </section>
      )}

      {/* Step 3 — MitID */}
      {step === 3 && (
        <section className="rise">
          <h1 className="display text-[26px] font-semibold">Verificér med MitID</h1>
          <p className="mt-2 text-[13px]" style={{ color: t.brand.secondary }}>
            Vi bruger MitID for at sikre at det er dig der opretter kontoen — og at tilskuds-ordninger
            kan kobles korrekt på.
          </p>

          {!mitidVerified ? (
            <div className="mt-6 overflow-hidden rounded-[14px] border-2 border-[#0061af] bg-card">
              <div className="bg-[#0061af] px-5 py-4 text-white">
                <div className="text-[11px] opacity-70 uppercase tracking-wider">Verificér</div>
                <div className="mt-1 text-[15px] font-semibold">{t.brand.name}</div>
              </div>
              <div className="px-5 py-6">
                <div className="mono text-center text-[42px] font-bold tracking-[0.15em]">7-3-9</div>
                <p className="mt-3 text-center text-[12px] text-muted">
                  Bekræft i din MitID-app at koden matcher
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button onClick={prev} className="rounded-[10px] border border-line-2 px-4 py-2.5 text-[13px]">Annullér</button>
                  <button
                    onClick={() => setMitidVerified(true)}
                    className="rounded-[10px] bg-[#0061af] px-4 py-2.5 text-[13px] font-medium text-white"
                  >
                    Jeg har bekræftet
                  </button>
                </div>
              </div>
              <div className="border-t border-line bg-paper-2/40 px-5 py-2 mono text-[10px] text-faint">
                NSIS Substantial · scope=openid+mitid · single-use
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 rounded-[14px] border border-signal/40 bg-signal/[0.06] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-signal/14 text-signal">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold">MitID-verificeret</div>
                    <div className="mono text-[10.5px] text-muted">id_token claim: nsis_level=substantial</div>
                  </div>
                </div>
              </div>

              <h2 className="display mt-6 text-[18px] font-semibold">Bekræft dit CPR-nummer</h2>
              <p className="mt-1 text-[12px]" style={{ color: t.brand.secondary }}>
                Som privat klinik kan vi ikke hente dit CPR direkte fra MitID — du taster det selv,
                og vi tjekker det matcher din MitID-identitet.
              </p>
              <div className="mt-4">
                <CprMatch
                  mitidName={stamdata.name}
                  mitidBirthdate={stamdata.birthdate}
                  onMatch={(hash) => { setStamdata({ ...stamdata, cprHash: hash }); next(); }}
                />
              </div>
            </>
          )}
        </section>
      )}

      {/* Step 4 — Stamdata med DAWA */}
      {step === 4 && (
        <section className="rise">
          <h1 className="display text-[26px] font-semibold">Stamdata</h1>
          <p className="mt-2 text-[13px]" style={{ color: t.brand.secondary }}>
            Vi har dit navn og fødselsdato fra MitID. Tilføj kontakt-info.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="kicker mb-1.5">Navn · fra MitID</div>
              <input
                value={stamdata.name}
                readOnly
                className="w-full rounded-[10px] border border-line-2 bg-paper-2/60 px-3 py-2.5 text-[14px] text-muted"
              />
            </div>
            <div>
              <div className="kicker mb-1.5">Fødselsdato · fra MitID</div>
              <input
                value={stamdata.birthdate}
                readOnly
                className="w-full rounded-[10px] border border-line-2 bg-paper-2/60 px-3 py-2.5 text-[14px] text-muted mono"
              />
            </div>
            <div>
              <div className="kicker mb-1.5">Mobil <span className="text-clay">*</span></div>
              <input
                value={stamdata.phone}
                onChange={(e) => setStamdata({ ...stamdata, phone: e.target.value })}
                placeholder="+45 12 34 56 78"
                className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink"
              />
            </div>
            <div>
              <div className="kicker mb-1.5">E-mail <span className="text-clay">*</span></div>
              <input
                type="email"
                value={stamdata.email}
                onChange={(e) => setStamdata({ ...stamdata, email: e.target.value })}
                placeholder="dig@example.com"
                className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink"
              />
            </div>
          </div>

          <div className="mt-4">
            <AddressAutocomplete
              label="Adresse"
              required
              value={stamdata.address}
              onChange={(a) => setStamdata({ ...stamdata, address: a })}
            />
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={prev} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]">← Tilbage</button>
            <button
              onClick={() => void continueFromStamdata()}
              disabled={!stamdata.phone || !stamdata.email || !stamdata.address}
              className="flex-1 rounded-[10px] py-2.5 text-[13.5px] font-medium disabled:opacity-40"
              style={{ background: t.brand.ink, color: t.brand.paper }}
            >
              Fortsæt →
            </button>
          </div>
        </section>
      )}

      {/* Step 5 — Sundheds-info */}
      {step === 5 && (
        <section className="rise">
          <h1 className="display text-[26px] font-semibold">Sundheds-info</h1>
          <p className="mt-2 text-[13px]" style={{ color: t.brand.secondary }}>
            Behandlere skal kende disse oplysninger. Du kan altid opdatere på Min Side.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            <div>
              <div className="kicker mb-1.5">Allergier</div>
              <textarea
                value={health.allergies}
                onChange={(e) => setHealth({ ...health, allergies: e.target.value })}
                placeholder="f.eks. latex, penicillin, parfume… eller «ingen»"
                rows={2}
                className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ink resize-none"
              />
            </div>

            <div>
              <div className="kicker mb-1.5">Aktuel medicin</div>
              <textarea
                value={health.medications}
                onChange={(e) => setHealth({ ...health, medications: e.target.value })}
                placeholder="medicin du tager regelmæssigt"
                rows={2}
                className="w-full rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ink resize-none"
              />
            </div>

            <div>
              <div className="kicker mb-2">Relevante tilstande · for tilskuds-beregning</div>
              <div className="grid grid-cols-2 gap-2">
                <Toggle
                  on={health.diabetes}
                  onChange={(v) => setHealth({ ...health, diabetes: v })}
                  label="Diabetes (type 1 eller 2)"
                  hint="Aktiverer kommunalt fodpleje-tilskud"
                />
                <Toggle
                  on={health.hasReferral}
                  onChange={(v) => setHealth({ ...health, hasReferral: v })}
                  label="Lægehenvisning"
                  hint="Kræves til §7-tilskud (kronisk)"
                />
                <Toggle
                  on={health.pregnant}
                  onChange={(v) => setHealth({ ...health, pregnant: v })}
                  label="Gravid"
                  hint="Påvirker visse behandlinger"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button onClick={prev} className="rounded-[10px] border border-line-2 px-5 py-2.5 text-[13px]">← Tilbage</button>
            <button
              onClick={next}
              className="flex-1 rounded-[10px] py-2.5 text-[13.5px] font-medium"
              style={{ background: t.brand.ink, color: t.brand.paper }}
            >
              Færdiggør oprettelse →
            </button>
          </div>
        </section>
      )}

      {/* Step 6 — NemSMS opt-in */}
      {step === 6 && (
        <section className="rise">
          <h1 className="display text-[26px] font-semibold">Officiel sundheds-SMS</h1>
          <p className="mt-2 text-[13px]" style={{ color: t.brand.secondary }}>
            NemSMS er den officielle SMS-tjeneste via Sundhedsdatanettet. Den er gratis at modtage
            og ankommer fra et godkendt afsender-navn, så du altid ved at det er ægte.
          </p>

          <div className="mt-5">
            {nemsmsConfig && nemsmsConfig.senderIdStatus === "approved" ? (
              <NemSmsOptIn
                tenantName={t.brand.name}
                senderId={nemsmsConfig.senderId}
                phoneNumber={stamdata.phone}
                onComplete={(prefs) => {
                  setNemsmsPrefs(prefs);
                  next();
                }}
              />
            ) : (
              <div className="rounded-[12px] border border-amber/30 bg-amber/[0.06] p-4 text-[12.5px] text-ink-soft">
                <b>{t.brand.name} venter på godkendelse af NemSMS-afsender.</b>
                <div className="mt-1 text-muted">Indtil det er på plads modtager du alm. SMS og e-mail.</div>
                <button
                  onClick={next}
                  className="mt-3 w-full rounded-[10px] py-2.5 text-[13px] font-medium"
                  style={{ background: t.brand.ink, color: t.brand.paper }}
                >
                  Fortsæt →
                </button>
              </div>
            )}
          </div>

          <button onClick={prev} className="mt-3 text-[12px] text-muted hover:underline">← Tilbage til sundheds-info</button>
        </section>
      )}

      {/* Step 7 — Færdig */}
      {step === 7 && (
        <section className="rise text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-signal/14 text-signal">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
          </div>
          <h1 className="display mt-5 text-[28px] font-semibold">Du er klar!</h1>
          <p className="mt-2 text-[13.5px]" style={{ color: t.brand.secondary }}>
            Din profil er oprettet hos {t.brand.name}. Du kan nu booke tider og se din journal på Min Side.
          </p>

          <div className="mt-6 inline-block rounded-[12px] border border-line bg-card p-5 text-left">
            <div className="kicker">Profil oprettet</div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
              <Row label="Navn">{stamdata.name}</Row>
              <Row label="MitID">verificeret · NSIS Substantial</Row>
              <Row label="CPR">verificeret · krypteret hash</Row>
              <Row label="Adresse">{stamdata.address?.fuldText ?? "—"}</Row>
              <Row label="Diabetes-tilskud">{health.diabetes ? "berettiget · auto-indberetning" : "—"}</Row>
              <Row label="Sygesikringen «danmark»">Tilføj på Min Side</Row>
              <Row label="NemSMS">
                {nemsmsPrefs && Object.values(nemsmsPrefs).some(Boolean)
                  ? `${Object.values(nemsmsPrefs).filter(Boolean).length} kategorier aktive`
                  : "Ikke tilmeldt"}
              </Row>
            </div>
          </div>

          <div className="mt-7 flex justify-center gap-2">
            <button
              onClick={() => router.push(`/t/${tenant}/book`)}
              className="rounded-[10px] px-6 py-2.5 text-[13.5px] font-medium"
              style={{ background: t.brand.ink, color: t.brand.paper }}
            >
              Book første tid →
            </button>
            <button
              onClick={() => router.push(`/t/${tenant}/portal`)}
              className="rounded-[10px] border border-line-2 px-6 py-2.5 text-[13.5px]"
            >
              Til Min Side
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function ConsentRow({ checked, onChange, required, title, desc }: { checked: boolean; onChange: (v: boolean) => void; required?: boolean; title: string; desc: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-line-2 bg-card p-4 transition-colors hover:border-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 text-[13.5px] font-medium">
          {title}
          {required && <span className="chip mono !text-[9px] !border-clay/40 text-clay">påkrævet</span>}
        </div>
        <div className="mt-1 text-[11.5px] text-muted">{desc}</div>
      </div>
    </label>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-line-2 bg-card p-3 hover:border-ink">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <div className="flex-1">
        <div className="text-[12.5px] font-medium">{label}</div>
        <div className="text-[10.5px] text-muted">{hint}</div>
      </div>
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}
