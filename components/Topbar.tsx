"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold text-paper"
        style={{ background: "#8a6a3d" }}
      >
        PM
      </button>
      {open && (
        <div className="card absolute right-0 top-12 z-50 w-[240px] overflow-hidden p-0 shadow-xl rise" style={{ animationDuration: "0.2s" }}>
          <div className="border-b border-line px-4 py-3">
            <div className="text-[13px] font-semibold">Pilar Mortensen</div>
            <div className="mono text-[10.5px] text-faint">pilar@bypilar.dk</div>
            <div className="mt-1.5 flex items-center gap-1">
              <span className="chip mono !text-[9px]">Ejer</span>
              <span className="chip mono !text-[9px]">2FA</span>
            </div>
          </div>
          <div className="px-1.5 py-1.5">
            <Link href="/indstillinger" onClick={() => setOpen(false)} className="block rounded-[7px] px-3 py-1.5 text-[12.5px] hover:bg-paper-2">Indstillinger</Link>
            <Link href="/admin/plan" onClick={() => setOpen(false)} className="block rounded-[7px] px-3 py-1.5 text-[12.5px] hover:bg-paper-2">Plan & fakturering</Link>
            <button className="block w-full text-left rounded-[7px] px-3 py-1.5 text-[12.5px] hover:bg-paper-2">Skift klinik</button>
            <div className="my-1 border-t border-line" />
            <button onClick={logout} className="block w-full text-left rounded-[7px] px-3 py-1.5 text-[12.5px] text-clay hover:bg-paper-2">Log ud</button>
          </div>
        </div>
      )}
    </div>
  );
}

const NAV = [
  { label: "Overblik", href: "/dashboard", hint: "Dashboard" },
  { label: "Kalender", href: "/kalender", hint: "Uge-kalender" },
  { label: "Klienter", href: "/klienter", hint: "Alle klienter" },
  { label: "Bookings", href: "/bookings", hint: "Booking-administration" },
  { label: "AI Scribe", href: "/scribe", hint: "Ambient samtale → journal" },
  { label: "Aria-agent", href: "/agent", hint: "Autonom booking-agent" },
  { label: "Fod-scan", href: "/scan", hint: "Physical AI" },
  { label: "Fod-scan · live", href: "/scan/start", hint: "Start nyt scan" },
  { label: "Felt-service", href: "/felt", hint: "Offline-first rute" },
  { label: "Tenants", href: "/admin/tenants", hint: "Multi-tenant control plane" },
  { label: "Ydelses-katalog", href: "/admin/services", hint: "Rediger ydelser" },
  { label: "Behandlere", href: "/admin/staff", hint: "Staff-mgmt" },
  { label: "Plan & fakturering", href: "/admin/plan", hint: "License + invoices" },
  { label: "Ny tenant", href: "/admin/new-tenant", hint: "Onboard ny klinik" },
  { label: "Indstillinger", href: "/indstillinger", hint: "Integrationer + compliance" },
  { label: "Review · start", href: "/review", hint: "Guided tour" },
];

const NOTIFICATIONS = [
  { id: "n1", icon: "🌙", title: "Aria håndterede 1 no-show-risiko", desc: "Per Sørensen bekræftet kl. 06:40", time: "1t siden", href: "/bookings/bk_a4", unread: true },
  { id: "n2", icon: "📅", title: "Ny booking · embed", desc: "Mette L. bookede 'Hudanalyse'", time: "3t siden", href: "/bookings/bk_a1", unread: true },
  { id: "n3", icon: "🤖", title: "AI-scribe udkast klar", desc: "Mette Lindqvist · godkendelse afventer", time: "I dag 08:55", href: "/scribe", unread: true },
  { id: "n4", icon: "💸", title: "Faktura betalt", desc: "INV-2026-06 · 1.098 kr", time: "I går", href: "/admin/plan", unread: false },
  { id: "n5", icon: "⚙️", title: "API · ny version udrullet", desc: "v1.2.4 · rate-limit hævet til 1000 req/min", time: "2 dage", href: "/indstillinger", unread: false },
];

