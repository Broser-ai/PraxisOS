"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ADDON_PACK,
  CORE_PACK,
  INTERNAL_PACK,
  PAUSED_PACK,
  type PackagingItem,
} from "@/lib/product-packaging";

function OptionToggles({
  item,
  selected,
  onToggle,
}: {
  item: PackagingItem;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (!item.options?.length) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-line/60 pt-3">
      <div className="kicker !text-[9px]">Tilvalg under {item.name}</div>
      {item.options.map((o) => {
        const on = selected.has(o.id);
        return (
          <label
            key={o.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-line-2 bg-paper/40 px-3 py-2.5"
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={on}
              onChange={() => onToggle(o.id)}
            />
            <span>
              <span className="block text-[13px] font-medium">{o.name}</span>
              <span className="mt-0.5 block text-[11.5px] text-muted">{o.summary}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function PackCard({
  item,
  mode,
  enabled,
  onEnable,
  selectedOptions,
  onToggleOption,
}: {
  item: PackagingItem;
  mode: "core" | "addon" | "paused" | "internal";
  enabled?: boolean;
  onEnable?: () => void;
  selectedOptions: Set<string>;
  onToggleOption: (id: string) => void;
}) {
  return (
    <div
      className="rounded-[14px] border border-line bg-card p-5"
      style={
        mode === "paused"
          ? { opacity: 0.72 }
          : mode === "internal"
            ? { borderStyle: "dashed" }
            : enabled
              ? {
                  borderColor: "color-mix(in srgb, var(--color-signal) 45%, var(--color-line))",
                  background: "color-mix(in srgb, var(--color-signal) 4%, var(--color-card))",
                }
              : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="kicker !text-[9.5px]">
            {mode === "core" && "Obligatorisk"}
            {mode === "addon" && "Tilvalg"}
            {mode === "paused" && "Pause · ikke aktiv"}
            {mode === "internal" && "Kun Broser · skjult for kunden"}
          </div>
          <h3 className="display mt-1 text-[18px] font-semibold leading-tight">{item.name}</h3>
          <p className="mt-1.5 text-[13px] text-muted">{item.summary}</p>
          {item.note && <p className="mt-2 text-[11.5px] text-faint">{item.note}</p>}
        </div>
        {mode === "addon" && (
          <button
            type="button"
            onClick={onEnable}
            className="shrink-0 rounded-[9px] px-3 py-1.5 text-[12px] font-medium"
            style={{
              background: enabled ? "var(--color-ink)" : "var(--color-paper-2)",
              color: enabled ? "var(--color-paper)" : "var(--color-ink)",
              border: "1px solid var(--color-line-2)",
            }}
          >
            {enabled ? "Tilvalgt" : "Tilvælg"}
          </button>
        )}
        {mode === "core" && (
          <span className="chip mono !text-[9.5px] !border-signal/30 text-signal">inkluderet</span>
        )}
        {mode === "paused" && (
          <span className="chip mono !text-[9.5px] !border-amber/30 text-amber">pause</span>
        )}
      </div>

      {(mode === "core" || (mode === "addon" && enabled)) && (
        <OptionToggles item={item} selected={selectedOptions} onToggle={onToggleOption} />
      )}

      {item.href && mode !== "internal" && mode !== "paused" && (
        <Link href={item.href} className="mt-3 inline-flex text-[12px] font-medium underline-offset-2 hover:underline">
          Åbn skærm →
        </Link>
      )}
    </div>
  );
}

function defaultOptions(): Set<string> {
  const s = new Set<string>();
  for (const item of [...CORE_PACK, ...ADDON_PACK]) {
    for (const o of item.options ?? []) {
      if (o.defaultOn) s.add(o.id);
    }
  }
  return s;
}

export default function PackagingDraftPage() {
  const [addons, setAddons] = useState<Set<string>>(
    () => new Set(["praxisos-pay", "nemsms", "webshop"]),
  );
  const [options, setOptions] = useState<Set<string>>(defaultOptions);

  const toggleAddon = (id: string) => {
    setAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOption = (id: string) => {
    setOptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const summary = useMemo(() => {
    const coreNames = CORE_PACK.map((c) => c.name);
    const addonNames = ADDON_PACK.filter((a) => addons.has(a.id)).map((a) => a.name);
    return { coreNames, addonNames };
  }, [addons]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="rise">
        <Link href="/admin/marketplace" className="kicker hover:underline">
          ← Modul-tilvalg
        </Link>
        <h1 className="display mt-2 text-[34px] font-semibold leading-[1.05]">
          Produktpakke · udkast
        </h1>
        <p className="mt-3 max-w-[640px] text-[14px] text-muted">
          Kun det nødvendige synligt for klinikken. API og platform styres af Broser. Fod-scan er
          tilvalg med quality gate (Replicate + Roboflow for live PASS).
        </p>
      </div>

      <div className="mt-6 rounded-[14px] border border-ink/10 bg-ink px-5 py-4 text-paper">
        <div className="kicker !text-paper/55">Din sammensætning (demo)</div>
        <p className="mt-2 text-[13.5px] text-paper/85">
          <strong className="text-paper">Kerne:</strong> {summary.coreNames.join(" · ")}
        </p>
        <p className="mt-1 text-[13.5px] text-paper/85">
          <strong className="text-paper">Tilvalg:</strong>{" "}
          {summary.addonNames.length ? summary.addonNames.join(" · ") : "ingen endnu"}
        </p>
      </div>

      <section className="mt-10">
        <div className="kicker mb-3">1 · Obligatorisk kerne</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {CORE_PACK.map((item) => (
            <PackCard
              key={item.id}
              item={item}
              mode="core"
              selectedOptions={options}
              onToggleOption={toggleOption}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="kicker mb-3">2 · Tilvalg (kunden vælger)</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ADDON_PACK.map((item) => (
            <PackCard
              key={item.id}
              item={item}
              mode="addon"
              enabled={addons.has(item.id)}
              onEnable={() => toggleAddon(item.id)}
              selectedOptions={options}
              onToggleOption={toggleOption}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="kicker mb-3">3 · Pause — ikke aktiv</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PAUSED_PACK.map((item) => (
            <PackCard
              key={item.id}
              item={item}
              mode="paused"
              selectedOptions={options}
              onToggleOption={toggleOption}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="kicker mb-3">4 · Skjult for kunden · Broser styrer</div>
        <p className="mb-3 max-w-[620px] text-[13px] text-muted">
          API-integrationer, MCP, database og øvrig platform vises ikke i kundens løsning. Vi
          konfigurerer det bagved.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {INTERNAL_PACK.map((item) => (
            <PackCard
              key={item.id}
              item={item}
              mode="internal"
              selectedOptions={options}
              onToggleOption={toggleOption}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
