"use client";

import { useState } from "react";
import Link from "next/link";
import { staff, ROLE_COLORS } from "@/lib/staff";
import { listTenants } from "@/lib/tenants";

const PERMS = [
  ["admin", "Admin · indstillinger"],
  ["bookings", "Bookings"],
  ["journal", "Journal"],
  ["billing", "Fakturering"],
  ["marketing", "Marketing"],
] as const;

export default function StaffPage() {
  const tenants = listTenants();
  const [activeTenant, setActiveTenant] = useState(tenants[0].slug);
  const list = staff.filter((s) => s.tenant === activeTenant);

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Behandlere</h1>
          <p className="mt-2 text-[13.5px] text-muted">Tilføj behandlere, tildel roller og styr adgangsrettigheder.</p>
        </div>
        <button className="btn btn-primary">+ Inviter behandler</button>
      </div>

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

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((s) => (
          <div key={s.id} className="card rise p-5">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-paper" style={{ background: s.avatarColor }}>
                {s.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="display text-[17px] font-semibold leading-tight">{s.name}</h3>
                  <span className={`chip !py-0.5 ${s.active ? "!border-signal/40 text-signal" : "text-faint"}`}>{s.active ? "aktiv" : "inaktiv"}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-muted">{s.email}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ background: `color-mix(in srgb, ${ROLE_COLORS[s.role]} 14%, transparent)`, color: ROLE_COLORS[s.role] }}>
                    {s.role}
                  </span>
                  <span className="mono text-[10.5px] text-faint">{s.hoursThisWeek}t denne uge · siden {new Date(s.startedAt).getFullYear()}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <div className="kicker mb-2">Rettigheder</div>
              <div className="flex flex-wrap gap-1.5">
                {PERMS.map(([k, label]) => {
                  const has = (s.permissions as readonly string[]).includes(k);
                  return (
                    <span
                      key={k}
                      className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] ${has ? "border-ink text-ink" : "border-line-2 text-faint line-through"}`}
                      style={has ? { background: "var(--color-paper-2)" } : {}}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: has ? "var(--color-signal)" : "var(--color-line-2)" }} />
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="btn btn-ghost !py-1.5 !text-[11.5px]">Rediger</button>
              <button className="btn btn-ghost !py-1.5 !text-[11.5px]">Vagtplan</button>
              <button className="ml-auto rounded-[8px] border border-line-2 px-3 py-1.5 text-[11.5px] text-muted">·  ·  ·</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
