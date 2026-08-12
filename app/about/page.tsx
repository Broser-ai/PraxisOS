import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/MarketingNav";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav active="about" />

      <article className="mx-auto max-w-[680px] px-6 py-16">
        <span className="kicker">Manifesto</span>
        <h1 className="display mt-2 text-[42px] font-semibold leading-tight">
          Behandlere skal behandle. Ikke administrere.
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
          PraxisOS er klinikkens operativsystem — bygget i Danmark for fodplejere, fodterapeuter
          og beslægtede klinikker. AI-agenter tager det administrative, så du kan fokusere på behandling.
        </p>

        <h2 className="display mt-12 text-[22px] font-semibold">Hvorfor PraxisOS</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Eksisterende systemer er bygget før AI og før MitID. De er låst, dyre, og kræver
          ofte en konsulent for at gå live. Vi har bygget det modsatte:
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-[13.5px] text-ink-soft">
          <li>· DK-stack færdig: MitID, MedCom, FMK, DAWA, CVR fra dag ét</li>
          <li>· AI-agenterne har navne, stemmer og grænser — ikke en chatbot</li>
          <li>· Multi-tenant fra bunden · RLS-isolation som garanti</li>
          <li>· White-label: dine kunder ser dit brand, ikke vores</li>
          <li>· Modul-baseret — du betaler kun for det du bruger</li>
        </ul>

        <h2 className="display mt-12 text-[22px] font-semibold">Bygget med pilot-klinikker</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          by Pilar i Aarhus var vores første pilot-kunde. Hver feature er bygget mens
          klinikken pegede på hvad der irriterede dem. Trial-kunder får alt gratis i
          pilot-perioden — vi tjener pengene når platformen tjener dig.
        </p>

        <h2 className="display mt-12 text-[22px] font-semibold">Kontakt</h2>
        <p className="mt-3 text-[14px] text-ink-soft">
          PraxisOS · B2B-licens til fodplejeklinikker<br />
          E-mail: <span className="mono">ma@keap.me</span>
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-3 border-t border-line pt-6">
          <Link href="/funktioner" className="inline-block rounded-[12px] border border-line px-6 py-3 text-[14px]">
            Se funktioner
          </Link>
          <Link href="/signup?plan=practice" className="inline-block rounded-[12px] bg-ink px-6 py-3 text-[14px] font-medium text-paper">
            Start din 30-dages trial
          </Link>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}
