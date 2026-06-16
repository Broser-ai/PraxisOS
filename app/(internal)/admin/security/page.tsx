"use client";

import Link from "next/link";
import { listAttempts } from "@/lib/rate-limit";
import { accounts, ROLE_LABEL } from "@/lib/auth";

const SESSIONS = [
  { id: "sess_a1", account: "Pilar Mortensen", device: "MacBook Pro · Chrome 138",      ip: "62.198.4.117",  geo: "Aarhus, DK",     loggedInAt: "8. jun 08:14", current: true },
  { id: "sess_a2", account: "Pilar Mortensen", device: "iPhone 15 · Safari · iOS 18",   ip: "84.21.7.211",   geo: "Aarhus, DK",     loggedInAt: "7. jun 19:42" },
  { id: "sess_a3", account: "Sofie Krarup",    device: "iPhone 14 · Safari · iOS 18",   ip: "85.184.91.4",   geo: "København, DK",  loggedInAt: "8. jun 06:30" },
  { id: "sess_a4", account: "Emil Knudsen",    device: "Windows 11 · Edge 138",         ip: "188.115.7.91",  geo: "Aarhus, DK",     loggedInAt: "6. jun 14:22" },
];

const ACCESS_LOG = [
  { at: "8. jun 09:12", actor: "Sofie Krarup", action: "Læste journal", target: "Mette Lindqvist · journal-entry #5",   ip: "85.184.91.4" },
  { at: "8. jun 08:31", actor: "Pilar M.",     action: "Eksporterede klient-CSV", target: "47 klienter",                  ip: "62.198.4.117" },
  { at: "8. jun 08:14", actor: "Pilar M.",     action: "Logget ind (MitID)",      target: "—",                            ip: "62.198.4.117" },
  { at: "8. jun 06:30", actor: "Sofie Krarup", action: "Logget ind (MitID)",      target: "—",                            ip: "85.184.91.4" },
  { at: "7. jun 19:42", actor: "Pilar M.",     action: "Logget ind (MitID)",      target: "—",                            ip: "84.21.7.211" },
  { at: "7. jun 16:08", actor: "Aria-agent",   action: "Auto-bookede tid",         target: "Per Sørensen · sårkontrol",    ip: "internal" },
  { at: "7. jun 14:55", actor: "Sofie Krarup", action: "Slettede billede",        target: "Mette L. · AR-scan baseline",  ip: "85.184.91.4" },
];

