import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingNav } from "@/components/MarketingNav";
import {
  B2B_FEATURES,
  categoryLabel,
  featureBySlug,
} from "@/lib/b2b-catalog";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return B2B_FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const feature = featureBySlug(slug);
  if (!feature) return { title: "Funktion" };
  return {
    title: `${feature.title} — PraxisOS`,
    description: feature.summary,
  };
}

export default async function FunktionDetailPage({ params }: Props) {
  const { slug } = await params;
  const feature = featureBySlug(slug);
  if (!feature) notFound();

  const related = B2B_FEATURES.filter(
    (f) => f.categoryId === feature.categoryId && f.slug !== feature.slug,
  ).slice(0, 3);

  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav active="funktioner" />

      <article className="mx-auto max-w-[760px] px-6 pt-12 pb-16">
        <Link href="/funktioner" className="text-[13px] text-ink-soft hover:text-ink">
          ← Alle funktioner
        </Link>
        <div className="kicker mt-6">{categoryLabel(feature.categoryId)}</div>
        <h1 className="display mt-2 text-[40px] font-semibold leading-tight md:text-[46px]">
          {feature.title}
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">{feature.summary}</p>
        {feature.planHint && (
          <div className="mt-4 inline-block rounded-[8px] border border-line bg-paper-2 px-3 py-1.5 text-[12px] text-muted">
            {feature.planHint}
          </div>
        )}

        <div className="mt-10 space-y-4">
          {feature.body.map((p) => (
            <p key={p.slice(0, 40)} className="text-[15px] leading-relaxed text-ink">
              {p}
            </p>
          ))}
        </div>

        <ul className="mt-8 space-y-2.5 rounded-[14px] border border-line bg-card p-6">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[14px]">
              <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-signal/20 text-[9px] text-signal">
                ✓
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/signup?plan=practice"
            className="rounded-[12px] bg-ink px-5 py-3 text-[14px] font-medium text-paper hover:opacity-90"
          >
            Start gratis trial
          </Link>
          <Link
            href="/pricing"
            className="rounded-[12px] border border-line px-5 py-3 text-[14px] hover:bg-paper-2"
          >
            Se priser
          </Link>
        </div>

        {related.length > 0 && (
          <section className="mt-16 border-t border-line pt-10">
            <h2 className="display text-[22px] font-semibold">Relateret i samme kategori</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/funktioner/${r.slug}`}
                  className="rounded-[12px] border border-line bg-card p-4 transition-colors hover:border-ink/25"
                >
                  <div className="display text-[15px] font-semibold">{r.title}</div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-muted line-clamp-3">{r.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <MarketingFooter />
    </div>
  );
}