export function Topbar() {
  const [openSearch, setOpenSearch] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Cmd+K → åbn søg
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpenSearch(true); }
      if (e.key === "Escape") { setOpenSearch(false); setOpenNotif(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = query.trim() === "" ? NAV : NAV.filter((n) =>
    n.label.toLowerCase().includes(query.toLowerCase()) ||
    n.hint.toLowerCase().includes(query.toLowerCase())
  );
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/85 px-7 py-3.5 backdrop-blur-md lg:px-10">
        <button
          onClick={() => setOpenSearch(true)}
          className="flex items-center gap-2.5 rounded-[10px] border border-line-2 bg-card px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-paper-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
          </svg>
          Søg eller spørg Aria…
          <kbd className="ml-2 rounded-[5px] border border-line-2 bg-paper px-1.5 py-0.5 mono text-[10px] text-faint">⌘K</kbd>
        </button>

        <div className="flex items-center gap-2.5">
          <span className="chip text-signal">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" />
            </svg>
            MitID verificeret
          </span>
          <span className="chip">
            <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
            GDPR · Art. 9
          </span>
          <button
            onClick={() => setOpenNotif(true)}
            className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-line-2 bg-card text-muted transition-colors hover:bg-paper-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 004 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-clay text-[9px] font-semibold text-paper">{unread}</span>
            )}
          </button>

          <UserMenu />
        </div>
      </header>

      {/* Search modal — Cmd+K */}
      {openSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 backdrop-blur-sm pt-[10vh] fade-in" onClick={() => setOpenSearch(false)}>
          <div className="card w-[560px] max-w-[92vw] overflow-hidden p-0 shadow-2xl rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="text-faint">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
              </svg>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results[0]) { router.push(results[0].href); setOpenSearch(false); }
                }}
                placeholder="Søg moduler, klienter, bookings… eller spørg Aria"
                className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
              <kbd className="rounded-[5px] border border-line-2 bg-paper px-1.5 py-0.5 mono text-[10px] text-faint">esc</kbd>
            </div>
            <div className="scrollbar-thin max-h-[420px] overflow-y-auto py-1.5">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12.5px] text-faint">Ingen resultater. Prøv «Aria, …» for at spørge AI-agenten.</div>
              ) : (
                results.map((r) => (
                  <button
                    key={r.href}
                    onClick={() => { router.push(r.href); setOpenSearch(false); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-paper-2"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-paper-2 text-[11px] font-semibold">›</span>
                    <span className="flex-1">
                      <span className="font-medium">{r.label}</span>
                      <span className="ml-2 text-[11.5px] text-faint">{r.hint}</span>
                    </span>
                    <span className="mono text-[10.5px] text-faint">{r.href}</span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-line bg-paper-2/60 px-4 py-2 text-[10.5px] text-faint">
              <span className="mono">↵ åbn</span><span className="mx-2">·</span><span className="mono">↑↓ naviger</span><span className="mx-2">·</span><span className="mono">esc luk</span>
            </div>
          </div>
        </div>
      )}

      {/* Notifications drawer */}
      {openNotif && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm fade-in" onClick={() => setOpenNotif(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-screen w-[400px] max-w-[92vw] flex-col bg-card shadow-2xl rise" style={{ animationDuration: "0.3s" }}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="display text-[17px] font-semibold">Notifikationer</h2>
              <button onClick={() => setOpenNotif(false)} className="grid h-8 w-8 place-items-center rounded-[8px] text-muted hover:bg-paper-2">×</button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto">
              {NOTIFICATIONS.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpenNotif(false)}
                  className={`flex gap-3 border-b border-line px-5 py-3.5 transition-colors hover:bg-paper-2 ${n.unread ? "bg-accent/[0.03]" : ""}`}
                >
                  <span className="mt-0.5 text-[16px]">{n.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold leading-tight">{n.title}</span>
                      {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-clay" />}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-muted">{n.desc}</div>
                    <div className="mt-1 mono text-[10px] text-faint">{n.time}</div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="border-t border-line px-5 py-3 text-center">
              <button className="text-[12px] text-accent hover:underline">Marker alle som læst</button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
