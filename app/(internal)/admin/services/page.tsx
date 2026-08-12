"use client";

import { useState } from "react";
import Link from "next/link";
import { listTenants } from "@/lib/tenants";

export default function ServicesEditor() {
  const tenants = listTenants();
  const [activeTenant, setActiveTenant] = useState(tenants[0].slug);
  const tenant = tenants.find((t) => t.slug === activeTenant)!;
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Ydelses-katalog</h1>
          <p className="mt-2 text-[13.5px] text-muted">Rediger pris, varighed og tilgængelighed pr. ydelse. Synker automatisk til booking-API.</p>
        </div>
        <button className="btn btn-primary">+ Ny ydelse</button>
      </div>

      {/* Tenant-vælger */}
      <div className="rise mt-6 flex flex-wrap gap-2">
        {tenants.map((t) => (
          <button
            key={t.slug}
            onClick={() => { setActiveTenant(t.slug); setEditing(null); }}
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
            <span className="mono text-[10.5px] text-faint">{t.services.length}</span>
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="card rise mt-3 overflow-hidden" style={{ animationDelay: "0.06s" }}>
        <div className="hidden grid-cols-[1fr_100px_100px_120px_120px_100px_80px] gap-4 border-b border-line bg-paper-2/50 px-5 py-2.5 lg:grid">
          {["Navn", "Kategori", "Status", "Varighed", "Modality", "Pris", ""].map((h) => (
            <div key={h} className="kicker">{h}</div>
          ))}
        </div>

        {tenant.services.map((s) => {
          const isEditing = editing === s.id;
          const active = s.active !== false;
          return (
            <div
              key={s.id}
              className={`grid grid-cols-1 gap-3 border-t border-line px-5 py-3.5 first:border-t-0 lg:grid-cols-[1fr_100px_100px_120px_120px_100px_80px] lg:items-center ${isEditing ? "bg-paper-2/60" : ""} ${!active ? "opacity-55" : ""}`}
            >
              <div>
                {isEditing ? (
                  <>
                    <input
                      defaultValue={s.name}
                      className="w-full rounded-[8px] border border-line-2 bg-card px-2.5 py-1.5 text-[13px] font-medium outline-none focus:border-ink"
                    />
                    <input
                      defaultValue={s.shortDescription ?? s.description}
                      className="mt-1.5 w-full rounded-[8px] border border-line-2 bg-card px-2.5 py-1.5 text-[11.5px] text-muted outline-none focus:border-ink"
                    />
                  </>
                ) : (
                  <>
                    <div className="text-[14px] font-medium">{s.name}</div>
                    <div className="text-[12px] text-muted">{s.shortDescription ?? s.description}</div>
                    {(s.addOns?.length ?? 0) > 0 && (
                      <div className="mt-1 mono text-[10.5px] text-faint">
                        Tilvalg: {s.addOns!.map((a) => a.name).join(" · ")}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="hidden lg:block"><span className="chip">{s.category}</span></div>
              <div className="hidden lg:block">
                <span className="chip" style={{ opacity: active ? 1 : 0.7 }}>
                  {active ? "Aktiv" : "Inactive"}
                </span>
              </div>
              <div className="hidden lg:block">
                {isEditing ? (
                  <input
                    type="number"
                    defaultValue={s.durationMin}
                    className="w-20 rounded-[8px] border border-line-2 bg-card px-2 py-1 mono text-[12px] outline-none focus:border-ink"
                  />
                ) : (
                  <span className="mono text-[13px]">
                    {s.durationMin != null ? `${s.durationMin} min` : "Efter aftale"}
                  </span>
                )}
              </div>
              <div className="hidden lg:block">
                <div className="flex flex-wrap gap-1">
                  {s.modality.map((m) => (
                    <span key={m} className="chip !py-0 !text-[10px]">{m}</span>
                  ))}
                </div>
              </div>
              <div className="hidden lg:block">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      defaultValue={s.priceKr}
                      className="w-20 rounded-[8px] border border-line-2 bg-card px-2 py-1 mono text-[12px] outline-none focus:border-ink"
                    />
                    <span className="mono text-[11px] text-faint">kr</span>
                  </div>
                ) : <span className="mono text-[14px] font-semibold">{s.priceKr} kr</span>}
              </div>
              <div className="flex justify-end gap-1">
                {isEditing ? (
                  <>
                    <button onClick={() => setEditing(null)} className="rounded-[8px] bg-ink px-3 py-1 text-[11px] font-medium text-paper">Gem</button>
                    <button onClick={() => setEditing(null)} className="rounded-[8px] border border-line-2 px-3 py-1 text-[11px] text-muted">×</button>
                  </>
                ) : (
                  <button onClick={() => setEditing(s.id)} className="rounded-[8px] border border-line-2 px-3 py-1 text-[11px] text-muted hover:bg-paper-2">Rediger</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[11px] text-faint">
        Ændringer er lokale i prototypen · ægte data persisteres når Supabase-laget kobles på.
      </p>
    </div>
  );
}
