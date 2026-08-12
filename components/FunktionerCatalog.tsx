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
  // Simple category-tinted mark — same silhouette language as marketing
  const paths: Record<B2bCategoryId, string> = {
    kerne: "M12 3v18M3 12h18",
    klient: "M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM4 20a5 5 0 0110 0M14 20a5 5 0 019 0",
    betaling: "M3 8h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm0 0V6a2 2 0 012-2h14a2 2 0 012 2v2",
    tilbud: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z",
    team: "M9 11a3 3 0 100-6 3 3 0 000 6zM17 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM4 20a5 5 0 0110 0M14.5 20a4 4 0 017 0",
    sikkerhed: "M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z",
    sundhed: "M12 21s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 11c0 5.5-7 10-7 10z",
    ai: "M12 2a4 4 0 014 4v1h1a3 3 0 010 6h-1v1a4 4 0 01-8 0v-1H7a3 3 0 010-6h1V6a4 4 0 014-4z",
    integrationer: "M8 8h8v8H8zM4 12h4M16 12h4M12 4v4M12 16v4",
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
      <FeatureIcon categoryId={feature.categoryId} />
      <h3 className="display mt-4 text-[20px] font-semibold leading-snug text-ink">{feature.title}</h3>
      <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-soft">{feature.summary}</p>
      {feature.planHint && (
        <div className="mt-3 text-[11.5px] text-faint">{feature.planHint}</div>
      )}
      <Link
        href={`/funktioner/${feature.slug}`}
        className="mt-5 inline-flex w-fit items-center rounded-[10px] bg-ink px-3.5 py-2 text-[13px] font-medium text-paper transition-opacity hover:opacity-90"
      >
        Læs mere →
      </Link>
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <FeatureCard key={f.slug} feature={f} />
          ))}
        </div>
        {features.length === 0 && (
          <p className="py-16 text-center text-[14px] text-muted">Ingen funktioner i denne kategori endnu.</p>
        )}
      </section>
    </div>
  );
}