export default function SecurityDashboard() {
  const attempts = listAttempts(15);
  const blockedCount = attempts.filter((a) => a.blocked).length;
  const failedCount = attempts.filter((a) => !a.success && !a.blocked).length;

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Sikkerhed & adgang</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            MitID-status · rate-limit-aktivitet · aktive sessioner · audit-log over alle klient-data-tilgange.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost">Eksportér til Datatilsynet</button>
          <button className="btn btn-primary">Force-logout alle</button>
        </div>
      </div>

      {/* Hero-stats */}
      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        <Stat label="Aktive sessioner" value={SESSIONS.length} color="var(--color-accent)" />
        <Stat label="Mislykkede login · 24t" value={failedCount} color="var(--color-amber)" />
        <Stat label="Blokerede angreb · 24t" value={blockedCount} color="var(--color-clay)" />
        <Stat label="Audit-events · i dag" value={ACCESS_LOG.length} color="var(--color-signal)" highlight />
      </div>

      {/* Brugere · auth-status */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.08s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Brugere · auth-status</h2>
          <Link href="/admin/staff" className="text-[12px] text-accent hover:underline">Administrér behandlere →</Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-faint">
              <tr className="border-b border-line">
                {["Bruger", "Rolle", "Klinikker", "MitID", "2FA", "Sidste login"].map((h) => (
                  <th key={h} className="kicker text-left pb-2 pr-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-b-0">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-paper" style={{ background: a.avatarColor }}>{a.initials}</span>
                      <div>
                        <div className="text-[12.5px] font-medium">{a.name}</div>
                        <div className="mono text-[10px] text-faint">{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">{ROLE_LABEL[a.tenants[0].role]}</td>
                  <td className="py-2.5 pr-3 mono text-[11px]">{a.tenants.map((t) => t.slug).join(" · ")}</td>
                  <td className="py-2.5 pr-3">
                    <span className="chip mono !text-[10px] !border-signal/40 text-signal">verificeret</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`mono text-[10.5px] ${a.twoFAEnabled ? "text-signal" : "text-amber"}`}>
                      {a.twoFAEnabled ? "● aktiv" : "○ frafalt"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 mono text-[10.5px] text-faint">i dag</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Aktive sessioner */}
        <section className="card rise p-5" style={{ animationDelay: "0.12s" }}>
          <h2 className="display text-[16px] font-semibold">Aktive sessioner</h2>
          <div className="mt-4 flex flex-col">
            {SESSIONS.map((s) => (
              <div key={s.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{s.account}</span>
                    {s.current && <span className="chip !py-0 !text-[9px] !border-signal/40 text-signal">denne enhed</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">{s.device}</div>
                  <div className="mt-0.5 mono text-[10px] text-faint">{s.geo} · {s.ip} · login {s.loggedInAt}</div>
                </div>
                {!s.current && (
                  <button className="rounded-[7px] border border-clay/40 px-2.5 py-1 text-[10.5px] text-clay hover:bg-clay/[0.06]">
                    Force-logout
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Login-forsøg */}
        <section className="card rise p-5" style={{ animationDelay: "0.16s" }}>
          <div className="flex items-center justify-between">
            <h2 className="display text-[16px] font-semibold">Login-forsøg · 24 timer</h2>
            <span className="mono text-[11px] text-faint">{attempts.length} hændelser</span>
          </div>
          <div className="scrollbar-thin mt-4 max-h-[300px] overflow-y-auto pr-1">
            {attempts.map((a, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-2 border-t border-line py-2 first:border-t-0 first:pt-0">
                <span className={`mt-0.5 h-2 w-2 rounded-full ${a.success ? "bg-signal" : a.blocked ? "bg-clay" : "bg-amber"}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="mono text-[10.5px] text-faint">{new Date(a.at).toLocaleTimeString("da-DK")}</span>
                    <span className="text-[11.5px]">{a.email}</span>
                  </div>
                  <div className="mono text-[9.5px] text-faint">{a.ip} · {a.userAgent} · {a.geo}</div>
                  {a.reason && (
                    <div className="mono text-[9.5px] mt-0.5" style={{ color: a.blocked ? "var(--color-clay)" : "var(--color-amber)" }}>
                      {a.blocked ? "🚫 " : "⚠ "}{a.reason}
                    </div>
                  )}
                </div>
                <span className={`mono text-[9px] ${a.success ? "text-signal" : a.blocked ? "text-clay" : "text-amber"}`}>
                  {a.success ? "OK" : a.blocked ? "blokeret" : "fejl"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Audit-log · GDPR Art. 30 */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.20s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Audit-log · alle klient-data-tilgange</h2>
          <span className="chip mono !text-[10px]">GDPR Art. 30 · append-only · hash-chain</span>
        </div>
        <p className="mt-1 text-[12px] text-muted">
          Patienter kan selv se denne log under "hvem har set min journal" på deres Min Side.
          Loggen er immutable og krypto-signeret.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-faint">
              <tr className="border-b border-line">
                {["Tid", "Hvem", "Handling", "Mål", "IP"].map((h) => (
                  <th key={h} className="kicker text-left pb-2 pr-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCESS_LOG.map((e, i) => (
                <tr key={i} className="border-b border-line/60 last:border-b-0">
                  <td className="py-2 pr-3 mono text-[10.5px] text-faint">{e.at}</td>
                  <td className="py-2 pr-3 text-[12px] font-medium">{e.actor}</td>
                  <td className="py-2 pr-3 text-[12px]">{e.action}</td>
                  <td className="py-2 pr-3 text-[11.5px] text-muted">{e.target}</td>
                  <td className="py-2 pr-3 mono text-[10.5px] text-faint">{e.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-3 rounded-[12px] border border-line bg-paper-2/60 p-5 text-[12.5px] text-ink-soft">
        <div className="kicker">Datatilsynet · GDPR Art. 30 + sundhedslovens § 42</div>
        <p className="mt-2">
          Alle adgange til journaler, AR-scans og klient-data logges immutably (Merkle-hash-chain).
          Patienten har lovbestemt ret til indsigt — derfor er denne log også synlig på <code className="mono">/t/[tenant]/portal</code> under "hvem har set min journal".
          Audit-log gemmes i 10 år iht. sundhedslovens journaliseringspligt.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className="card p-3" style={highlight ? { borderColor: color, background: `color-mix(in srgb, ${color} 5%, var(--color-card))` } : {}}>
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-1 display text-[26px] font-semibold leading-none" style={highlight ? { color } : {}}>{value}</div>
    </div>
  );
}
