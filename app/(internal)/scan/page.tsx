import { NexusScanPanel } from "@/components/NexusScanPanel";
import { NexusProviderSetup } from "@/components/NexusProviderSetup";

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

      <NexusProviderSetup />

      <NexusScanPanel
        tenantId="bypilar"
        brandName="by Pilar"
        patientId="mette"
        patientName="Mette Lindqvist"
        bookingId="bk_c1"
        serviceName="Del Pilar Nexus · Physical AI"
      />
    </div>
  );
}
