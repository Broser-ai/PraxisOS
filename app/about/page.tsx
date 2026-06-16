import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[800px] items-center justify-between px-6 py-4">
          <Link href="/" className="display text-[16px] font-semibold">PraxisOS</Link>
          <nav className="flex items-center gap-5 text-[13px]">
            <Link href="/pricing" className="text-ink-soft hover:text-ink">Priser</Link>
            <Link href="/login" className="text-ink-soft hover:text-ink">Log ind</Link>
            <Link href="/signup" className="rounded-[10px] bg-ink px-3.5 py-1.5 text-paper">Start gratis</Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-[680px] px-6 py-16">
        <span className="kicker">Manifesto</span>
        <h1 className="display mt-2 text-[42px] font-semibold leading-tight">
          Behandlere skal behandle. Ikke administrere.
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
          PraxisOS er klinikkens operativsystem — bygget i Danmark for dansk sundhedsvæsen.
          Vi har 9 humaniserede AI-agenter som tager sig af det administrative arbejde,
          så du kan fokusere på det du faktisk er uddannet til.
        </p>

        <h2 className="display mt-12 text-[22px] font-semibold">Hvorfor PraxisOS</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Eksisterende systemer er bygget før AI og før MitID. De er låst, dyre, og kræver
          ofte en konsulent for at gå live. Vi har bygget det modsatte:
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-[13.5px] text-ink-soft">
          <li>· DK-stack færdig: MitID, MedCom, FMK, DAWA, CVR fra dag ét</li>
          <li>· AI-agenterne har navne, stemmer og grænser — ikke en chatbot</li>
          <li>· Multi-tenant fra bunden af · RLS-isolation som garanti</li>
          <li>· EU-data · Frankfurt · GDPR Art. 9 compliant</li>
          <li>· Modul-baseret — du betaler kun for det du bruger</li>
        </ul>

        <h2 className="display mt-12 text-[22px] font-semibold">Bygget med pilot-klinikker</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          by Pilar i Aarhus var vores første pilot-kunde. Hver feature er bygget mens
          Pilar Mortensen sad ved siden af og pegede på hvad der irriterede hende. Trial-kunder
          får alt gratis i pilot-perioden — vi tjener pengene når platformen tjener dig.
        </p>

        <h2 className="display mt-12 text-[22px] font-semibold">Kontakt</h2>
        <p className="mt-3 text-[14px] text-ink-soft">
          PraxisOS ApS · København · CVR 99887766<br />
          E-mail: <span className="mono">ma@keap.me</span>
        </p>

        <div className="mt-12 border-t border-line pt-6 text-center">
          <Link href="/signup" className="inline-block rounded-[12px] bg-ink px-6 py-3 text-[14px] font-medium text-paper">
            Start din 30-dages trial
          </Link>
        </div>
      </article>
    </div>
  );
}
