"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows, useGLTF, Environment } from "@react-three/drei";
import type { AlphaScanResult, MedicalFinding } from "@/lib/scanner/alpha-pipeline";
import { isRemoteMeshUrl } from "@/lib/scanner/quality";

type Props = {
  scanData: AlphaScanResult | null;
  previewUrl?: string | null;
};

export default function AlphaViewer4D({ scanData, previewUrl }: Props) {
  if (!scanData) {
    return (
      <div className="grid h-[520px] place-items-center rounded-[14px] border border-dashed border-line bg-paper-2 text-[13px] text-muted">
        Capture et fodfoto og kør Nexus-scan for 3D + findings
      </div>
    );
  }

  const critical = scanData.biomechanics.isCritical;
  const remote = isRemoteMeshUrl(scanData.meshUrl);
  const pass = scanData.quality?.pass ?? false;

  return (
    <div className="relative h-[520px] overflow-hidden rounded-[14px] border border-line bg-[#141210]">
      <Canvas camera={{ position: [0.9, 1.15, 2.35], fov: 40 }} dpr={[1, 1.75]}>
        <color attach="background" args={["#141210"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[4, 8, 3]} intensity={1.4} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#c4a574" />
        <Environment preset="studio" />
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
            <group position={[0, -0.1, 0]}>
              <AnatomicalFootDemo />
              <AnomalyMarkers anomalies={scanData.medicalFindings} />
            </group>
          )}
          <ContactShadows opacity={0.4} scale={8} blur={2.4} far={4} />
        </Suspense>
        <OrbitControls autoRotate={pass} autoRotateSpeed={0.4} enablePan enableZoom />
      </Canvas>

      {(previewUrl || scanData.previewImageUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl || scanData.previewImageUrl}
          alt="Reference"
          className="absolute bottom-4 left-4 h-24 w-24 rounded-[10px] border border-white/20 object-cover shadow-lg"
        />
      )}

      <div className="absolute right-4 top-4 w-[270px] rounded-[12px] border border-white/10 bg-black/60 p-4 text-white backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8fbf9a]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8fbf9a]" />
            MonoMSK
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              pass ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"
            }`}
          >
            {scanData.quality ? `${scanData.quality.grade} ${scanData.quality.score}` : scanData.mode}
          </span>
        </div>
        <div className="mt-3 space-y-2 font-mono text-[12px]">
          <Row label="Arch Strain" value={`${scanData.biomechanics.archStrainMPa} MPa`} danger={critical} />
          <Row label="Joint Torsion" value={`${scanData.biomechanics.jointTorsionNm} N·m`} />
          <Row label="Pronation" value={`${scanData.biomechanics.pronationForceN} N`} />
          <Row label="Mesh" value={remote ? "live GLB" : "demo anatomi"} />
        </div>

        {scanData.medicalFindings.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#e08a7a]">
              AI findings · forslag
            </div>
            <ul className="mt-1.5 max-h-28 space-y-1 overflow-auto">
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
        <mesh key={i} position={[(f.x ?? 50) / 100 - 0.5, (100 - (f.y ?? 50)) / 100 - 0.35, f.z ?? 0.28]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color="#ef4444" wireframe />
        </mesh>
      ))}
    </>
  );
}

/** Higher-fidelity demo foot when GPU mesh unavailable — clearly labeled demo, not clinical */
function AnatomicalFootDemo() {
  const skin = useMemo(() => "#c9a88a", []);
  const sole = useMemo(() => "#a8886a", []);
  return (
    <group rotation={[0.35, 0.55, 0.08]} scale={1.15}>
      {/* calcaneus */}
      <mesh position={[0, 0.06, -0.42]} castShadow>
        <sphereGeometry args={[0.14, 32, 32]} />
        <meshStandardMaterial color={skin} roughness={0.62} metalness={0.02} />
      </mesh>
      {/* midfoot arch */}
      <mesh position={[0.01, 0.11, -0.08]} castShadow>
        <capsuleGeometry args={[0.095, 0.28, 10, 20]} />
        <meshStandardMaterial color={skin} roughness={0.55} metalness={0.03} />
      </mesh>
      {/* arch lift */}
      <mesh position={[-0.02, 0.16, -0.05]} castShadow>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
      {/* forefoot */}
      <mesh position={[0.02, 0.08, 0.28]} castShadow>
        <sphereGeometry args={[0.17, 32, 32]} />
        <meshStandardMaterial color={skin} roughness={0.5} metalness={0.02} />
      </mesh>
      {/* plantar pad */}
      <mesh position={[0.01, 0.02, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.55, 8, 16]} />
        <meshStandardMaterial color={sole} roughness={0.75} />
      </mesh>
      {/* toes */}
      {[
        [0.12, 0.07, 0.48, 0.032, 0.09],
        [0.05, 0.065, 0.5, 0.028, 0.07],
        [-0.01, 0.06, 0.49, 0.026, 0.065],
        [-0.07, 0.055, 0.47, 0.024, 0.055],
        [-0.12, 0.05, 0.44, 0.022, 0.045],
      ].map(([x, y, z, r, len], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <capsuleGeometry args={[r, len, 6, 12]} />
          <meshStandardMaterial color={skin} roughness={0.48} />
        </mesh>
      ))}
    </group>
  );
}

function RemoteFoot({ url, anomalies }: { url: string; anomalies: MedicalFinding[] }) {
  const { scene } = useGLTF(url);
  return (
    <group>
      <primitive object={scene.clone()} scale={2} position={[0, -0.45, 0]} />
      <AnomalyMarkers anomalies={anomalies} />
    </group>
  );
}
