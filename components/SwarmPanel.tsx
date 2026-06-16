"use client";

import { swarm } from "@/lib/scan";

const statusStyle: Record<string, string> = {
  thinking: "text-accent",
  acting: "text-signal",
  writing: "text-clay",
  idle: "text-faint",
};

export function SwarmPanel() {
  return (
    <div className="flex flex-col gap-2.5">
      {swarm.map((a, i) => (
        <div
          key={a.id}
          className="rise rounded-[11px] border border-line bg-paper p-3"
          style={{ animationDelay: `${0.06 + i * 0.05}s` }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="relative grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-paper"
              style={{ background: a.color }}
            >
              {a.name.charAt(0)}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-signal live-dot" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold leading-tight">{a.name}</div>
              <div className="kicker !text-[9px]">{a.role}</div>
            </div>
            <span className={`mono text-[10.5px] ${statusStyle[a.status]}`}>{a.status}</span>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{a.lastAction}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper-2">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${a.loadPct}%`, background: a.color }}
              />
            </div>
            <span className="mono text-[10px] text-faint">{a.loadPct}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
