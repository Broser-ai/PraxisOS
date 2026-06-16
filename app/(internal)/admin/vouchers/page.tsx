"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { listVouchers, listClipPackages, fmtBalance, type Voucher, type VoucherKind } from "@/lib/vouchers";
import { listTenants } from "@/lib/tenants";

export default function VouchersAdmin() {
  const tenants = listTenants();
  const [activeTenant, setActiveTenant] = useState(tenants[0].slug);
  const [kind, setKind] = useState<VoucherKind | "all">("all");
  const [search, setSearch] = useState("");

  const all = listVouchers({ tenant: activeTenant });
  const packages = listClipPackages(activeTenant);

  const filtered = useMemo(() => {
    return all.filter((v) => {
      if (kind !== "all" && v.kind !== kind) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!v.code.toLowerCase().includes(q) &&
            !v.buyer.name.toLowerCase().includes(q) &&
            !(v.recipient?.name.toLowerCase().includes(q)) &&
            !(v.serviceName?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [all, kind, search]);

  const stats = {
    activeClips: all.filter((v) => v.kind === "clip" && v.status === "active").length,
    activeGifts: all.filter((v) => v.kind === "gift" && v.status === "active").length,
    outstandingGiftKr: all
      .filter((v) => v.kind === "gift" && v.status === "active")
      .reduce((s, v) => s + (v.balanceOere ?? 0) / 100, 0),
    sessionsRemaining: all
      .filter((v) => v.kind === "clip" && v.status === "active")
      .reduce((s, v) => s + (v.sessionsRemaining ?? 0), 0),
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Klippekort & gavekort</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Forudbetalte vouchers · klippekort med rabat på pakker, gavekort med 3 års udløb iht. dansk lov.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost">+ Sælg gavekort</button>
          <button className="btn btn-primary">+ Sælg klippekort</button>
        </div>
      </div>

      {/* Tenant-vælger */}
      <div className="rise mt-6 flex flex-wrap gap-2">
        {tenants.map((t) => (
          <button
            key={t.slug}
            onClick={() => setActiveTenant(t.slug)}
            className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2"
            style={{
              borderColor: activeTenant === t.slug ? "var(--color-ink)" : "var(--color-line-2)",
              background: activeTenant === t.slug ? "var(--color-paper-2)" : "var(--color-card)",
            }}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold" style={{ background: t.brand.ink, color: t.brand.paper }}>
              {t.brand.name.charAt(0)}
            </span>
            <span className="text-[13px] font-medium">{t.brand.name}</span>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="rise mt-3 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        <Stat label="Aktive klippekort" value={stats.activeClips.toString()} sub={`${stats.sessionsRemaining} sessioner tilbage`} />
        <Stat label="Aktive gavekort" value={stats.activeGifts.toString()} sub={`${stats.outstandingGiftKr.toLocaleString("da-DK")} kr ude i markedet`} />
        <Stat label="Pakker · katalog" value={packages.length.toString()} sub="opret nye herunder" />
        <Stat label="Indløsninger · 30 dage" value="14" sub="snit 392 kr" />
      </div>

      {/* Klippekort-pakker */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.08s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Klippekort-pakker · katalog</h2>
          <button className="btn btn-ghost !py-1.5 !text-[11.5px]">+ Ny pakke</button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {packages.map((p) => (
            <div
              key={p.id}
              className="card p-3.5"
              style={p.highlighted ? { borderColor: "color-mix(in srgb, var(--color-accent) 40%, transparent)" } : {}}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="kicker !text-[9px]">{p.serviceName}</div>
                  <div className="display mt-1 text-[22px] font-semibold leading-none">{p.sessions}<span className="ml-1 text-[12px] font-normal text-muted">sessioner</span></div>
                </div>
                {p.highlighted && <span className="chip mono !text-[9px]">populær</span>}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="display text-[18px] font-semibold">{p.priceKr.toLocaleString("da-DK")} kr</span>
                <span className="text-[10.5px] text-faint line-through">{p.faceValueKr} kr</span>
              </div>
              <div className="mt-1 mono text-[10.5px] text-signal">−{p.discountPct}% rabat</div>
              <div className="mt-3 border-t border-line pt-2 text-[10.5px] text-muted">
                Udløber efter {p.expiryMonths} mdr.
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Liste */}
      <div className="rise mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-[10px] border border-line-2 bg-card p-0.5 text-[12px]">
          {[["all","Alle"],["clip","Klippekort"],["gift","Gavekort"]].map(([k,label]) => (
            <button
              key={k}
              onClick={() => setKind(k as any)}
              className="rounded-[8px] px-3 py-1.5"
              style={{
                background: kind === k ? "var(--color-ink)" : "transparent",
                color: kind === k ? "var(--color-paper)" : "var(--color-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg kode, navn, ydelse…"
          className="ml-auto w-[280px] rounded-[10px] border border-line-2 bg-card px-3 py-2 text-[13px] outline-none focus:border-ink"
        />
      </div>

      <div className="card rise mt-3 overflow-hidden" style={{ animationDelay: "0.12s" }}>
        <div className="hidden grid-cols-[160px_120px_1fr_140px_140px_100px_60px] gap-3 border-b border-line bg-paper-2/50 px-5 py-2.5 lg:grid">
          {["Kode", "Type", "Indhold", "Saldo / sessioner", "Køber → modtager", "Udløber", ""].map((h) => (
            <div key={h} className="kicker">{h}</div>
          ))}
        </div>
        {filtered.map((v) => (
          <Link
            key={v.id}
            href={`/admin/vouchers/${v.code}`}
            className="grid grid-cols-1 gap-3 border-t border-line px-5 py-3.5 transition-colors first:border-t-0 hover:bg-paper-2 lg:grid-cols-[160px_120px_1fr_140px_140px_100px_60px] lg:items-center"
          >
            <span className="mono text-[12px] font-semibold">{v.code}</span>
            <span>
              <span className={`chip !py-0 ${v.kind === "clip" ? "!border-accent/40 text-accent" : "!border-clay/40 text-clay"}`}>
                {v.kind === "clip" ? "Klippekort" : "Gavekort"}
              </span>
            </span>
            <span className="text-[12.5px] text-ink-soft">
              {v.kind === "clip" ? v.serviceName : "Beløb · enhver ydelse"}
            </span>
            <span className="mono text-[12px]">{fmtBalance(v)}</span>
            <span className="text-[11.5px]">
              <div className="truncate font-medium">{v.buyer.name}</div>
              {v.recipient && <div className="truncate text-faint">→ {v.recipient.name}</div>}
            </span>
            <span className="mono text-[11px] text-faint">
              {new Date(v.expiresAt).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="hidden text-right text-faint lg:block">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="inline"><path d="M9 6l6 6-6 6"/></svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-1 display text-[20px] font-semibold leading-none">{value}</div>
      {sub && <div className="mt-1 mono text-[10px] text-faint">{sub}</div>}
    </div>
  );
}
