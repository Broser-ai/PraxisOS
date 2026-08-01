"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clinic, practitioner } from "@/lib/mock";

const nav = [
  { href: "/review", label: "Review · start", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
  { href: "/dashboard", label: "Overblik", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/kalender", label: "Kalender", icon: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4" },
  { href: "/klienter", label: "Klienter", icon: "M4 20a6 6 0 0112 0M16 12a3 3 0 100-6M20 20a5 5 0 00-4-4.9M10 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" },
  { href: "/bookings", label: "Bookings", icon: "M4 6h16M4 12h16M4 18h16M9 6v12" },
  { href: "/scribe", label: "AI Scribe", icon: "M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3" },
  { href: "/agent", label: "AI-agent", icon: "M5 4h14v11H8l-3 3zM9 9h.01M13 9h.01" },
  { href: "/chat", label: "Samlet chat · team", icon: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" },
  { href: "/scan", label: "Fod-scan", icon: "M9 2c-2 0-3 2-3 5 0 2 1 3 1 5s-1 4-1 6c0 2 1 4 3 4s3-2 3-4-1-2-1-4c0-3 1-5 1-7 0-3-1-5-3-5z" },
];

const secondary = [
  { href: "/admin/tenants", label: "Tenants", icon: "M4 21V11l8-6 8 6v10M9 21v-7h6v7" },
  { href: "/admin/payments", label: "PraxisOS Pay", icon: "M3 8h18M3 8V6a2 2 0 012-2h14a2 2 0 012 2v2M3 8v10a2 2 0 002 2h14a2 2 0 002-2V8M7 14h2M13 14h4" },
  { href: "/admin/vouchers", label: "Klippekort/gavekort", icon: "M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.3 7l8.7 5 8.7-5M12 22V12" },
  { href: "/admin/subsidies", label: "Tilskudsordninger", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { href: "/admin/reporting", label: "Indberetning", icon: "M3 3v18h18M7 17l4-4 4 4 6-6" },
  { href: "/admin/api", label: "Universal API", icon: "M4 16l-3-3 3-3M20 8l3 3-3 3M14 4l-4 16" },
  { href: "/admin/nemsms", label: "NemSMS", icon: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" },
  { href: "/admin/agents", label: "Agent-team", icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" },
  { href: "/admin/swarm", label: "S-H Swarm · 24/7", icon: "M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" },
  { href: "/admin/research", label: "Alphaxiv Research", icon: "M4 19V5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2zM13 3v6h6" },
  { href: "/admin/sundhed-dk", label: "Sundhed.dk", icon: "M22 11.08V12a10 10 0 11-5.93-9.14M22 4l-10 10-3-3" },
  { href: "/admin/medcom", label: "MedCom", icon: "M4 4h16v16H4zM4 9h16M9 4v16" },
  { href: "/admin/mcp", label: "MCP-server", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { href: "/admin/marketplace", label: "Modul-marketplace", icon: "M4 8h16M4 16h16M9 4v16M15 4v16" },
  { href: "/admin/dk-data", label: "DK Data · DAWA/MitID", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10" },
  { href: "/admin/database", label: "Database · Supabase EU", icon: "M4 6c0-1.7 4-3 8-3s8 1.3 8 3v12c0 1.7-4 3-8 3s-8-1.3-8-3zM4 6v6c0 1.7 4 3 8 3s8-1.3 8-3V6" },
  { href: "/admin/security", label: "Sikkerhed & adgang", icon: "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" },
  { href: "/admin/health", label: "System-status", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  { href: "/felt", label: "Felt-service", icon: "M3 7l9-4 9 4-9 4-9-4zM3 7v6l9 4 9-4V7" },
  { href: "/indstillinger", label: "Indstillinger", icon: "M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3l-.4-2.6h-3.8l-.4 2.6a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6A7 7 0 005 12" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function Sidebar() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r border-line bg-paper-2/60 px-4 py-5 md:flex">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-2">
        <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-ink text-paper">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 3v18M3 12h18" opacity="0.35" />
            <circle cx="12" cy="12" r="4.4" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="display text-[17px] font-semibold">PraxisOS</div>
          <div className="kicker !text-[9.5px]">Clinical OS</div>
        </div>
      </div>

      <nav className="mt-7 flex flex-col gap-0.5">
        {nav.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] transition-colors ${
                active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2"
              }`}
            >
              <span className={active ? "text-paper" : "text-faint group-hover:text-ink"}>
                <Icon d={n.icon} />
              </span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 px-3">
        <div className="kicker">Drift</div>
      </div>
      <nav className="mt-2 flex flex-col gap-0.5">
        {secondary.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] transition-colors ${
              isActive(n.href) ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2"
            }`}
          >
            <span className={isActive(n.href) ? "text-paper" : "text-faint group-hover:text-ink"}>
              <Icon d={n.icon} />
            </span>
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="mb-3 rounded-[11px] border border-line bg-card px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            <span className="kicker !text-[9px]">Data-region</span>
          </div>
          <div className="mt-1 mono text-[11px] text-muted">{clinic.region}</div>
        </div>
        <div className="flex items-center gap-2.5 rounded-[11px] px-1 py-1">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/12 text-[12px] font-semibold text-accent">
            {practitioner.initials}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-medium">{practitioner.name}</div>
            <div className="truncate text-[11px] text-faint">{clinic.name}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
