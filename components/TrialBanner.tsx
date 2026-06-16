import { getTenant } from "@/lib/tenants";

/**
 * Trial-banner — vises kun for tenants markeret med trial.unlimited.
 * by Pilar kører gratis indtil PraxisOS er commerciel.
 */
export function TrialBanner({ slug }: { slug: string }) {
  const t = getTenant(slug);
  if (!t?.trial?.unlimited) return null;

  return (
    <div className="card mb-3 flex items-center justify-between gap-3 border-amber/30 bg-amber/[0.06] px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-amber/20 text-[11px] font-semibold text-amber">★</span>
        <div className="leading-tight">
          <div className="text-[12.5px] font-medium">
            Trial · alt inkluderet · {t.brand.name}
          </div>
          <div className="kicker !text-[9.5px] mt-0.5">
            Pilot-kunde · 0 kr/md · alle moduler aktive · ingen platform-fee
          </div>
        </div>
      </div>
      <span className="mono text-[10px] text-faint">siden {t.trial.since}</span>
    </div>
  );
}
