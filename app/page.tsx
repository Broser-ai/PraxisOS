import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/MarketingNav";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />

      <section className="mx-auto max-w-[1100px] px-6 pt-20 pb-16 text-center">
        <span className="chip mono !text-[10px] !border-amber/30 text-amber">● Live · EU-data · GDPR Art. 9</span>
        <h1 className="display mt-5 text-[52px] font-semibold leading-[1.05] tracking-tight md:text-[68px]">
          Klinikkens operativsystem<br />
          <span className="text-clay">til fodplejere.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[660px] text-[16px] leading-relaxed text-ink-soft">
          Booking, journal, klippekort, sygesikringsafregning og AI-agenter — én EU-compliant platform
          med MitID, MedCom og DAWA på plads fra dag ét. Dine kunder ser dit brand.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup?plan=practice" className="rounded-[12px] bg-ink px-5 py-3 text-[14px] font-medium text-paper hover:opacity-90">
            Start gratis trial · 30 dage
          </Link>
          <Link href="/funktioner" className="rounded-[12px] border border-line bg-card px-5 py-3 text-[14px] hover:bg-paper-2">
            Se funktioner →
          </Link>
        </div>
        <p className="mt-5 kicker !text-[10px]">B2B-licens · fodpleje &amp; fodterapeut · data i EU</p>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 pb-20">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card
            kicker="Multi-tenant native"
            title="Hver klinik er fuldt isoleret"
            body="Row-Level Security i Postgres garanterer at tenant-data aldrig krydser. Sælg som SaaS eller white-label dit eget brand."
          />
          <Card
            kicker="9 humaniserede agenter"
            title="Aria, Niels, Sigrid og 6 andre"
            body="AI-receptionist, AI-scribe, sygesikrings-engine, no-show prediktor, compliance, jura. Hver med navn, stemme og grænser."
          />
          <Card
            kicker="DK-stack færdig"
            title="MitID · MedCom · FMK · DAWA · CVR"
            body="Vi har bygget alle integrationerne. Du behøver ikke en udvikler for at gå live."
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 pb-20">
        <div className="text-center">
          <div className="kicker">Modul-marketplace</div>
          <h2 className="display mt-2 text-[34px] font-semibold">Køb kun det du bruger</h2>
          <p className="mt-3 text-[14px] text-muted">20 moduler · 7 kategorier · alt fra 0 til 1.495 kr/md per modul</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-4">
          {MODULES.map((m) => (
            <div key={m.name} className="card p-4">
              <div className="kicker !text-[9.5px]">{m.kategori}</div>
              <div className="mt-1 text-[13.5px] font-semibold">{m.name}</div>
              <div className="mt-1 mono text-[11px] text-faint">{m.pris}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/funktioner" className="text-[13px] text-clay hover:underline">
            Se alle funktioner &amp; licenser →
          </Link>
        </div>
      </section>

      <section className="border-t border-line bg-paper-2/40">
        <div className="mx-auto max-w-[800px] px-6 py-16 text-center">
          <h2 className="display text-[32px] font-semibold">Klar til at prøve?</h2>
          <p className="mt-3 text-[14px] text-muted">
            30 dages gratis trial · ingen kortoplysninger · opsætning på få minutter.
          </p>
          <Link href="/signup?plan=practice" className="mt-6 inline-block rounded-[12px] bg-ink px-6 py-3.5 text-[14px] font-medium text-paper hover:opacity-90">
            Opret din klinik
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function Card({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="card p-5">
      <div className="kicker">{kicker}</div>
      <div className="mt-2 display text-[18px] font-semibold leading-snug">{title}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

const MODULES = [
  { kategori: "Core", name: "Booking", pris: "fra 0 kr/md" },
  { kategori: "Core", name: "Journal", pris: "295 kr/md" },
  { kategori: "Core", name: "Betaling", pris: "1,45% + 0,50 kr" },
  { kategori: "AI", name: "Aria · receptionist", pris: "495 kr/md" },
  { kategori: "AI", name: "Niels · AI-scribe", pris: "kr 3 per session" },
  { kategori: "AI", name: "Sigrid · tilskud", pris: "295 kr/md" },
  { kategori: "AI", name: "Frej · sikkerhed", pris: "inkl." },
  { kategori: "DK", name: "MitID", pris: "kr 0,80/login" },
  { kategori: "DK", name: "MedCom", pris: "195 kr/md" },
  { kategori: "DK", name: "FMK", pris: "via Sundhedsdatanettet" },
  { kategori: "Marketing", name: "NemSMS", pris: "kr 0,18/sms" },
  { kategori: "Felt", name: "Hjemmebesøg", pris: "245 kr/md" },
];
