import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/MarketingNav";
import { formatPlanPrice, PLANS } from "@/lib/plans";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav active="pricing" />

      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-12 text-center">
        <div className="kicker">B2B licens · fodplejere</div>
        <h1 className="display mt-3 text-[44px] font-semibold">Priser der vokser med klinikken</h1>
        <p className="mx-auto mt-4 max-w-[600px] text-[14px] text-ink-soft">
          30 dages trial. Ingen kort ved oprettelse. Aktiver betalt licens når I er klar — jeres kunder ser kun jeres brand.
        </p>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.id} className={`card flex flex-col p-5 ${p.highlighted ? "border-ink/40 bg-paper-2/40" : ""}`}>
              {p.highlighted && <div className="kicker text-clay">Mest populær</div>}
              <div className="display text-[20px] font-semibold">{p.name}</div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="display text-[32px] font-semibold">{formatPlanPrice(p)}</span>
                <span className="text-[11.5px] text-faint">{p.periodLabel}</span>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">{p.tagline}</p>
              <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-[12.5px]">
                {p.features.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-signal">✓</span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/signup?plan=${p.id}`}
                className={`mt-6 block rounded-[10px] px-4 py-2.5 text-center text-[13px] font-medium ${
                  p.highlighted ? "bg-ink text-paper" : "border border-line bg-card"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-[13px] text-muted">
          Se alle funktioner på{" "}
          <Link href="/funktioner" className="underline underline-offset-2 hover:text-ink">
            /funktioner
          </Link>
          . Enterprise / white-label:{" "}
          <a href="mailto:ma@keap.me" className="underline underline-offset-2 hover:text-ink">
            kontakt salg
          </a>
          .
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
