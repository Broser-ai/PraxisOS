import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenant } from "@/lib/tenants";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) notFound();

  // CSS-variabel-injektion gør at samme komponenter "ser ud" som tenant'en
  const themeVars: Record<string, string> = {
    "--brand-paper": t.brand.paper,
    "--brand-ink": t.brand.ink,
    "--brand-accent": t.brand.accent,
    "--brand-primary": t.brand.primary,
  };

  return (
    <div style={themeVars as React.CSSProperties} className="min-h-screen" >
      <div className="min-h-screen" style={{ background: "var(--brand-paper)", color: "var(--brand-ink)" }}>
        <header className="border-b border-line/60 px-6 py-4">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between">
            <Link href={`/t/${t.slug}`} className="flex items-center gap-3">
              <div
                className="grid h-9 w-9 place-items-center rounded-full text-[14px] font-semibold"
                style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
              >
                {t.brand.name.charAt(0)}
              </div>
              <div className="leading-tight">
                <div className="display text-[18px] font-semibold">{t.brand.name}</div>
                <div className="kicker !text-[9px]">{t.brand.tagline}</div>
              </div>
            </Link>
            <nav className="hidden items-center gap-6 text-[13px] md:flex">
              <Link href={`/t/${t.slug}`} className="hover:underline">Ydelser</Link>
              <Link href={`/t/${t.slug}/book`} className="hover:underline">Book tid</Link>
              <Link href={`/t/${t.slug}/klippekort`} className="hover:underline">Klippekort</Link>
              <Link href={`/t/${t.slug}/gavekort`} className="hover:underline">Gavekort</Link>
              <Link href={`/t/${t.slug}/portal`} className="hover:underline">Min side</Link>
              <Link href={`/t/${t.slug}/onboarding`} className="hover:underline">Bliv kunde</Link>
            </nav>
            <Link
              href={`/t/${t.slug}/book`}
              className="rounded-[10px] px-4 py-2 text-[13px] font-medium"
              style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
            >
              Book tid
            </Link>
          </div>
        </header>
        <main className="px-6 py-10">{children}</main>
        <footer className="mt-16 border-t border-line/60 px-6 py-6">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted">
            <div>© {t.brand.name} · {t.contact.address}{t.contact.cvr ? ` · CVR ${t.contact.cvr}` : ""}</div>
            <div className="mono">{t.contact.email} · {t.contact.phone}</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
