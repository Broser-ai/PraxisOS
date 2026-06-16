const integrations = [
  ["MitID", "eID-login & signering", true],
  ["Stripe", "Betaling (EU)", true],
  ["Dinero / e-conomic", "Regnskab", true],
  ["MedCom", "Sundhedsdata-udveksling", true],
  ["Google Calendar", "Kalender-sync", true],
  ["Fod-scanner hardware", "Struktureret lys + plantar pad", true],
  ["Termisk kamera", "8-14μm IR · vaskulær/inflammation", true],
  ["HF Ultralyd-probe", "Vaskulær screening · forfod", false],
  ["Nabla", "AI-scribe (EU)", false],
  ["App Marketplace", "Tredjeparts-apps via åben API", false],
];

export default function Indstillinger() {
  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise">
        <div className="kicker">Platform</div>
        <h1 className="display mt-2 text-[30px] font-semibold leading-none">Indstillinger</h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <section className="card rise p-5" style={{ animationDelay: "0.06s" }}>
          <h2 className="display text-[16px] font-semibold">Integrationer & connectors</h2>
          <p className="mt-1 text-[13px] text-muted">Alt bundlet — ingen à-la-carte-gebyrer.</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {integrations.map(([name, desc, on]) => (
              <div key={name as string} className="flex items-center gap-3 rounded-[11px] border border-line bg-paper p-3">
                <div className="grid h-9 w-9 place-items-center rounded-[9px] bg-paper-2 text-[11px] font-semibold">{(name as string).slice(0, 2)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{name}</div>
                  <div className="truncate text-[11.5px] text-faint">{desc}</div>
                </div>
                <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${on ? "bg-signal" : "bg-line-2"}`}>
                  <span className={`block h-4 w-4 rounded-full bg-paper transition-transform ${on ? "translate-x-4" : ""}`} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card rise p-5" style={{ animationDelay: "0.12s" }}>
          <h2 className="display text-[16px] font-semibold">Compliance</h2>
          <div className="mt-4 flex flex-col gap-3">
            {[
              ["Data-region", "EU · Frankfurt"],
              ["GDPR Art. 9", "Særlige kategorier · aktiv"],
              ["Revisions-log", "Fuld sporbarhed"],
              ["AI-træning på data", "Fra"],
              ["Opbevaring", "Pr. journal-regler"],
            ].map(([a, b]) => (
              <div key={a} className="flex items-center justify-between border-t border-line pt-3 first:border-t-0 first:pt-0">
                <span className="text-[13px] text-muted">{a}</span>
                <span className="flex items-center gap-1.5 text-[13px] font-medium"><span className="h-1.5 w-1.5 rounded-full bg-signal" />{b}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
