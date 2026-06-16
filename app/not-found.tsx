import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="max-w-[440px] text-center">
        <div className="mono text-[11px] tracking-[0.2em] text-faint">404 · NOT FOUND</div>
        <h1 className="display mt-3 text-[44px] font-semibold leading-tight">
          Den side findes ikke
        </h1>
        <p className="mt-4 text-[14px] text-ink-soft">
          Måske er du fulgt en gammel link, eller siden er flyttet. Du kan komme tilbage til forsiden eller logge ind.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2">
          <Link href="/" className="rounded-[10px] bg-ink px-4 py-2.5 text-[13px] font-medium text-paper">
            ← Forside
          </Link>
          <Link href="/review" className="rounded-[10px] border border-line bg-card px-4 py-2.5 text-[13px]">
            Til min klinik
          </Link>
        </div>
      </div>
    </div>
  );
}
