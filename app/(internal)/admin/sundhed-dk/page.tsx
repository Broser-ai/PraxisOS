import Link from "next/link";

export default function SundhedDkPage() {
  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Sundhed.dk · federation</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Single sign-on med den nationale sundhedsfederation · FMK-bro · MedCom-identitet · trustaftale med Sundhedsdatastyrelsen.
          </p>
        </div>
        <span className="chip mono !text-[10px] !border-amber/40 text-amber">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" /> trustaftale afventer
        </span>
      </div>

      {/* Status-overview */}
      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Trust-status" value="Under godkendelse" color="var(--color-amber)" />
        <Stat label="FMK-adgang" value="Ikke aktiveret" color="var(--color-faint)" />
        <Stat label="Sundhedsdatanettet" value="Ja · MedCom" color="var(--color-signal)" />
        <Stat label="Federation-broker" value="Signaturgruppen" mono />
      </div>

      {/* Trustaftale-flow */}
      <section className="card rise mt-3 p-6">
        <div className="kicker">Trustaftale med Sundhedsdatastyrelsen</div>
        <h2 className="display mt-1.5 text-[18px] font-semibold">5-trins onboarding · ca. 6 uger</h2>

        <div className="mt-5 flex flex-col">
          {[
            { n: 1, label: "Ledelses-erklæring via nspop.dk", status: "done",  at: "godkendt 12. maj" },
            { n: 2, label: "Sikkerheds-audit (ISO 27001-light)", status: "done",  at: "godkendt 28. maj" },
            { n: 3, label: "Teknisk integration mod Sundhedsdatanettet (NSP)", status: "active", at: "i gang" },
            { n: 4, label: "Pen-test + sårbarheds-vurdering", status: "queued", at: "planlagt 20. juni" },
            { n: 5, label: "Endelig godkendelse + signering", status: "queued", at: "forventet 1. juli" },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold"
                style={{
                  background: s.status === "done" ? "var(--color-signal)" : s.status === "active" ? "var(--color-accent)" : "var(--color-paper-2)",
                  color: s.status === "queued" ? "var(--color-muted)" : "var(--color-paper)",
                }}
              >
                {s.status === "done" ? "✓" : s.n}
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-medium">{s.label}</div>
                <div className="mono text-[10.5px] text-faint">{s.at}</div>
              </div>
              {s.status === "active" && <span className="chip mono !text-[10px] !border-accent/40 text-accent">i gang</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Forventede capabilities */}
      <section className="card rise mt-3 p-5">
        <h2 className="display text-[17px] font-semibold">Hvad vi får adgang til efter godkendelse</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {([
            ["FMK · Fælles Medicinkort", "Opslag i patientens medicinering · krav om aktiv behandlings-relation", true],
            ["Sundhed.dk SSO", "Patient logger ind én gang og kan se journal hos flere klinikker", true],
            ["MedCom · Sygesikringsafregning", "EDI/XML-baseret elektronisk afregning · automatiseret af Sigrid", true],
            ["Min Log på sundhed.dk", "Vores audit-events vises i patientens nationale log", true],
            ["FMK-recept", "Vi kan skrive recepter til apotek · Premium add-on", false],
            ["LPR3 · Landspatientregister", "Anonymiseret rapportering · forskningsbrug", false],
          ] as const).map(([title, desc, included]) => (
            <div key={title} className="flex items-start gap-3 rounded-[10px] border border-line bg-paper p-3">
              <span className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] ${included ? "bg-signal/14 text-signal" : "bg-paper-2 text-faint"}`}>
                {included ? "✓" : "+"}
              </span>
              <div className="flex-1">
                <div className="text-[12.5px] font-medium">{title}</div>
                <div className="text-[11px] text-muted mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div className="card p-3">
      <div className="kicker !text-[9px]">{label}</div>
      <div className={`mt-1 ${mono ? "mono" : ""} text-[13px] font-semibold`} style={color ? { color } : {}}>{value}</div>
    </div>
  );
}
