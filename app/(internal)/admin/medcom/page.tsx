import Link from "next/link";

type Direction = "in" | "out";
type MedComType = "henvisning" | "epikrise" | "afregning" | "lab-svar" | "korrespondance";

const MESSAGES: { id: string; dir: Direction; type: MedComType; from: string; to: string; patient: string; at: string; status: string }[] = [
  { id: "mc_001", dir: "in",  type: "henvisning",    from: "Aarhus Lægehus · læge Pedersen",     to: "by Pilar",    patient: "Per Sørensen",     at: "i dag 09:12", status: "modtaget" },
  { id: "mc_002", dir: "out", type: "epikrise",      from: "by Pilar",                            to: "Aarhus Lægehus", patient: "Mette Lindqvist",   at: "i dag 08:30", status: "kvitteret" },
  { id: "mc_003", dir: "out", type: "afregning",     from: "by Pilar",                            to: "Region Midtjylland", patient: "Per Sørensen",  at: "i går 16:45", status: "kvitteret" },
  { id: "mc_004", dir: "in",  type: "lab-svar",      from: "Hospitalsenhed Midt",                 to: "by Pilar",    patient: "Amira Haddad",      at: "i går 14:22", status: "modtaget · venter på vurdering" },
  { id: "mc_005", dir: "out", type: "korrespondance", from: "by Pilar",                           to: "Lægehus Vest", patient: "Clara Winther",     at: "2 dage", status: "kvitteret" },
  { id: "mc_006", dir: "in",  type: "henvisning",    from: "Speciallæge Olsen",                   to: "by Pilar",    patient: "Ny patient · CPR-Match påkrævet", at: "3 dage", status: "afventer onboarding" },
];

const TYPE_LABEL: Record<MedComType, string> = {
  henvisning: "Henvisning",
  epikrise: "Epikrise",
  afregning: "Afregning",
  "lab-svar": "Laboratorie-svar",
  korrespondance: "Korrespondance",
};

const TYPE_COLOR: Record<MedComType, string> = {
  henvisning: "var(--color-accent)",
  epikrise: "var(--color-signal)",
  afregning: "var(--color-amber)",
  "lab-svar": "var(--color-clay)",
  korrespondance: "var(--color-faint)",
};

export default function MedComPage() {
  const inbox = MESSAGES.filter((m) => m.dir === "in");
  const sent = MESSAGES.filter((m) => m.dir === "out");

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">MedCom</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Sundhedsdatanettet · journal-udveksling mellem læger, hospitaler og specialister · drevet af Sigrid.
          </p>
        </div>
        <button className="btn btn-primary">+ Ny besked</button>
      </div>

      {/* Stats */}
      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Indbakke · 30d" value={inbox.length.toString()} sub="henvisninger + svar" />
        <Stat label="Sendte · 30d" value={sent.length.toString()} sub="epikriser + afregning" />
        <Stat label="Auto-kvitteret" value="100%" sub="ack-DK02 · alle" color="var(--color-signal)" />
        <Stat label="Ventende behandling" value="2" sub="kræver vurdering" color="var(--color-amber)" highlight />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Inbox */}
        <section className="card p-5">
          <h2 className="display text-[17px] font-semibold">📥 Indbakke</h2>
          <div className="mt-4 flex flex-col">
            {inbox.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[9.5px] font-medium"
                      style={{ background: `color-mix(in srgb, ${TYPE_COLOR[m.type]} 14%, transparent)`, color: TYPE_COLOR[m.type] }}
                    >
                      {TYPE_LABEL[m.type]}
                    </span>
                    <span className="text-[12px] font-medium">{m.patient}</span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted">fra · <b>{m.from}</b></div>
                  <div className="mt-0.5 mono text-[10px] text-faint">{m.id} · {m.at}</div>
                </div>
                <span className="text-[10.5px] text-faint self-start">{m.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Sent */}
        <section className="card p-5">
          <h2 className="display text-[17px] font-semibold">📤 Sendte</h2>
          <div className="mt-4 flex flex-col">
            {sent.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[9.5px] font-medium"
                      style={{ background: `color-mix(in srgb, ${TYPE_COLOR[m.type]} 14%, transparent)`, color: TYPE_COLOR[m.type] }}
                    >
                      {TYPE_LABEL[m.type]}
                    </span>
                    <span className="text-[12px] font-medium">{m.patient}</span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted">til · <b>{m.to}</b></div>
                  <div className="mt-0.5 mono text-[10px] text-faint">{m.id} · {m.at}</div>
                </div>
                <span className="text-[10.5px] text-signal self-start">● {m.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Protokol-info */}
      <section className="card rise mt-3 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="kicker mb-1">Protokol</div>
            <div className="mono text-[12px]">MedCom XML · afr01, hen13, epi05</div>
          </div>
          <div>
            <div className="kicker mb-1">Transport</div>
            <div className="mono text-[12px]">VANS · Sundhedsdatanettet · EAN-routing</div>
          </div>
          <div>
            <div className="kicker mb-1">Ack-niveau</div>
            <div className="mono text-[12px]">DK-02 · semantisk kvittering</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, color, highlight }: { label: string; value: string; sub?: string; color?: string; highlight?: boolean }) {
  return (
    <div className="card p-3" style={highlight && color ? { borderColor: color, background: `color-mix(in srgb, ${color} 5%, var(--color-card))` } : {}}>
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-1 display text-[20px] font-semibold leading-none" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="mono text-[10px] text-faint">{sub}</div>}
    </div>
  );
}
