import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenants";
import { listBookings, statusLabel } from "@/lib/bookings";
import { listVouchers, fmtBalance } from "@/lib/vouchers";
import { patientProfiles, subsidyRules, SCHEME_LABEL } from "@/lib/subsidies";
import { findClientByEmail } from "@/lib/clients";

const DEMO_EMAIL = "mette.l@example.com"; // demo-portal: logget ind som Mette

export default async function PatientPortal({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) notFound();

  const me = findClientByEmail(DEMO_EMAIL);
  const profile = me ? patientProfiles[me.id] : undefined;

  const myBookings = me ? listBookings({ clientId: me.id, tenant: slug }).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()) : [];
  const upcoming = myBookings.filter((b) => new Date(b.startsAt) > new Date() && b.status !== "cancelled" && b.status !== "noshow");
  const past = myBookings.filter((b) => new Date(b.startsAt) < new Date() || b.status === "completed");
  const next = upcoming[0];

  const myVouchers = listVouchers({ tenant: slug, status: "active" })
    .filter((v) => v.buyer.email.toLowerCase() === DEMO_EMAIL || v.recipient?.email.toLowerCase() === DEMO_EMAIL);

  return (
    <div className="mx-auto max-w-[860px]">
      {/* Velkomst */}
      <div className="rise">
        <div className="kicker">Min side</div>
        <h1 className="display mt-2 text-[32px] font-semibold leading-tight">God morgen, {me?.name.split(" ")[0]}.</h1>
        <p className="mt-2 text-[13.5px]" style={{ color: t.brand.secondary }}>
          MitID-verificeret · alle dine data hos {t.brand.name} samlet ét sted.
        </p>
      </div>

      {/* Næste tid */}
      {next && (
        <section className="rise mt-7 overflow-hidden rounded-[14px] border border-line bg-white/40">
          <div className="border-l-4 px-6 py-5" style={{ borderColor: t.brand.accent }}>
            <div className="kicker">Næste tid</div>
            <div className="display mt-1.5 text-[22px] font-semibold">{next.service}</div>
            <div className="mt-1 text-[13px]" style={{ color: t.brand.secondary }}>
              {new Date(next.startsAt).toLocaleString("da-DK", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {next.modality} · med {next.practitioner}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/r/${next.id}`} className="rounded-[10px] px-4 py-2 text-[12.5px] font-medium" style={{ background: t.brand.ink, color: t.brand.paper }}>
                Vis kvittering
              </Link>
              <button className="rounded-[10px] border px-4 py-2 text-[12.5px] font-medium" style={{ borderColor: t.brand.ink }}>
                Ombook / aflys
              </button>
              <button className="rounded-[10px] border px-4 py-2 text-[12.5px] font-medium" style={{ borderColor: t.brand.ink }}>
                Tilføj til kalender
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Genveje */}
      <div className="stagger mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: "Book ny tid", href: `/t/${t.slug}/book`, icon: "M12 5v14M5 12h14" },
          { label: "Mine vouchers", href: "#vouchers", icon: "M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" },
          { label: "Mine tilskud", href: "#subsidies", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
          { label: "Min progression", href: "#progression", icon: "M3 17l6-6 4 4 8-8" },
          { label: "Hvem har set min journal", href: "#indsigt", icon: "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="rounded-[12px] border border-line bg-white/40 p-4 transition-colors hover:bg-white/70">
            <span style={{ color: t.brand.accent }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon}/></svg>
            </span>
            <div className="mt-2.5 text-[12.5px] font-medium">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Mine vouchers */}
      <section id="vouchers" className="rise mt-8 rounded-[14px] border border-line bg-white/40 p-6">
        <div className="flex items-center justify-between">
          <h2 className="display text-[20px] font-semibold">Mine vouchers</h2>
          <Link href={`/t/${t.slug}/book`} className="text-[12px] hover:underline" style={{ color: t.brand.accent }}>
            Brug ved næste booking →
          </Link>
        </div>
        {myVouchers.length === 0 ? (
          <div className="mt-4 rounded-[10px] border border-dashed border-line-2 p-6 text-center text-[12.5px]" style={{ color: t.brand.secondary }}>
            Du har ingen aktive klippekort eller gavekort.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {myVouchers.map((v) => {
              const isClip = v.kind === "clip";
              const usedPct = isClip
                ? Math.round((((v.sessionsTotal ?? 1) - (v.sessionsRemaining ?? 0)) / (v.sessionsTotal ?? 1)) * 100)
                : Math.round((((v.originalBalanceOere ?? 1) - (v.balanceOere ?? 0)) / (v.originalBalanceOere ?? 1)) * 100);
              return (
                <div
                  key={v.id}
                  className="overflow-hidden rounded-[14px] border border-line"
                  style={{
                    background: isClip
                      ? "linear-gradient(135deg, color-mix(in srgb, " + t.brand.accent + " 6%, white), white)"
                      : "linear-gradient(135deg, color-mix(in srgb, " + t.brand.accent + " 12%, white), color-mix(in srgb, " + t.brand.accent + " 3%, white))",
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.brand.accent }}>
                        {isClip ? "Klippekort" : "Gavekort"}
                      </span>
                      <span className="mono text-[10px]" style={{ color: t.brand.secondary }}>
                        udløber {new Date(v.expiresAt).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="mt-2 display text-[18px] font-semibold">
                      {isClip ? v.serviceName : "Gavekort"}
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="display text-[26px] font-semibold leading-none">{fmtBalance(v)}</span>
                      <span className="text-[10.5px]" style={{ color: t.brand.secondary }}>tilbage</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.06)" }}>
                      <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: t.brand.accent }} />
                    </div>
                    <div className="mt-3 mono text-[11px] font-semibold" style={{ color: t.brand.ink }}>
                      {v.code}
                    </div>
                    {v.recipient && v.recipient.email.toLowerCase() === DEMO_EMAIL && (
                      <div className="mt-2 rounded-[8px] bg-white/60 p-2 text-[10.5px] italic" style={{ color: t.brand.secondary }}>
                        «{v.message}»<div className="mt-1 not-italic">— fra {v.buyer.name}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Mine tilskud */}
      <section id="subsidies" className="rise mt-3 rounded-[14px] border border-line bg-white/40 p-6">
        <h2 className="display text-[20px] font-semibold">Mine tilskuds-ordninger</h2>
        <p className="mt-1 text-[12.5px]" style={{ color: t.brand.secondary }}>
          Tilskud beregnes automatisk og indberettes direkte til de relevante instanser. Du behøver ikke gøre noget.
        </p>

        {!profile || profile.schemes.length === 0 ? (
          <div className="mt-4 rounded-[10px] border border-dashed border-line-2 p-6 text-center text-[12.5px]" style={{ color: t.brand.secondary }}>
            Du har ingen tilskuds-ordninger registreret. <button className="underline">Tilføj medlemskab</button> for at få tilskud.
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {profile.schemes.map((s) => {
              const consumed = s.consumedThisYearKr ?? 0;
              const sessions = s.consumedThisYearSessions ?? 0;
              const rule = subsidyRules.find((r) => r.scheme === s.scheme);
              const cap = rule?.maxPerYearKr;
              const sessionCap = rule?.maxSessionsPerYear;
              return (
                <div key={s.scheme} className="rounded-[12px] border border-line bg-paper p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[13.5px] font-semibold">{SCHEME_LABEL[s.scheme]}</div>
                      {s.memberId && <div className="mono mt-0.5 text-[10.5px]" style={{ color: t.brand.secondary }}>Medlems-id: {s.memberId}</div>}
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "color-mix(in srgb, var(--color-signal) 14%, transparent)", color: "var(--color-signal)" }}>
                      aktiv
                    </span>
                  </div>
                  {(cap || sessionCap) && (
                    <div className="mt-3">
                      <div className="flex items-baseline justify-between text-[11px]" style={{ color: t.brand.secondary }}>
                        <span>Forbrug i {new Date().getFullYear()}</span>
                        <span className="mono">
                          {cap ? `${consumed} / ${cap} kr` : `${sessions} / ${sessionCap} sessioner`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.06)" }}>
                        <div className="h-full rounded-full" style={{
                          width: `${cap ? Math.min(100, (consumed / cap) * 100) : Math.min(100, (sessions / sessionCap!) * 100)}%`,
                          background: t.brand.accent,
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Min progression */}
      <section id="progression" className="rise mt-3 rounded-[14px] border border-line bg-white/40 p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="kicker">Min progression</div>
            <h2 className="display mt-1 text-[22px] font-semibold">{me?.forloeb?.name ?? "Ingen aktive forløb"}</h2>
          </div>
          {me?.forloeb && (
            <div className="text-right">
              <div className="display text-[24px] font-semibold">{me.forloeb.sessions}/{me.forloeb.total}</div>
              <div className="text-[11px]" style={{ color: t.brand.secondary }}>sessioner</div>
            </div>
          )}
        </div>
        {me?.forloeb && (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${me.forloeb.progress}%`, background: t.brand.accent }} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Forbedring", value: "+13%", sub: "siden baseline" },
                { label: "TruSkin Age", value: "39", sub: "kronologisk 42" },
                { label: "Næste session", value: "11. juni", sub: "kl. 10:00" },
              ].map((m) => (
                <div key={m.label} className="rounded-[10px] border border-line bg-paper/50 p-3">
                  <div className="display text-[20px] font-semibold leading-none">{m.value}</div>
                  <div className="mt-1 text-[10.5px] font-medium">{m.label}</div>
                  <div className="mono text-[9.5px]" style={{ color: t.brand.secondary }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* NemSMS-præferencer */}
      <section className="rise mt-3 rounded-[14px] border border-line bg-white/40 p-6">
        <div className="flex items-center justify-between">
          <h2 className="display text-[20px] font-semibold">Notifikationer</h2>
          <span className="chip mono !text-[10px] !border-[#0061af]/40" style={{ color: "#0061af" }}>NemSMS · BY PILAR</span>
        </div>
        <p className="mt-1 text-[12.5px]" style={{ color: t.brand.secondary }}>
          Officiel sundheds-SMS via Sundhedsdatanettet · gratis at modtage · kan opt-out på borger.dk
        </p>

        <div className="mt-4 flex flex-col gap-1.5">
          {[
            { k: "booking_confirm", label: "Booking-bekræftelse", on: true, hint: "Hver gang du booker" },
            { k: "reminder_24h", label: "Påmindelse · 24t før", on: true, hint: "Dagen før behandling" },
            { k: "reminder_1h", label: "Påmindelse · 1t før", on: false, hint: "1 time før din tid" },
            { k: "cancellation", label: "Aflysning", on: true, hint: "Hvis vi må aflyse" },
            { k: "prescription", label: "Recept klar", on: true, hint: "Når recept ligger på apoteket" },
            { k: "treatment_results", label: "Resultater klar", on: true, hint: "AR-scan, fod-scan, journal" },
          ].map((p) => (
            <div key={p.k} className="flex items-center gap-3 rounded-[10px] border border-line bg-paper px-3 py-2.5">
              <div className="flex-1">
                <div className="text-[13px] font-medium">{p.label}</div>
                <div className="text-[10.5px]" style={{ color: t.brand.secondary }}>{p.hint}</div>
              </div>
              <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${p.on ? "" : "bg-line-2"}`}
                    style={p.on ? { background: t.brand.accent } : {}}>
                <span className={`block h-4 w-4 rounded-full bg-paper transition-transform ${p.on ? "translate-x-4" : ""}`} />
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line bg-paper-2/60 p-3 text-[10.5px]" style={{ color: t.brand.secondary }}>
          <span><b>5 / 6</b> kategorier aktive · sender-ID <code className="mono text-ink">BY PILAR</code></span>
          <a href="https://www.borger.dk/internet-og-sikkerhed/Digital-Post/NemSMS" target="_blank" className="text-accent hover:underline">Administrer på borger.dk →</a>
        </div>
      </section>

      {/* Hvem har set min journal · GDPR Art. 15 + Datatilsynet juli 2024 */}
      <section id="indsigt" className="rise mt-3 rounded-[14px] border border-line bg-white/40 p-6">
        <div className="flex items-center justify-between">
          <h2 className="display text-[20px] font-semibold">Hvem har set min journal</h2>
          <span className="chip mono !text-[10px]">GDPR Art. 15 · indsigt</span>
        </div>
        <p className="mt-1 text-[12.5px]" style={{ color: t.brand.secondary }}>
          Lovbestemt indsigt i alle der har set dine data — opdateret i realtid · krypto-signeret.
        </p>

        <div className="mt-5 flex flex-col">
          {[
            { at: "8. jun 09:12", who: "Dr. Sofie Krarup", action: "Læste journal-entry #5", purpose: "Forberedelse til opfølgning", role: "Fodterapeut" },
            { at: "8. jun 08:14", who: "Klinik-assistent", action: "Sendte SMS-påmindelse",  purpose: "Påmindelse 24t før booking", role: "AI-agent" },
            { at: "7. jun 14:55", who: "Dr. Sofie Krarup", action: "Tilføjede AR-scan",      purpose: "Session 5 · acne-forløb",   role: "Fodterapeut" },
            { at: "2. jun 11:30", who: "Pilar Mortensen",  action: "Læste journal",          purpose: "Daglig opfølgning",         role: "Ejer" },
            { at: "24. maj 10:00", who: "Dr. Sofie Krarup",action: "Skrev journal-entry #4", purpose: "Session 4 · behandling",    role: "Fodterapeut" },
          ].map((e, i) => (
            <div key={i} className="grid grid-cols-[110px_1fr_auto] gap-3 border-t border-line/60 py-3 first:border-t-0 first:pt-0">
              <span className="mono text-[11.5px]" style={{ color: t.brand.secondary }}>{e.at}</span>
              <div>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium">{e.who}</span>
                  <span className="text-[10px] rounded-full border border-line-2 px-1.5 py-0">{e.role}</span>
                </div>
                <div className="mt-0.5 text-[11.5px]" style={{ color: t.brand.secondary }}>
                  {e.action} · <em>formål: {e.purpose}</em>
                </div>
              </div>
              <button className="text-[11px] text-clay hover:underline">
                Anmeld uberettiget opslag
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[10px] border border-line bg-paper-2/60 p-3 text-[11px]" style={{ color: t.brand.secondary }}>
          <b>Din ret efter EU-Domstolen (C-579/21) + Datatilsynet juli 2024:</b> du kan til enhver tid
          få fuld kopi af denne log med dato, formål, hvilke data der blev set, og hvis du mistænker
          uberettiget opslag har du ret til at få medarbejderens navn oplyst.
        </div>
        <div className="mt-3 flex gap-2">
          <button className="rounded-[10px] px-4 py-2 text-[12px] font-medium" style={{ background: t.brand.ink, color: t.brand.paper }}>
            Hent log som PDF
          </button>
          <button className="rounded-[10px] border px-4 py-2 text-[12px] font-medium" style={{ borderColor: t.brand.ink }}>
            Anmod indsigt via Datatilsynet
          </button>
        </div>
      </section>

      {/* Tidligere bookings */}
      <section className="rise mt-3 rounded-[14px] border border-line bg-white/40 p-6">
        <h2 className="display text-[18px] font-semibold">Tidligere besøg</h2>
        <div className="mt-4 flex flex-col">
          {past.length === 0 ? (
            <div className="py-4 text-center text-[12.5px]" style={{ color: t.brand.secondary }}>Ingen besøg endnu</div>
          ) : past.map((b) => {
            const d = new Date(b.startsAt);
            const st = statusLabel[b.status];
            return (
              <div key={b.id} className="grid grid-cols-[100px_1fr_auto_auto] items-center gap-3 border-t border-line/60 py-3 first:border-t-0 first:pt-0">
                <span className="mono text-[12px]" style={{ color: t.brand.secondary }}>
                  {d.toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="text-[13px] font-medium">{b.service}</span>
                <span className="mono text-[12px]" style={{ color: t.brand.secondary }}>{b.priceKr} kr</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="rise mt-6 flex items-center justify-between rounded-[10px] border border-line bg-paper-2/40 p-3 text-[11.5px]" style={{ color: t.brand.secondary }}>
        <span>Logget ind som <b>{me?.name}</b> · MitID-verificeret · {DEMO_EMAIL}</span>
        <button className="hover:underline">Log ud</button>
      </div>
    </div>
  );
}
