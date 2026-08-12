import Link from "next/link";
import type { Metadata } from "next";
import { ShopClient } from "@/components/ShopClient";

export const metadata: Metadata = {
  title: "B2B shop — creme & udstyr · PraxisOS",
  description:
    "Engros webshop til fodplejere: creme, olie, forbrugsmateriale og klinikudstyr.",
};

export default function B2bShopPage() {
  return (
    <div className="min-h-screen bg-paper">
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
            <Link href="/shop" className="font-medium text-ink">
              Shop
            </Link>
            <Link href="/pricing" className="text-ink-soft hover:text-ink">
              Licens
            </Link>
            <Link href="/signup" className="rounded-[10px] bg-ink px-3.5 py-1.5 text-paper hover:opacity-90">
              Start gratis
            </Link>
          </nav>
        </div>
      </header>

      <main className="px-6 py-10">
        <ShopClient
          channel="b2b"
          tenant="praxisos"
          brandName="PraxisOS"
          homeHref="/"
          accentStyle="ink"
        />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-8 text-[12px] text-muted">
          <div>
            <span className="display text-[14px] font-semibold text-ink">PraxisOS</span>
            <span className="ml-2">· B2B shop til fodplejeklinikker</span>
          </div>
          <Link href="/signup" className="hover:text-ink">
            Opret klinik-licens
          </Link>
        </div>
      </footer>
    </div>
  );
}
