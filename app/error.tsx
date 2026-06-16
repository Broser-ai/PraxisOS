"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // I prod: send til Sentry / vores audit-log via Frej
    console.error("[PraxisOS error]", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="max-w-[460px] text-center">
        <div className="mono text-[11px] tracking-[0.2em] text-faint">500 · NOGET GIK GALT</div>
        <h1 className="display mt-3 text-[36px] font-semibold leading-tight">
          Det her var ikke planen
        </h1>
        <p className="mt-4 text-[14px] text-ink-soft">
          En uventet fejl opstod. Frej (vores sikkerheds-agent) har logget den, og vores team kigger på det.
        </p>
        {error.digest && (
          <p className="mt-3 mono text-[10.5px] text-faint">fejl-id: {error.digest}</p>
        )}
        <div className="mt-7 flex items-center justify-center gap-2">
          <button onClick={reset} className="rounded-[10px] bg-ink px-4 py-2.5 text-[13px] font-medium text-paper">
            Prøv igen
          </button>
          <Link href="/" className="rounded-[10px] border border-line bg-card px-4 py-2.5 text-[13px]">
            ← Forside
          </Link>
        </div>
      </div>
    </div>
  );
}
