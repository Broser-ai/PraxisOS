import Link from "next/link";

type NavKey = "funktioner" | "pricing" | "about";

const LINKS: { href: string; label: string; key: NavKey }[] = [
  { href: "/funktioner", label: "Funktioner", key: "funktioner" },
  { href: "/pricing", label: "Priser", key: "pricing" },
  { href: "/about", label: "Om", key: "about" },
];

export function MarketingNav({ active }: { active?: NavKey }) {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-[8px] bg-ink text-paper">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v18M3 12h18" opacity="0.35" />
              <circle cx="12" cy="12" r="4.4" />
            </svg>
          </div>
          <span className="display text-[16px] font-semibold">PraxisOS</span>
        </Link>
        <nav className="flex items-center gap-5 text-[13px]">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={active === l.key ? "font-medium text-ink" : "text-ink-soft hover:text-ink"}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="hidden text-ink-soft hover:text-ink sm:inline">
            Log ind
          </Link>
          <Link href="/signup" className="rounded-[10px] bg-ink px-3.5 py-1.5 text-paper hover:opacity-90">
            Start gratis
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-8 text-[12px] text-muted">
        <div>
          <span className="display text-[14px] font-semibold text-ink">PraxisOS</span>
          <span className="ml-2">· Klinikkens operativsystem til fodplejere</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href="/funktioner" className="hover:text-ink">Funktioner</Link>
          <Link href="/pricing" className="hover:text-ink">Priser</Link>
          <Link href="/signup" className="hover:text-ink">Opret klinik</Link>
          <a href="mailto:ma@keap.me" className="hover:text-ink">Kontakt salg</a>
        </div>
      </div>
    </footer>
  );
}
