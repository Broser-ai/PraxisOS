"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type TimelineStep = {
  id: string;
  label: string;
  desc: string;
  status: "done" | "active" | "queued";
  at?: string;
  color: string;
};

export default function BookingStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [steps, setSteps] = useState<TimelineStep[]>([
    { id: "created",   label: "Booking oprettet",      desc: "Booking registreret i PraxisOS",                          status: "done",   at: "kl. 10:42:08", color: "var(--color-signal)" },
    { id: "confirm",   label: "Bekræftelse sendt",     desc: "E-mail + SMS afsendt til klient",                         status: "done",   at: "kl. 10:42:10", color: "var(--color-signal)" },
    { id: "payment",   label: "Betaling reserveret",   desc: "PraxisOS Pay · MobilePay · auth_only",                    status: "done",   at: "kl. 10:42:14", color: "var(--color-signal)" },
    { id: "subsidy",   label: "Tilskud beregnet",      desc: "Diabetes-tilskud · −495 kr · 100% dækning",               status: "done",   at: "kl. 10:42:15", color: "var(--color-signal)" },
    { id: "report",    label: "Indberetning genereret", desc: "KOMBIT-API payload klar til afsendelse",                  status: "active", color: "var(--color-accent)" },
    { id: "send",      label: "Sendt til myndighed",   desc: "Aarhus Kommune · sundhedsforvaltning",                    status: "queued", color: "var(--color-amber)" },
    { id: "ack",       label: "Kvittering modtaget",   desc: "Myndighed har godkendt refusion",                         status: "queued", color: "var(--color-amber)" },
    { id: "payout",    label: "Refusion til klinik",   desc: "Udbetales via NemKonto · D+2 bankdage",                   status: "queued", color: "var(--color-amber)" },
  ]);

  // Animer flow gennem trinene
  useEffect(() => {
    let i = 4; // start fra "report" step
    const timer = setInterval(() => {
      setSteps((prev) => {
        const next = [...prev];
        if (i < next.length) {
          next[i] = { ...next[i], status: "done", at: `kl. 10:42:${(20 + i * 7).toString().padStart(2, "0")}` };
          if (i + 1 < next.length) next[i + 1] = { ...next[i + 1], status: "active" };
          i++;
        } else {
          clearInterval(timer);
        }
        return next;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[680px] px-6 py-10">
        <Link href={`/r/${id}`} className="kicker hover:underline">← Tilbage til kvittering</Link>
        <h1 className="display mt-3 text-[28px] font-semibold leading-tight">Status · indberetning og refusion</h1>
        <p className="mt-2 text-[13px] text-muted">
          Følg din booking gennem hele forløbet · tilskud beregnes og indberettes automatisk.
        </p>

        <div className="mt-7 inline-flex items-center gap-2 rounded-[10px] border border-line bg-card px-3 py-1.5 mono text-[12px]">
          <span>Booking</span>
          <span className="text-faint">·</span>
          <span className="font-semibold">{id}</span>
        </div>

        <div className="mt-8 flex flex-col">
          {steps.map((s, i) => (
            <div key={s.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Rail */}
              <div className="flex flex-col items-center">
                <div
                  className="grid h-8 w-8 place-items-center rounded-full transition-all"
                  style={{
                    background: s.status === "done" ? s.color : s.status === "active" ? "var(--color-card)" : "var(--color-paper-2)",
                    border: s.status === "active" ? `2px solid ${s.color}` : "none",
                    color: s.status === "done" ? "var(--color-paper)" : s.color,
                  }}
                >
                  {s.status === "done" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
                  ) : s.status === "active" ? (
                    <span className="h-2 w-2 rounded-full bg-current live-dot" />
                  ) : (
                    <span className="mono text-[10px]">{i + 1}</span>
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="w-px flex-1 mt-1 mb-1"
                    style={{ background: s.status === "done" ? s.color : "var(--color-line)" }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pb-2">
                <div className="flex items-baseline gap-2">
                  <span className={`text-[14px] font-semibold ${s.status === "queued" ? "text-faint" : ""}`}>{s.label}</span>
                  {s.at && <span className="mono text-[10.5px] text-faint">{s.at}</span>}
                </div>
                <div className={`mt-0.5 text-[12.5px] ${s.status === "queued" ? "text-faint" : "text-muted"}`}>{s.desc}</div>

                {/* Live for aktive trin */}
                {s.status === "active" && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: s.color }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current live-dot" />
                    Behandles nu…
                  </div>
                )}

                {/* Detaljer ved bestemte trin */}
                {s.id === "subsidy" && s.status === "done" && (
                  <div className="mt-2 inline-block rounded-[8px] border border-signal/30 bg-signal/[0.06] px-2.5 py-1.5 text-[11px]">
                    Ordning: <b>Diabetes-tilskud · Aarhus Kommune</b><br/>
                    Beløb: <span className="mono">−495 kr</span> · diagnose <code className="mono">E11.9</code> verificeret
                  </div>
                )}
                {s.id === "ack" && s.status === "done" && (
                  <div className="mt-2 inline-block rounded-[8px] border border-signal/30 bg-signal/[0.06] px-2.5 py-1.5 mono text-[10.5px]">
                    Kvittering-ref: <b>AAR-2026-DIA-22041</b>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Sammenfatning */}
        <div className="mt-6 rounded-[12px] border border-line bg-card p-5">
          <div className="kicker">Sammenfatning</div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
            <Row label="Behandling">Medicinsk fodpleje</Row>
            <Row label="Pris">495 kr</Row>
            <Row label="Du betaler"><span className="text-signal font-semibold">0 kr</span></Row>
            <Row label="Tilskud"><span className="mono">−495 kr</span></Row>
            <Row label="Indberettet til">Aarhus Kommune</Row>
            <Row label="Forventet refusion">14. juni</Row>
          </div>
        </div>

        <div className="mt-6 text-center text-[10.5px] text-faint">
          ⚡ drevet af PraxisOS · indberetning sker via KOMBIT-API · EU-data · GDPR Art. 9
        </div>
      </div>
    </div>
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
