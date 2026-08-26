import { NexusScanPanel } from "@/components/NexusScanPanel";

/**
 * Del Pilar Nexus · klinisk fod-scan (ARIA + S-Agent pipeline).
 * Tilvalg-modul — kræver Replicate + Roboflow nøgler for live quality PASS.
 */
export default function FodScanPage() {
  return (
    <div className="mx-auto max-w-[1180px] space-y-6 py-6">
      <header className="px-1">
        <div className="kicker text-signal">Del Pilar Nexus</div>
        <h1 className="display mt-2 text-[34px] font-semibold leading-tight tracking-tight">
          Klinisk fod-scan
        </h1>
        <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
          ARIA orkestrerer S-Agent pipeline: fod-segmentering → pathology → 3D-lift → MonoMSK.
          Quality gate afgør om resultatet er klinisk brugbart. AI-fund er forslag — ikke diagnose.
        </p>
      </header>

      <NexusScanPanel
        tenantId="bypilar"
        brandName="by Pilar"
        patientId="mette"
        patientName="Mette Lindqvist"
        bookingId="bk_c1"
        serviceName="Del Pilar Nexus · Physical AI"
      />

      <aside className="rounded-[14px] border border-line bg-paper-2/80 px-5 py-4 text-[12.5px] text-muted">
        <div className="font-medium text-ink">Opsætning til live quality</div>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>
            Sæt <code className="text-ink">REPLICATE_API_TOKEN</code> og{" "}
            <code className="text-ink">ROBOFLOW_API_KEY</code> i{" "}
            <code>.env.local</code> (dev) eller <code>.env.production</code> (Hetzner)
          </li>
          <li>
            Valgfrit: <code>REPLICATE_MESH_MODEL</code> (default <code>firtoz/trellis</code>),{" "}
            <code>ROBOFLOW_SEGMENT_MODEL</code>, <code>ROBOFLOW_MODEL</code>
          </li>
          <li>
            Genstart app · tjek <code>GET /api/v1/scan/process</code> viser{" "}
            <code>liveReady: true</code> · upload skarpt plantar-foto · kør Nexus-scan
          </li>
        </ol>
      </aside>
    </div>
  );
}
