"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows, useGLTF } from "@react-three/drei";
import type { AlphaScanResult, MedicalFinding } from "@/lib/scanner/alpha-pipeline";

type Props = {
  scanData: AlphaScanResult | null;
};

function isRemoteMesh(url: string): boolean {
  return /^https?:\/\//i.test(url) && !url.includes("mock");
}

export default function AlphaViewer4D({ scanData }: Props) {
  if (!scanData) {
    return (
      <div className="grid h-[420px] place-items-center rounded-[14px] border border-line bg-paper-2 text-[13px] text-muted">
        Afventer 4D S-Agent data…
      </div>
    );
  }

  const critical = scanData.biomechanics.isCritical;
  const remote = isRemoteMesh(scanData.meshUrl);

  return (
    <div className="relative h-[520px] overflow-hidden rounded-[14px] border border-line bg-[#1a1814]">
      <Canvas camera={{ position: [0.8, 1.1, 2.4], fov: 42 }} dpr={[1, 1.75]}>
        <color attach="background" args={["#1a1814"]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 8, 3]} intensity={1.35} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#c4a574" />
        <Suspense
          fallback={
            <Html center>
              <div className="rounded-md bg-black/70 px-3 py-2 text-[12px] text-white">Loader mesh…</div>
            </Html>
          }
        >
          {remote ? (
            <RemoteFoot url={scanData.meshUrl} anomalies={scanData.medicalFindings} />
          ) : (
            <group position={[0, -0.15, 0]}>
              <ProceduralFoot />
              <AnomalyMarkers anomalies={scanData.medicalFindings} />
            </group>
          )}
          <ContactShadows opacity={0.35} scale={8} blur={2.2} far={4} />
        </Suspense>
        <OrbitControls autoRotate autoRotateSpeed={0.45} enablePan enableZoom />
      </Canvas>

      <div className="absolute right-4 top-4 w-[260px] rounded-[12px] border border-white/10 bg-black/55 p-4 text-white backdrop-blur-md">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8fbf9a]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8fbf9a]" />
          MonoMSK 4D
        </div>
        <div className="mt-3 space-y-2 font-mono text-[12px]">
          <Row
            label="Arch Strain"
            value={`${scanData.biomechanics.archStrainMPa} MPa`}
            danger={critical}
          />
          <Row label="Joint Torsion" value={`${scanData.biomechanics.jointTorsionNm} N·m`} />
          <Row label="Pronation" value={`${scanData.biomechanics.pronationForceN} N`} />
          <Row label="Mode" value={scanData.mode} />
        </div>

        {scanData.medicalFindings.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#e08a7a]">
              Findings
            </div>
            <ul className="mt-1.5 space-y-1">
              {scanData.medicalFindings.map((f, i) => (
                <li key={`${f.class}-${i}`} className="text-[11px] text-white/80">
                  · {f.class} ({Math.round(f.confidence * 100)}%)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/45">{label}</span>
      <span className={danger ? "font-semibold text-[#f0a090]" : "text-[#d7ecda]"}>{value}</span>
    </div>
  );
}

function AnomalyMarkers({ anomalies }: { anomalies: MedicalFinding[] }) {
  return (
    <>
      {anomalies.map((f, i) => (
        <mesh key={i} position={[(f.x ?? 50) / 100 - 0.5, (f.y ?? 50) / 100 - 0.2, f.z ?? 0.35]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color="#ef4444" wireframe />
        </mesh>
      ))}
    </>
  );
}

function ProceduralFoot() {
  const skin = useMemo(() => "#c4a484", []);
  return (
    <group rotation={[0.15, 0.4, 0]}>
      <mesh position={[0, 0.08, -0.35]} castShadow>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color={skin} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0.02, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.35, 8, 16]} />
        <meshStandardMaterial color={skin} roughness={0.5} metalness={0.04} />
      </mesh>
      <mesh position={[0.02, 0.09, 0.38]} castShadow>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color={skin} roughness={0.48} metalness={0.04} />
      </mesh>
      {[-0.1, -0.04, 0.02, 0.08, 0.13].map((x, i) => (
        <mesh key={i} position={[x, 0.07, 0.55 + i * 0.01]} castShadow>
          <capsuleGeometry args={[0.025, 0.06, 4, 8]} />
          <meshStandardMaterial color={skin} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function RemoteFoot({ url, anomalies }: { url: string; anomalies: MedicalFinding[] }) {
  const { scene } = useGLTF(url);
  return (
    <group>
      <primitive object={scene.clone()} scale={2} position={[0, -0.5, 0]} />
      <AnomalyMarkers anomalies={anomalies} />
    </group>
  );
}
