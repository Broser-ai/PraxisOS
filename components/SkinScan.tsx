"use client";

import { useState, useRef } from "react";

const concerns = [
  { x: 32, y: 38, label: "Pigmentering" },
  { x: 64, y: 35, label: "UV-skade" },
  { x: 48, y: 58, label: "Rødme" },
  { x: 70, y: 62, label: "Tekstur" },
  { x: 38, y: 70, label: "Porer" },
];

function Face({ state }: { state: "before" | "after" }) {
  const after = state === "after";
  return (
    <div
      className="absolute inset-0"
      style={{
        background: after
          ? "radial-gradient(60% 70% at 50% 42%, #f0d9c8 0%, #e3c2ab 55%, #d3ab90 100%)"
          : "radial-gradient(60% 70% at 50% 42%, #eccdb6 0%, #d9ad8e 55%, #c08f6e 100%)",
      }}
    >
      {/* blemish/texture noise */}
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{
          opacity: after ? 0.22 : 0.5,
          backgroundImage:
            "radial-gradient(circle at 30% 36%, rgba(150,70,50,0.6) 0 3px, transparent 4px), radial-gradient(circle at 66% 33%, rgba(150,70,50,0.45) 0 4px, transparent 5px), radial-gradient(circle at 47% 57%, rgba(170,60,40,0.4) 0 6px, transparent 9px), radial-gradient(circle at 71% 61%, rgba(150,70,50,0.4) 0 3px, transparent 4px), radial-gradient(circle at 37% 71%, rgba(150,70,50,0.5) 0 2px, transparent 3px)",
        }}
      />
      {/* concern markers only on 'before' analysis layer */}
      {concerns.map((c, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${c.x}%`, top: `${c.y}%`, opacity: after ? 0.35 : 1 }}
        >
          <span className="block h-5 w-5 rounded-full border border-signal/80" style={{ boxShadow: "0 0 0 3px rgba(63,125,90,0.12)" }} />
        </div>
      ))}
    </div>
  );
}

export function SkinScan() {
  const [pos, setPos] = useState(58);
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(2, Math.min(98, p)));
  };

  return (
    <div className="select-none">
      <div
        ref={ref}
        className="relative aspect-[4/5] w-full cursor-ew-resize overflow-hidden rounded-[12px] border border-line"
        onMouseMove={(e) => e.buttons === 1 && onMove(e.clientX)}
        onMouseDown={(e) => onMove(e.clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
      >
        {/* after (full) */}
        <Face state="after" />
        {/* before (clipped) */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Face state="before" />
        </div>

        {/* scan line */}
        <div className="scan-line" />

        {/* labels */}
        <span className="absolute left-2.5 top-2.5 chip !bg-ink/75 !text-paper !border-transparent">Baseline · 2. maj</span>
        <span className="absolute right-2.5 top-2.5 chip !bg-signal/85 !text-paper !border-transparent">Nu · 7. jun</span>

        {/* grid overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(var(--color-ink) 1px, transparent 1px), linear-gradient(90deg, var(--color-ink) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        {/* handle */}
        <div className="absolute top-0 bottom-0 w-[2px] bg-paper" style={{ left: `${pos}%` }}>
          <div className="absolute top-1/2 left-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line-2 bg-paper text-ink shadow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 7l-4 5 4 5M16 7l4 5-4 5"/></svg>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px] text-faint">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 7l-4 5 4 5M16 7l4 5-4 5"/></svg>
        Træk for at sammenligne · 14 concerns analyseret på 2,1s
      </div>
    </div>
  );
}
