import Link from "next/link";
import type { Metadata } from "next";
import { FunktionerCatalog } from "@/components/FunktionerCatalog";
import { MarketingFooter, MarketingNav } from "@/components/MarketingNav";

export const metadata: Metadata = {
  title: "Funktioner — PraxisOS til fodplejere",
  description:
    "Booking, journal, klippekort, betaling, AI og DK-compliance. Se alle PraxisOS-funktioner til fodpleje-klinikker.",
};

export default function FunktionerPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav active="funktioner" />

      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(900px 420px at 12% -10%, color-mix(in oklab, var(--color-clay) 28%, transparent), transparent 70%), radial-gradient(700px 380px at 88% 0%, color-mix(in oklab, var(--color-signal) 18%, transparent), transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-[1100px] px-6 pt-14 pb-12">
          <div className="kicker">PraxisOS · B2B licens</div>
          <h1 className="display mt-3 max-w-[820px] text-[40px] font-semibold leading-[1.08] md:text-[52px]">
            Funktioner til din fodplejeklinik
          </h1>
          <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
            Vælg licens og tilkøb — dine kunder ser kun dit brand. Bygget til booking, journal, klippekort og DK-krav.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/signup?plan=practice"
              className="rounded-[12px] bg-ink px-5 py-3 text-[14px] font-medium text-paper hover:opacity-90"
            >
              Få gratis konto · 30 dage
            </Link>
            <Link
              href="/pricing"
              className="rounded-[12px] border border-line bg-card px-5 py-3 text-[14px] hover:bg-paper-2"
            >
              Se priser
            </Link>
          </div>
        </div>
      </section>

      <FunktionerCatalog />

      <section className="border-t border-line bg-paper-2/40">
        <div className="mx-auto grid max-w-[1100px] gap-10 px-6 py-14 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="display text-[28px] font-semibold">Har du brug for en mere avanceret integration?</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
              Med det åbne API kan du eller din udvikler bygge egne koblinger — booking, klienter og ydelser på tværs af systemer.
            </p>
          </div>
          <div className="space-y-5">
            <div>
              <h3 className="display text-[17px] font-semibold">Udvid PraxisOS via API</h3>
              <p className="mt-1.5 text-[13.5px] text-muted">
                Systemet er åbnet, så klinikker og partnere kan bygge ovenpå — uden at miste white-label udadtil.
              </p>
            </div>
            <div>
              <h3 className="display text-[17px] font-semibold">Løbende endpoints</h3>
              <p className="mt-1.5 text-[13.5px] text-muted">
                Vi udvider API’et løbende. Skriv til salg hvis du mangler et specifikt endpoint til din fodplejeklinik.
              </p>
            </div>
            <Link
              href="/funktioner/aabent-api"
              className="inline-flex rounded-[10px] border border-line bg-card px-4 py-2.5 text-[13px] font-medium hover:bg-paper"
            >
              Læs om API →
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-ink text-paper">
        <div className="mx-auto max-w-[900px] px-6 py-16 text-center">
          <div className="kicker !text-paper/55">Licens</div>
          <h2 className="display mt-3 text-[34px] font-semibold">Klar til at køre klinikken i PraxisOS?</h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[14px] text-paper/70">
            30 dages gratis trial. Ingen kortoplysninger. Dine klienter ser dit brand.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup?plan=practice"
              className="rounded-[12px] bg-paper px-5 py-3 text-[14px] font-medium text-ink hover:opacity-95"
            >
              Opret klinik
            </Link>
            <Link
              href="/pricing"
              className="rounded-[12px] border border-paper/25 px-5 py-3 text-[14px] text-paper/90 hover:bg-paper/10"
            >
              Sammenlign planer
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
