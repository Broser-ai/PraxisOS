import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/MarketingNav";

const PLANS = [
  {
    name: "Starter",
    price: "0 kr",
    period: "/md · trial 30 dage",
    desc: "Til solister og pilot-test.",
    items: ["Booking", "Journal", "1 staff-seat", "200 bookings/md", "PraxisOS Pay 1,75%"],
    cta: "Start gratis",
    href: "/signup?plan=starter",
    feature: false,
  },
  {
    name: "Practice",
    price: "595 kr",
    period: "/md",
    desc: "Til fodplejeklinikker med 1-3 behandlere.",
    items: ["Alt i Starter", "3 staff-seats", "Ubegrænsede bookings", "MitID-login", "Klippekort & gavekort", "PraxisOS Pay 1,45%"],
    cta: "Vælg Practice",
    href: "/signup?plan=practice",
    feature: true,
  },
  {
    name: "Practice + AI",
    price: "1.295 kr",
    period: "/md",
    desc: "Practice + Aria, Niels og Sigrid.",
    items: ["Alt i Practice", "Aria · AI-receptionist", "Niels · AI-scribe", "Sigrid · sygesikring", "MedCom-afregning", "No-show prediktor"],
    cta: "Vælg Practice + AI",
    href: "/signup?plan=practice-ai",
    feature: false,
  },
  {
    name: "Enterprise",
    price: "tilbud",
    period: "·",
    desc: "White-label, headless, custom-SLA.",
    items: ["Alt i Practice + AI", "Eget domæne + brand", "Custom-SLA", "Dedikeret onboarding", "Indberetning til alle DK-myndigheder"],
    cta: "Kontakt os",
    href: "mailto:ma@keap.me?subject=PraxisOS%20Enterprise",
    feature: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav active="pricing" />

      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-12 text-center">
        <div className="kicker">B2B · licens</div>
        <h1 className="display mt-3 text-[44px] font-semibold">Priser der vokser med dig</h1>
        <p className="mx-auto mt-4 max-w-[600px] text-[14px] text-ink-soft">
          Licens til fodplejere og fodterapeuter. Alle planer indeholder DK-stack (MitID, MedCom, DAWA, CVR).
          Se også <Link href="/funktioner" className="text-clay hover:underline">funktioner</Link>.
        </p>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.name} className={`card p-5 ${p.feature ? "border-ink/40 bg-paper-2/40" : ""}`}>
              {p.feature && <div className="kicker text-clay">Mest populær</div>}
              <div className="display text-[20px] font-semibold">{p.name}</div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="display text-[32px] font-semibold">{p.price}</span>
                <span className="text-[11.5px] text-faint">{p.period}</span>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">{p.desc}</p>
              <ul className="mt-4 flex flex-col gap-1.5 text-[12.5px]">
                {p.items.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-signal/20 text-[8px] text-signal">✓</span>
                    {i}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={`mt-5 block w-full rounded-[10px] px-4 py-2.5 text-center text-[13px] font-medium ${p.feature ? "bg-ink text-paper" : "border border-line bg-card hover:bg-paper-2"}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-[14px] border border-line bg-paper-2/40 p-6">
          <h3 className="display text-[18px] font-semibold">Plus · per-brug på toppen</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[12.5px] md:grid-cols-4">
            <Row label="MitID login" value="0,80 kr" />
            <Row label="NemSMS udsendelse" value="0,18 kr" />
            <Row label="MedCom EDI-besked" value="0,95 kr" />
            <Row label="AI Scribe · session" value="3,00 kr" />
            <Row label="PraxisOS Pay · transaktion" value="1,45% + 0,50 kr" />
            <Row label="Fod-scan analyse" value="12 kr" />
            <Row label="Klippekort · ingen ekstra" value="inkluderet" />
            <Row label="DAWA · adresser" value="inkluderet" />
          </div>
        </div>

        <div className="mt-6 text-center text-[11.5px] text-faint">
          Pilot-kunder · trial-klinikker betaler 0 kr i deres pilot-periode. Spørg om vilkår på ma@keap.me.
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[8px] border border-line bg-card px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}
