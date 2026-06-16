"use client";

import { useState } from "react";
import Link from "next/link";
import { DK_DATA_SOURCES, SOURCE_CATEGORIES, STATUS_LABEL } from "@/lib/dk-data";

export default function DkDataIntegrations() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selected, setSelected] = useState(DK_DATA_SOURCES[0].id);

  const filtered = activeCategory === "all" ? DK_DATA_SOURCES : DK_DATA_SOURCES.filter((s) => s.category === activeCategory);
  const source = DK_DATA_SOURCES.find((s) => s.id === selected)!;

  const counts = {
    live: DK_DATA_SOURCES.filter((s) => s.status === "live").length,
    stubbed: DK_DATA_SOURCES.filter((s) => s.status === "stubbed").length,
    pending: DK_DATA_SOURCES.filter((s) => s.status === "pending").length,
    missing: DK_DATA_SOURCES.filter((s) => s.status === "missing").length,
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">DK Data-integrationer</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Alle dansk-offentlige data-kilder PraxisOS henter fra · status · juridisk grundlag · konkret fordel for klinikken.
          </p>
        </div>
      </div>

      {/* Status-overview */}
      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        <Stat label="Live" value={counts.live} color="var(--color-signal)" highlight />
        <Stat label="Stubbet" value={counts.stubbed} color="var(--color-accent)" />
        <Stat label="Under onboarding" value={counts.pending} color="var(--color-amber)" />
        <Stat label="Mangler" value={counts.missing} color="var(--color-faint)" />
      </div>

      {/* Kort note */}
      <div className="rise mt-3 rounded-[12px] border border-amber/30 bg-amber/[0.06] p-4 text-[12.5px] text-ink-soft">
        <div className="kicker !text-amber mb-1.5">Vigtig afgrænsning</div>
        <span><b>DAWA</b> giver KUN adresse-data — vejnavne, husnumre, postnumre. <b>Ikke person-data eller CPR.</b></span>
        <span className="block mt-1">For at hente CPR i en privat SaaS som PraxisOS bruger vi <b>CPR Match</b>: brugeren taster CPR og vi verificerer det matcher MitID's navn+fødsel.</span>
        <span className="block mt-1">Sundhed.dk / FMK kræver formel <b>Trustaftale</b> med Sundhedsdatastyrelsen (~6 ugers onboarding).</span>
      </div>

      {/* Category-filter */}
      <div className="rise mt-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveCategory("all")}
          className="rounded-[8px] px-3 py-1.5 text-[12px] border border-line-2"
          style={{
            background: activeCategory === "all" ? "var(--color-ink)" : "var(--color-card)",
            color: activeCategory === "all" ? "var(--color-paper)" : "var(--color-muted)",
          }}
        >
          Alle ({DK_DATA_SOURCES.length})
        </button>
        {SOURCE_CATEGORIES.map((c) => {
          const count = DK_DATA_SOURCES.filter((s) => s.category === c.id).length;
          const isActive = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className="rounded-[8px] px-3 py-1.5 text-[12px] border border-line-2"
              style={{
                background: isActive ? "var(--color-ink)" : "var(--color-card)",
                color: isActive ? "var(--color-paper)" : "var(--color-muted)",
              }}
            >
              {c.icon} {c.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Main: list + detail */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[340px_1fr]">
        {/* Liste */}
        <div className="card overflow-hidden p-0">
          <div className="scrollbar-thin max-h-[700px] overflow-y-auto">
            {filtered.map((s) => {
              const isSelected = s.id === selected;
              const status = STATUS_LABEL[s.status];
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className="flex w-full items-start gap-3 border-b border-line p-4 text-left transition-colors hover:bg-paper-2"
                  style={isSelected ? { background: "var(--color-paper-2)", borderLeft: "3px solid var(--color-ink)" } : {}}
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] text-paper text-[12px] font-bold"
                    style={{ background: s.iconColor }}
                  >
                    {s.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-tight">{s.name}</div>
                    <div className="mt-0.5 text-[10.5px] text-faint truncate">{s.authority}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className="rounded-full px-1.5 py-0 text-[9px] font-medium"
                        style={{ background: `color-mix(in srgb, ${status.color} 14%, transparent)`, color: status.color }}
                      >
                        ● {status.label}
                      </span>
                      <span className="mono text-[9.5px] text-faint">{s.category}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalje */}
        <div className="card p-5">
          {/* Hero */}
          <div className="flex items-start gap-4">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-[10px] text-paper text-[20px] font-bold"
              style={{ background: source.iconColor }}
            >
              {source.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="display text-[22px] font-semibold leading-tight">{source.name}</h2>
              <div className="mt-1 text-[12.5px] text-muted">{source.authority}</div>
              <a href={`https://${source.url}`} target="_blank" className="mt-1 mono text-[11px] text-accent hover:underline inline-block">
                {source.url} ↗
              </a>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: `color-mix(in srgb, ${STATUS_LABEL[source.status].color} 14%, transparent)`,
                    color: STATUS_LABEL[source.status].color,
                  }}
                >
                  ● {STATUS_LABEL[source.status].label}
                </span>
                <span className="chip mono !text-[10px]">{source.authMethod}</span>
              </div>
            </div>
          </div>

          {/* Hvad vi får / ikke får */}
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-[10px] border border-signal/30 bg-signal/[0.06] p-3.5">
              <div className="kicker !text-signal mb-2">Hvad vi får</div>
              <ul className="flex flex-col gap-1.5 text-[11.5px]">
                {source.provides.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-signal/14 text-signal text-[10px]">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[10px] border border-clay/30 bg-clay/[0.06] p-3.5">
              <div className="kicker !text-clay mb-2">Hvad vi IKKE får</div>
              <ul className="flex flex-col gap-1.5 text-[11.5px]">
                {source.doesNotProvide.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-clay/14 text-clay text-[10px]">×</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* PraxisOS-fordel */}
          <div className="mt-3 rounded-[10px] border border-line bg-paper-2/40 p-3.5">
            <div className="kicker mb-1.5">Fordel for klinikken</div>
            <p className="text-[12.5px] text-ink-soft leading-relaxed">{source.practiceOsBenefit}</p>
          </div>

          {/* Tekniske detaljer */}
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              ["Auth", source.authMethod],
              ["Pris", source.costNote],
              ["Cache", source.cacheTtlSec === 0 ? "ingen cache" : `${Math.round(source.cacheTtlSec / 3600)}t TTL`],
              ["Rate-limit", source.rateLimit],
              ["Setup-tid", source.setupTime],
              ["Juridisk", source.legalBasis],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[8px] border border-line bg-paper p-2.5">
                <div className="kicker !text-[8.5px]">{k}</div>
                <div className="mt-0.5 text-[11px]">{v}</div>
              </div>
            ))}
          </div>

          {/* Response example */}
          {source.responseExample && (
            <div className="mt-3">
              <div className="kicker mb-2">Eksempel-respons</div>
              <pre className="scrollbar-thin overflow-auto rounded-[8px] bg-ink p-3 text-paper text-[10.5px] mono leading-relaxed">
{source.responseExample}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div
      className="card p-3"
      style={highlight ? { borderColor: color, background: `color-mix(in srgb, ${color} 5%, var(--color-card))` } : {}}
    >
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-1 display text-[24px] font-semibold leading-none" style={highlight ? { color } : {}}>{value}</div>
    </div>
  );
}
