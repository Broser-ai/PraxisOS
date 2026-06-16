import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule, MODULES, CATEGORIES, isModuleActive } from "@/lib/modules";

export default async function ModuleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getModule(id);
  if (!m) notFound();

  const category = CATEGORIES.find((c) => c.id === m.category);
  const deps = m.dependsOn?.map((d) => getModule(d)).filter(Boolean) ?? [];
  const related = MODULES.filter((x) => x.category === m.category && x.id !== m.id).slice(0, 4);
  const isActive = isModuleActive("bypilar", m.id);

  const setupTimeLabel =
    m.setupTimeMin < 60 ? `${m.setupTimeMin} min` :
    m.setupTimeMin < 1440 ? `${Math.round(m.setupTimeMin / 60)} timer` :
    `${Math.round(m.setupTimeMin / 1440)} dage`;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="rise">
        <Link href="/admin/marketplace" className="kicker hover:underline">← Marketplace</Link>
      </div>

      {/* Hero */}
      <section className="card rise mt-3 overflow-hidden p-0">
        <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_300px]">
          <div className="p-7" style={{ background: `linear-gradient(135deg, ${m.iconColor}10, transparent)` }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: category?.color }}>{category?.label}</span>
              {m.popular && <span className="chip mono !text-[10px] !border-clay/40 text-clay">populær</span>}
              {m.enterprise && <span className="chip mono !text-[10px]">enterprise</span>}
              {isActive && <span className="chip mono !text-[10px] !border-signal/40 text-signal">● aktiv</span>}
            </div>

            <div className="mt-4 flex items-center gap-4">
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-[12px] text-paper"
                style={{ background: m.iconColor }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={m.icon} />
                </svg>
              </span>
              <div>
                <h1 className="display text-[28px] font-semibold leading-tight">{m.name}</h1>
                <div className="mt-1 text-[14px] text-muted">{m.tagline}</div>
              </div>
            </div>

            <p className="mt-5 text-[14px] leading-relaxed text-ink-soft">{m.description}</p>

            {m.agentRole && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-line bg-paper-2/60 px-3 py-2">
                <span className="text-[11px] text-muted">Drevet af</span>
                <Link href={`/admin/agents/${m.agentRole.toLowerCase()}`} className="text-[12px] font-semibold hover:underline">{m.agentRole}</Link>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="border-t border-line p-7 md:border-l md:border-t-0">
            <div className="kicker">Pris</div>
            <div className="mt-2 display text-[36px] font-semibold leading-none">
              {m.pricingModel === "volume" ? "0,50 kr" : m.pricingModel === "free" ? "Gratis" :
                m.pricingModel === "flat" ? m.priceMonthly.toLocaleString("da-DK") + " kr" :
                m.pricePerSeat.toLocaleString("da-DK") + " kr"}
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {m.pricingModel === "volume" ? "pr. transaktion" :
                m.pricingModel === "free" ? "altid gratis" :
                m.pricingModel === "flat" ? "fast pr. måned" :
                "pr. behandler / md"}
            </div>

            {m.trialDays > 0 && (
              <div className="mt-4 rounded-[8px] border border-signal/30 bg-signal/[0.06] p-2.5 text-[11px]">
                <div className="font-semibold text-signal">{m.trialDays} dages gratis prøveperiode</div>
                <div className="mt-0.5 text-muted">Ingen kortdata · slå fra når som helst</div>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-1.5 border-t border-line pt-4 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">Setup-tid</span>
                <span className="mono">{setupTimeLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tier</span>
                <span className="mono">{m.tier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Kategori</span>
                <span className="mono">{m.category}</span>
              </div>
            </div>

            {isActive ? (
              <button className="mt-5 w-full rounded-[10px] border border-clay/40 px-4 py-2.5 text-[13px] font-medium text-clay">
                Slå modul fra
              </button>
            ) : m.enterprise ? (
              <Link href={`/admin/marketplace/${m.id}/activate`} className="mt-5 block w-full rounded-[10px] bg-ink px-4 py-2.5 text-center text-[13px] font-medium text-paper">
                Kontakt salg →
              </Link>
            ) : (
              <Link href={`/admin/marketplace/${m.id}/activate`} className="mt-5 block w-full rounded-[10px] bg-ink px-4 py-2.5 text-center text-[13px] font-medium text-paper">
                Aktivér · start prøveperiode
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="card rise mt-3 p-5">
        <h2 className="display text-[17px] font-semibold">Funktioner</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {m.features.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-[10px] border border-line bg-paper p-3">
              <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-signal/14 text-signal text-[10px]">✓</span>
              <span className="text-[12.5px]">{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Dependencies */}
      {deps.length > 0 && (
        <section className="card rise mt-3 p-5">
          <h2 className="display text-[17px] font-semibold">Afhænger af</h2>
          <p className="mt-1 text-[12px] text-muted">Disse moduler skal være aktive før {m.shortName} kan bruges.</p>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            {deps.map((d) => (
              <Link key={d!.id} href={`/admin/marketplace/${d!.id}`} className="flex items-center gap-3 rounded-[10px] border border-line bg-paper p-3 transition-colors hover:bg-paper-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-paper" style={{ background: d!.iconColor }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={d!.icon} />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium">{d!.shortName}</div>
                  <div className="text-[10px] text-muted truncate">{d!.tagline}</div>
                </div>
                {isModuleActive("bypilar", d!.id) && <span className="text-[10px] text-signal">●</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Related */}
      <section className="card rise mt-3 p-5">
        <h2 className="display text-[17px] font-semibold">Andre {category?.label}-moduler</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          {related.map((r) => (
            <Link key={r.id} href={`/admin/marketplace/${r.id}`} className="flex items-center gap-3 rounded-[10px] border border-line bg-paper p-3 transition-colors hover:bg-paper-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] text-paper" style={{ background: r.iconColor }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={r.icon} />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium">{r.shortName}</div>
                <div className="text-[10.5px] text-muted truncate">{r.tagline}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
