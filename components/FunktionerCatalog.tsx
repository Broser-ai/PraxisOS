"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  B2B_CATEGORIES,
  B2B_FEATURES,
  type B2bCategoryId,
  type B2bFeature,
} from "@/lib/b2b-catalog";

type TabId = B2bCategoryId | "alle";

const TABS: { id: TabId; label: string }[] = [
  { id: "alle", label: "Alle" },
  ...B2B_CATEGORIES,
];

function FeatureIcon({ categoryId }: { categoryId: B2bCategoryId }) {
  const paths: Record<B2bCategoryId, string> = {
    klinik: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4",
    klient: "M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM4 20a5 5 0 0110 0M14 20a5 5 0 019 0",
    betaling: "M3 8h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm0 0V6a2 2 0 012-2h14a2 2 0 012 2v2",
    klinisk: "M9 2c-2 0-3 2-3 5 0 2 1 3 1 5s-1 4-1 6c0 2 1 4 3 4s3-2 3-4-1-2-1-4c0-3 1-5 1-7 0-3-1-5-3-5z",
    ai: "M5 4h14v11H8l-3 3zM9 9h.01M13 9h.01",
    compliance: "M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z",
    drift: "M3 7l9-4 9 4-9 4-9-4zM3 7v6l9 4 9-4V7",
    platform: "M4 16l-3-3 3-3M20 8l3 3-3 3M14 4l-4 16",
  };
  return (
    <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-ink text-paper">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d={paths[categoryId]} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function FeatureCard({ feature }: { feature: B2bFeature }) {
  return (
    <article className="flex flex-col rounded-[14px] border border-line bg-card p-6 shadow-[0_8px_24px_rgba(20,18,16,0.04)] transition-transform duration-300 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <FeatureIcon categoryId={feature.categoryId} />
        <span
          className={
            feature.status === "live"
              ? "rounded-[6px] bg-signal/15 px-2 py-0.5 text-[10px] font-medium text-signal"
              : "rounded-[6px] bg-paper-2 px-2 py-0.5 text-[10px] font-medium text-muted"
          }
        >
          {feature.status === "live" ? "I produktet" : "Prototype"}
        </span>
      </div>
      <h3 className="display mt-4 text-[20px] font-semibold leading-snug text-ink">{feature.title}</h3>
      <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-soft">{feature.summary}</p>
      {feature.planHint && <div className="mt-3 text-[11.5px] text-faint">{feature.planHint}</div>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/funktioner/${feature.slug}`}
          className="inline-flex items-center rounded-[10px] bg-ink px-3.5 py-2 text-[13px] font-medium text-paper transition-opacity hover:opacity-90"
        >
          Læs mere →
        </Link>
        <Link
          href={feature.demoHref}
          className="inline-flex items-center rounded-[10px] border border-line px-3.5 py-2 text-[13px] text-ink-soft hover:border-ink/30 hover:text-ink"
        >
          Åbn i PraxisOS
        </Link>
      </div>
    </article>
  );
}

export function FunktionerCatalog({ initialCategory = "alle" }: { initialCategory?: TabId }) {
  const [active, setActive] = useState<TabId>(initialCategory);

  const features = useMemo(() => {
    if (active === "alle") return B2B_FEATURES;
    return B2B_FEATURES.filter((f) => f.categoryId === active);
  }, [active]);

  return (
    <div>
      <div className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-[1100px] px-6">
          <div className="flex gap-1 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => {
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActive(tab.id)}
                  className={
                    isActive
                      ? "shrink-0 border-b-2 border-ink px-3 py-2 text-[13px] font-medium text-ink"
                      : "shrink-0 border-b-2 border-transparent px-3 py-2 text-[13px] text-ink-soft hover:text-ink"
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1100px] px-6 py-10">
        <p className="mb-6 max-w-[640px] text-[13px] text-muted">
          Funktionerne herunder er dem, der allerede ligger i PraxisOS — samme skærme som på{" "}
          <Link href="/review" className="underline underline-offset-2 hover:text-ink">
            /review
          </Link>
          . Klik «Åbn i PraxisOS» for at se dem live.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <FeatureCard key={f.slug} feature={f} />
          ))}
        </div>
        {features.length === 0 && (
          <p className="py-16 text-center text-[14px] text-muted">Ingen funktioner i denne kategori.</p>
        )}
      </section>
    </div>
  );
}
