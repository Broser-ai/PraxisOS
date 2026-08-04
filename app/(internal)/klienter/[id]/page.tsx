import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";
import { statusLabel } from "@/lib/bookings";
import { getClientForTenant, listBookingsForTenant } from "@/lib/data/repo";
import { skinParams, journalEntries } from "@/lib/mock";
import { SkinScan } from "@/components/SkinScan";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const session = decodeSession(jar.get(SESSION_COOKIE)?.value ?? "");
  if (!session) notFound();
  const client = await getClientForTenant(session.tenant, id);
  if (!client) notFound();

  const clientBookings = (await listBookingsForTenant(session.tenant, { limit: 200 }))
    .filter((b) => b.clientId === id)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <div className="mx-auto max-w-[1180px]">
      {/* Header */}
      <div className="rise flex flex-wrap items-center gap-4">
        <Link href="/klienter" className="grid h-9 w-9 place-items-center rounded-[10px] border border-line-2 bg-card text-muted hover:bg-paper-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6l-6 6 6 6"/></svg>
        </Link>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/12 text-[15px] font-semibold text-accent">
          {client.initials}
        </div>
        <div className="min-w-0">
          <h1 className="display text-[24px] font-semibold leading-none">{client.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <span>{client.age} år</span><span className="text-line-2">·</span>
            <span className="chip">{client.tag}</span><span className="text-line-2">·</span>
            {client.mitidVerified && (
              <span className="flex items-center gap-1 text-signal">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />MitID-verificeret
              </span>
            )}
            <span className="text-line-2">·</span>
            <span className="mono text-[11px]">{client.cprMasked}</span>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/scribe" className="btn btn-ghost">AI Scribe</Link>
          {client.hasFootScan && <Link href="/scan/start" className="btn btn-ghost">Nyt fod-scan</Link>}
          <button className="btn btn-primary">+ Aftale</button>
        </div>
      </div>

      {/* Kontakt-bar */}
      <div className="rise mt-5 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        <Info label="E-mail" value={client.email} />
        <Info label="Telefon" value={client.phone} />
        <Info label="Tilmeldt" value={new Date(client.joined).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })} />
        <Info label="Samtykke" value={client.consentLevel} />
      </div>

      {/* Forløb-bar hvis aktiv */}
      {client.forloeb && (
        <div className="card rise mt-3 p-4" style={{ animationDelay: "0.06s" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="kicker">Aktivt forløb</div>
              <div className="mt-1 display text-[16px] font-semibold">{client.forloeb.name}</div>
            </div>
            <div className="text-right">
              <div className="mono text-[12px]">{client.forloeb.sessions} / {client.forloeb.total} sessioner</div>
              <div className={`mono text-[10px] ${client.forloeb.status === "done" ? "text-signal" : "text-accent"}`}>
                {client.forloeb.status === "done" ? "afsluttet" : "igangværende"}
              </div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${client.forloeb.progress}%` }} />
          </div>
        </div>
      )}

      {/* Notes */}
      {client.notes && (
        <div className="rise mt-3 rounded-[10px] border border-amber/30 bg-amber/[0.06] p-3 text-[12.5px] text-ink-soft" style={{ animationDelay: "0.08s" }}>
          <span className="kicker !text-amber">Note</span>
          <p className="mt-1">{client.notes}</p>
        </div>
      )}

      {/* Hud-scan kun hvis aktiveret */}
      {client.hasSkinScan ? (
        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[400px_1fr]">
          <section className="card rise p-4" style={{ animationDelay: "0.1s" }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="display text-[16px] font-semibold">AR Hud-analyse</h2>
              <span className="chip !border-signal/40 text-signal">+13% siden baseline</span>
            </div>
            <SkinScan />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["TruSkin Age", "39", "kronologisk 42"], ["Concerns", "14", "kortlagt"], ["Forløb", "5/8", "sessioner"]].map(([a, b, c]) => (
                <div key={a} className="rounded-[10px] border border-line bg-paper p-2.5">
                  <div className="display text-[20px] font-semibold leading-none">{b}</div>
                  <div className="mt-1 text-[10.5px] text-muted">{a}</div>
                  <div className="mono text-[9.5px] text-faint">{c}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <section className="card rise p-5" style={{ animationDelay: "0.16s" }}>
              <div className="flex items-center justify-between">
                <h2 className="display text-[16px] font-semibold">Kvantitative parametre</h2>
                <span className="mono text-[11px] text-faint">nu vs. baseline</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
                {skinParams.map((p) => {
                  const delta = p.now - p.prev;
                  return (
                    <div key={p.key}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] font-medium">{p.key}</span>
                        <span className="mono text-[12px]">
                          {p.now}<span className={`ml-1.5 ${delta >= 0 ? "text-signal" : "text-clay"}`}>{delta >= 0 ? "+" : ""}{delta}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-2">
                        <div className="relative h-full">
                          <div className="absolute inset-y-0 left-0 rounded-full bg-line-2" style={{ width: `${p.prev}%` }} />
                          <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${p.now}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Journal timeline */}
            <section className="card rise p-5" style={{ animationDelay: "0.20s" }}>
              <h2 className="display text-[16px] font-semibold">Journal</h2>
              <div className="mt-4 flex flex-col">
                {journalEntries.map((j, i) => (
                  <div key={i} className="relative flex gap-4 pb-5 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/12" />
                      {i < journalEntries.length - 1 && <div className="w-px flex-1 bg-line" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold">{j.title}</span>
                        {j.aiDrafted && (
                          <span className="chip !border-signal/40 text-signal !py-0.5">AI-udkast</span>
                        )}
                        <span className="ml-auto mono text-[11px] text-faint">{j.date}</span>
                      </div>
                      <div className="mt-1.5 flex gap-3 mono text-[11px] text-muted">
                        <span>TruSkin {j.truSkinAge}</span><span>·</span><span>{j.concerns} concerns</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{j.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="card rise mt-6 p-6" style={{ animationDelay: "0.1s" }}>
          <div className="kicker">Journal</div>
          <h2 className="display mt-2 text-[18px] font-semibold">Ingen AR-scan endnu</h2>
          <p className="mt-2 text-[13px] text-muted">
            {client.name.split(" ")[0]} har ikke fået lavet en hud-scan. Du kan tilføje en ny ved næste session.
          </p>
          <div className="mt-4 flex gap-2">
            <button className="btn btn-primary">Tilføj note</button>
            <button className="btn btn-ghost">Planlæg AR-scan</button>
          </div>
        </div>
      )}

      {/* Booking-historik */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.24s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[16px] font-semibold">Booking-historik · {clientBookings.length}</h2>
          <Link href="/bookings" className="mono text-[11px] text-accent hover:underline">Alle bookings →</Link>
        </div>
        {clientBookings.length === 0 ? (
          <div className="py-6 text-center text-[12.5px] text-faint">Ingen bookings endnu</div>
        ) : (
          <div className="mt-4 flex flex-col">
            {clientBookings.map((b) => {
              const d = new Date(b.startsAt);
              const st = statusLabel[b.status];
              return (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="grid grid-cols-[100px_1fr_auto_auto] items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 hover:bg-paper-2 -mx-2 px-2 rounded-md"
                >
                  <div>
                    <div className="mono text-[12px]">{d.toLocaleDateString("da-DK", { day: "numeric", month: "short" })}</div>
                    <div className="mono text-[10.5px] text-faint">{d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-medium">{b.service}</div>
                    <div className="text-[11px] text-faint">{b.practitioner} · {b.modality}</div>
                  </div>
                  <span className="mono text-[12px] text-muted">{b.priceKr} kr</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-1 truncate text-[13px] font-medium">{value}</div>
    </div>
  );
}
