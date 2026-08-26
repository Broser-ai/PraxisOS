import Link from "next/link";

/**
 * Fod-scan er bevidst deaktiveret indtil scanningskvaliteten er godkendt.
 * Skærmen findes kun som intern R&D — ikke aktivt produkt.
 */
export default function FodScanPausedPage() {
  return (
    <div className="mx-auto max-w-[720px] py-16">
      <div className="rounded-[16px] border border-amber/30 bg-amber/[0.07] p-8">
        <div className="kicker text-amber">Pause · ikke aktiv i løsningen</div>
        <h1 className="display mt-3 text-[32px] font-semibold leading-tight">Fod-scan er midlertidigt slået fra</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          Den nuværende scan ligner ikke en rigtig fod godt nok. Vi arbejder videre på kvalitet før
          den aktiveres for klinikker. Indtil da er modulet skjult i kundens pakke.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/admin/packaging"
            className="rounded-[10px] bg-ink px-4 py-2.5 text-[13px] font-medium text-paper"
          >
            Se produktpakke →
          </Link>
          <Link
            href="/dashboard"
            className="rounded-[10px] border border-line px-4 py-2.5 text-[13px] font-medium"
          >
            Tilbage til overblik
          </Link>
        </div>
      </div>
    </div>
  );
}
