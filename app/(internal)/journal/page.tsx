import Link from "next/link";
import { listJournal, journalStats, statusLabel } from "@/lib/journal";

export default function JournalIndex() {
  const entries = listJournal({ tenant: "bypilar", limit: 80 });
  const stats = journalStats("bypilar");

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">Behandlingsjournal · PraxisOS</div>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Journal</h1>
          <p className="mt-2 max-w-[52ch] text-[13.5px] text-muted">
            Én post pr. behandling. Niels skriver SOAP-udkast — du godkender og låser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/scribe" className="btn btn-primary">
            AI Scribe →
          </Link>
          <Link href="/bookings" className="btn btn-ghost">
            Bookings
          </Link>
        </div>
      </div>

      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="I alt" value={String(stats.total)} />
        <Stat label="Signeret" value={String(stats.signed)} />
        <Stat label="Afventer dig" value={String(stats.pending)} />
        <Stat label="Kladder" value={String(stats.draft)} />
      </div>

      <section className="card mt-3 overflow-hidden">
        <div className="border-b border-line px-5 py-3.5 flex items-center justify-between">
          <h2 className="display text-[16px] font-semibold">Poster</h2>
          <span className="mono text-[11px] text-faint">{entries.length} vist</span>
        </div>
        <div className="divide-y divide-line">
          {entries.map((e) => {
            const st = statusLabel[e.status];
            const d = new Date(e.visitAt);
            return (
              <Link
                key={e.id}
                href={`/journal/${e.id}`}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper-2"
              >
                <div className="min-w-[88px]">
                  <div className="mono text-[12px]">
                    {d.toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
                  </div>
                  <div className="mono text-[10.5px] text-faint">
                    {d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold">{e.clientName}</span>
                    {e.aiDrafted && (
                      <span className="chip !border-signal/40 text-signal !py-0.5">Niels</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {e.service}
                    {e.bookingId ? ` · ${e.bookingId}` : ""}
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10.5px] font-medium"
                  style={{ background: st.bg, color: st.color }}
                >
                  {st.label}
                </span>
              </Link>
            );
          })}
          {entries.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] text-faint">
              Ingen journalposter endnu. Start fra en booking eller AI Scribe.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="display text-[24px] font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{label}</div>
    </div>
  );
}
