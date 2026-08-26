import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/MarketingNav";
import { formatPlanPrice, PLANS } from "@/lib/plans";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />

      <section className="mx-auto max-w-[1100px] px-6 pt-20 pb-16 text-center">
        <span className="chip mono !text-[10px] !border-amber/30 text-amber">
          ● B2B licens · EU-data · GDPR Art. 9
        </span>
        <h1 className="display mt-5 text-[52px] font-semibold leading-[1.05] tracking-tight md:text-[68px]">
          PraxisOS til fodplejere.
          <br />
          <span className="text-clay">Licens. Setup. Live.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[660px] text-[16px] leading-relaxed text-ink-soft">
          Køb licens til booking, journal, klippekort, AI og DK-compliance. White-label udadtil — jeres
          kunder ser kun jeres brand.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup?plan=practice"
            className="rounded-[12px] bg-ink px-5 py-3 text-[14px] font-medium text-paper hover:opacity-90"
          >
            Køb licens · 30 dages trial
          </Link>
          <Link
            href="/funktioner"
            className="rounded-[12px] border border-line bg-card px-5 py-3 text-[14px] hover:bg-paper-2"
          >
            Se funktioner →
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-paper-2/35">
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-3 px-6 py-14 md:grid-cols-4">
          {PLANS.map((p) => (
            <Link
              key={p.id}
              href={`/signup?plan=${p.id}`}
              className="rounded-[14px] border border-line bg-card p-5 transition-colors hover:border-ink/30"
            >
              <div className="display text-[18px] font-semibold">{p.name}</div>
              <div className="mt-2 text-[22px] font-semibold">
                {formatPlanPrice(p)}
                <span className="text-[12px] font-normal text-muted">/md</span>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">{p.tagline}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[900px] px-6 py-16 text-center">
        <h2 className="display text-[32px] font-semibold">Fra signup til live klinik</h2>
        <p className="mx-auto mt-3 max-w-[520px] text-[14px] text-muted">
          CVR → plan → tenant → setup → aktiver licens. Samme flow som I sælger til andre fodplejere.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/pricing" className="rounded-[12px] border border-line px-5 py-3 text-[14px]">
            Se priser
          </Link>
          <Link
            href="/demo/bypilar-website"
            className="rounded-[12px] border border-line px-5 py-3 text-[14px]"
          >
            Live demo · by Pilar
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
