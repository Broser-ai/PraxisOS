import { FootScan } from "@/components/FootScan";
import { FootMesh3D } from "@/components/FootMesh3D";
import { SwarmPanel } from "@/components/SwarmPanel";
import { NexusScanPanel } from "@/components/NexusScanPanel";
import { sensorBridge, footMetrics, biomarkers, codeLog, FEATURE_CAD_EXPORT } from "@/lib/scan";
import { getTenant } from "@/lib/tenants";
import { getBooking, listBookings } from "@/lib/bookings";
import { getClient } from "@/lib/clients";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FodScanPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string; clientId?: string }>;
}) {
  const sp = await searchParams;
  const tenant = getTenant("bypilar")!;
  const booking = sp.bookingId ? getBooking(sp.bookingId) : undefined;
  const fallbackScanBooking =
    booking ??
    listBookings({ tenant: "bypilar" }).find((b) => b.serviceId === "fod-scan") ??
    listBookings({ tenant: "bypilar" })[0];
  const client = getClient(sp.clientId || booking?.clientId || fallbackScanBooking?.clientId || "mette");

  const patientId = client?.id || booking?.clientId || "mette";
  const patientName = client?.name || booking?.clientName || "Klient";
  const bookingId = booking?.id || fallbackScanBooking?.id;
  const serviceName = booking?.service || "Fod-scan · Physical AI";

  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
            </span>
            {tenant.brand.name} · Physical AI · Fod-scanning
          </div>
          <h1 className="display mt-2 text-[32px] font-semibold leading-none">Fod-scan</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            {patientName} · {serviceName}
            {bookingId ? ` · ${bookingId}` : ""} · Nexus 4D koblet til klinikken
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip mono !text-[10.5px] text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            bypilar · live
          </span>
          {FEATURE_CAD_EXPORT && <button className="btn btn-ghost">Eksportér til indlæg-producent</button>}
          {bookingId && (
            <Link href={`/bookings/${bookingId}`} className="btn btn-ghost">
              Booking
            </Link>
          )}
          <Link href={`/scan/start${bookingId ? `?bookingId=${bookingId}` : ""}`} className="btn btn-primary">
            <span className="h-2 w-2 rounded-full bg-clay live-dot" /> Live session
          </Link>
        </div>
      </div>

      <div className="rise mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        {sensorBridge.map((s) => (
          <div key={s.name} className="card flex items-center gap-2.5 p-2.5">
            <span className="h-2 w-2 rounded-full bg-signal live-dot" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] font-medium">{s.name}</div>
              <div className="mono text-[10px] text-faint">
                {s.latency} · {s.health}%
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rise mt-5" style={{ animationDelay: "0.05s" }}>
        <NexusScanPanel
          tenantId="bypilar"
          brandName={tenant.brand.name}
          patientId={patientId}
          patientName={patientName}
          bookingId={bookingId}
          serviceName={serviceName}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="card rise p-5" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="display text-[17px] font-semibold">Fod-topologi · 3 vinkler</h2>
              <div className="kicker !text-[9px]">3D-mesh · 312k punkter · top + side + bund</div>
            </div>
          </div>

          <div className="mt-5">
            <FootScan />
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div className="kicker mb-3">Kvantitative parametre · L vs. R</div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {footMetrics.map((m) => (
                <div
                  key={m.label}
                  className="flex items-center justify-between border-b border-line/60 py-1.5 last:border-b-0"
                >
                  <span className="text-[12.5px]">{m.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="mono text-[11.5px] text-faint">
                      {m.left} · {m.right}
                    </span>
                    <span className="mono text-[9.5px] text-clay">{m.flag}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 text-[10.5px] text-faint">
            <span className="mono">0 kPa</span>
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: "linear-gradient(90deg, #3f7d5a, #ad7a26, #c46a4a, #b9543a)" }}
            />
            <span className="mono">250+ kPa</span>
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <section className="card rise p-4" style={{ animationDelay: "0.12s" }}>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-clay/14 text-clay">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="display text-[15px] font-semibold leading-tight">Klinisk anbefaling</h2>
                <div className="kicker !text-[9px]">{tenant.brand.name} · Nexus</div>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
              Kør Alpha-scan ovenfor for live MonoMSK-tal. Resultatet kan sendes direkte til journal for{" "}
              <b>{patientName}</b>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {bookingId && (
                <Link href={`/scribe?booking=${bookingId}`} className="btn btn-primary !py-1.5 !text-[11.5px]">
                  AI Scribe
                </Link>
              )}
              <Link href="/journal" className="btn btn-ghost !py-1.5 !text-[11.5px]">
                Journal
              </Link>
              <Link href="/t/bypilar/book" className="btn btn-ghost !py-1.5 !text-[11.5px]">
                Book fod-scan
              </Link>
            </div>
          </section>

          <section className="card rise p-4" style={{ animationDelay: "0.16s" }}>
            <div className="flex items-center justify-between">
              <h2 className="display text-[15px] font-semibold">Agent swarm</h2>
              <span className="kicker !text-[9px]">Nexus · bypilar</span>
            </div>
            <div className="mt-3">
              <SwarmPanel />
            </div>
          </section>

          <section className="card rise p-4" style={{ animationDelay: "0.2s" }}>
            <h2 className="display text-[15px] font-semibold">Biomarkers</h2>
            <div className="mt-3 space-y-2">
              {biomarkers.map((b) => (
                <div key={b.name} className="flex items-center justify-between text-[12px]">
                  <span>{b.name}</span>
                  <span className={`mono ${b.status === "warn" ? "text-clay" : "text-signal"}`}>
                    {b.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="card rise p-5">
          <h2 className="display text-[16px] font-semibold">3D mesh</h2>
          <div className="mt-3">
            <FootMesh3D />
          </div>
        </section>
        <section className="card rise p-5">
          <h2 className="display text-[16px] font-semibold">Session-log</h2>
          <div className="mt-3 space-y-1.5 mono text-[11px]">
            {codeLog.map((l) => (
              <div key={l.t} className="flex gap-2 border-b border-line/50 py-1.5 last:border-0">
                <span className="text-faint">{l.t}</span>
                <span className="text-muted">{l.lvl}</span>
                <span>{l.msg}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
