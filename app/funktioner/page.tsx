import Link from "next/link";
import type { Metadata } from "next";
import { MarketingFooter, MarketingNav } from "@/components/MarketingNav";
import {
  B2B_FEATURE_GROUPS,
  B2B_HIGHLIGHTS,
  formatModulePrice,
  modulesForGroup,
} from "@/lib/b2b-catalog";

export const metadata: Metadata = {
  title: "Funktioner — PraxisOS til fodplejere",
  description:
    "Booking, journal, klippekort, betaling, AI og DK-compliance. PraxisOS er klinikkens operativsystem til fodplejere og fodterapeuter.",
};

export default function FunktionerPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav active="funktioner" />

      <section className="mx-auto max-w-[1100px] px-6 pt-16 pb-10">
        <div className="kicker">B2B · licens til fodplejere</div>
        <h1 className="display mt-3 max-w-[820px] text-[40px] font-semibold leading-[1.08] md:text-[52px]">
          Funktioner til effektiv klinikdrift —{" "}
          <em className="text-clay">bygget til fodpleje</em>
        </h1>
        <p className="mt-5 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
          PraxisOS samler booking, klienter, journal, betaling, klippekort og DK-integrationer ét sted.
          Du køber en licens til din klinik — dine kunder ser kun dit brand.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup?plan=practice"
            className="rounded-[12px] bg-ink px-5 py-3 text-[14px] font-medium text-paper hover:opacity-90"
          >
            Start gratis trial · 30 dage
          </Link>
          <Link
            href="/pricing"
            className="rounded-[12px] border border-line bg-card px-5 py-3 text-[14px] hover:bg-paper-2"
          >
            Se licenspriser →
          </Link>
          <a
            href="mailto:ma@keap.me?subject=PraxisOS%20B2B%20demo"
            className="rounded-[12px] border border-line px-5 py-3 text-[14px] text-ink-soft hover:text-ink"
          >
            Book demo
          </a>
        </div>
      </section>

      {/* Highlights */}
      <section className="border-y border-line bg-paper-2/35">
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-3 px-6 py-12 sm:grid-cols-2 lg:grid-cols-3">
          {B2B_HIGHLIGHTS.map((h) => (
            <div key={h.title} className="rounded-[14px] border border-line bg-card p-5">
              <h2 className="display text-[18px] font-semibold">{h.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{h.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Jump nav */}
      <section className="mx-auto max-w-[1100px] px-6 pt-10">
        <div className="kicker mb-3">Kategorier</div>
        <div className="flex flex-wrap gap-2">
          {B2B_FEATURE_GROUPS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="rounded-[999px] border border-line bg-card px-3.5 py-1.5 text-[12.5px] text-ink-soft hover:border-ink/30 hover:text-ink"
            >
              {g.label}
            </a>
          ))}
        </div>
      </section>

      {/* Feature groups */}
      <div className="mx-auto max-w-[1100px] space-y-16 px-6 py-14">
        {B2B_FEATURE_GROUPS.map((group) => {
          const modules = modulesForGroup(group);
          return (
            <section key={group.id} id={group.id} className="scroll-mt-24">
              <div className="max-w-[640px]">
                <h2 className="display text-[28px] font-semibold md:text-[32px]">{group.label}</h2>
                <p className="mt-2 text-[14px] text-muted">{group.description}</p>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                {modules.map((m) => (
                  <article
                    key={`${group.id}-${m.id}`}
                    className="rounded-[14px] border border-line bg-card p-5 transition-colors hover:border-ink/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="kicker !text-[9.5px]">{m.shortName}</div>
                        <h3 className="display mt-1 text-[20px] font-semibold leading-tight">{m.name}</h3>
                        <p className="mt-1 text-[12.5px] text-muted">{m.tagline}</p>
                      </div>
                      <div className="shrink-0 rounded-[8px] border border-line bg-paper-2 px-2.5 py-1 mono text-[11px]">
                        {formatModulePrice(m)}
                      </div>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{m.description}</p>
                    <ul className="mt-4 space-y-1.5">
                      {m.features.slice(0, 5).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[12.5px]">
                          <span className="mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-signal/20 text-[8px] text-signal">
                            ✓
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-[11.5px] text-faint">
                      <span>Opsætning ≈ {m.setupTimeMin} min</span>
                      {m.trialDays > 0 && <span>· Trial {m.trialDays} dage</span>}
                      {m.popular && <span className="text-clay">· Populær</span>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Licens CTA */}
      <section className="border-t border-line bg-ink text-paper">
        <div className="mx-auto max-w-[900px] px-6 py-16 text-center">
          <div className="kicker !text-paper/55">Licens</div>
          <h2 className="display mt-3 text-[34px] font-semibold">
            Køb PraxisOS til din fodplejeklinik
          </h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[14px] text-paper/70">
            Start med Practice (595 kr/md) eller Practice + AI (1.295 kr/md). Tilkøb moduler efter behov.
            30 dages gratis trial — ingen kortoplysninger.
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
