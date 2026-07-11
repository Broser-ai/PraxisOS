"use client";

// PraxisOS · RealisticFoot 3D viewer (rebuild efter EPIC 2 scanner-pipeline).
//
// Loader:
//   - .glb via drei useGLTF
//   - .stl via three STLLoader (JSM)
//   - ellers procedural placeholder-form baseret på biomech-parametre
//
// Undgår CustomShaderMaterial (brød build i original impl).
// Kun MeshStandardMaterial + MeshPhysicalMaterial i denne rebuild.

import * as React from "react";
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  ContactShadows,
  Bounds,
  useGLTF,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

export type PressureZone = {
  // Ny form
  x?: number;
  y?: number;
  intensity?: number;
  label?: string;
  // Legacy form (fra app/(internal)/scan/page.tsx)
  cx?: number;
  cy?: number;
  radius_mm?: number;
  peak_kpa?: number;
};

function normalizeZone(z: PressureZone): {
  x: number;
  y: number;
  intensity: number;
  label?: string;
} {
  // Prioritér ny form; ellers oversæt fra legacy
  const x = z.x ?? (z.cx !== undefined ? z.cx / 100 - 0.5 : 0);
  const y = z.y ?? (z.cy !== undefined ? z.cy / 100 - 0.5 : 0);
  const intensity =
    z.intensity ??
    (z.peak_kpa !== undefined ? Math.min(1, Math.max(0, z.peak_kpa / 500)) : 0.5);
  return { x, y, intensity, label: z.label };
}

export type RealisticFootProps = {
  side?: "L" | "R";
  lengthMm?: number;
  forefootWidthMm?: number;
  heelWidthMm?: number;
  archIndex?: number;
  halluxValgusDeg?: number;
  navicularDropMm?: number;
  pressureZones?: PressureZone[];
  height?: number;
  autoRotate?: boolean;
  meshUrl?: string;
};

export function RealisticFoot(props: RealisticFootProps): React.ReactElement {
  const height = props.height ?? 420;

  return (
    <div
      style={{
        width: "100%",
        height,
        background:
          "linear-gradient(135deg, #0a0a0f 0%, #12131a 50%, #0a0a0f 100%)",
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Canvas
        camera={{ position: [0, 0.4, 1.6], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={<LoaderIndicator />}>
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[3, 5, 2]}
            intensity={1.1}
            color={"#fff5e8"}
            castShadow
          />
          <directionalLight
            position={[-3, 2, -2]}
            intensity={0.4}
            color={"#a0c4ff"}
          />
          <Environment preset="studio" />
          <Bounds fit clip observe margin={1.15}>
            <SceneContent {...props} />
          </Bounds>
          <ContactShadows
            position={[0, -0.3, 0]}
            opacity={0.5}
            scale={4}
            blur={2.5}
            far={2}
          />
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            autoRotate={props.autoRotate ?? false}
            autoRotateSpeed={0.6}
            minDistance={0.6}
            maxDistance={3.5}
          />
        </Suspense>
      </Canvas>

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(15, 15, 20, 0.75)",
          color: "#eee",
          fontSize: 11,
          letterSpacing: 0.4,
          fontFamily: "ui-monospace, monospace",
          backdropFilter: "blur(6px)",
        }}
      >
        {props.side ?? "?"} · {props.lengthMm ?? "—"} mm
      </div>
    </div>
  );
}

function SceneContent(props: RealisticFootProps): React.ReactElement {
  const url = props.meshUrl;
  if (!url) return <ProceduralFoot {...props} />;
  const lower = url.toLowerCase();
  if (lower.endsWith(".glb") || lower.endsWith(".gltf"))
    return <GlbMesh url={url} pressureZones={props.pressureZones} />;
  if (lower.endsWith(".stl"))
    return <StlMesh url={url} pressureZones={props.pressureZones} />;
  return <ProceduralFoot {...props} />;
}

function GlbMesh({
  url,
  pressureZones,
}: {
  url: string;
  pressureZones?: PressureZone[];
}): React.ReactElement {
  const { scene } = useGLTF(url);
  return (
    <group>
      <primitive object={scene.clone()} />
      {pressureZones && <PressureOverlay zones={pressureZones} />}
    </group>
  );
}

function StlMesh({
  url,
  pressureZones,
}: {
  url: string;
  pressureZones?: PressureZone[];
}): React.ReactElement {
  const geometry = useLoader(STLLoader, url);
  const normalized = useMemo(() => {
    const g = geometry.clone();
    g.computeBoundingBox();
    g.computeVertexNormals();
    if (g.boundingBox) {
      const size = new THREE.Vector3();
      g.boundingBox.getSize(size);
      const maxAxis = Math.max(size.x, size.y, size.z);
      if (maxAxis > 0) g.scale(1 / maxAxis, 1 / maxAxis, 1 / maxAxis);
      const center = new THREE.Vector3();
      g.boundingBox.getCenter(center);
      g.translate(-center.x, -center.y, -center.z);
    }
    return g;
  }, [geometry]);
  return (
    <group>
      <mesh geometry={normalized}>
        <meshPhysicalMaterial
          color={"#e8c4a8"}
          roughness={0.55}
          metalness={0.05}
          clearcoat={0.15}
          clearcoatRoughness={0.5}
        />
      </mesh>
      {pressureZones && <PressureOverlay zones={pressureZones} />}
    </group>
  );
}

function ProceduralFoot(props: RealisticFootProps): React.ReactElement {
  const groupRef = useRef<THREE.Group>(null);
  const halluxDeg = props.halluxValgusDeg ?? 0;
  const side = props.side ?? "L";
  const mirror = side === "R" ? -1 : 1;

  return (
    <group ref={groupRef} scale={[mirror, 1, 1]}>
      <mesh position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.5, 48, 32]} />
        <meshPhysicalMaterial
          color={"#e0b498"}
          roughness={0.62}
          metalness={0.02}
          clearcoat={0.2}
          clearcoatRoughness={0.55}
        />
      </mesh>
      <mesh position={[0, -0.1, -0.35]}>
        <sphereGeometry args={[0.28, 32, 24]} />
        <meshPhysicalMaterial color={"#d2a685"} roughness={0.7} metalness={0.02} />
      </mesh>
      <mesh position={[0, -0.05, 0.4]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.55, 0.22, 0.35]} />
        <meshPhysicalMaterial color={"#dfb495"} roughness={0.6} metalness={0.02} />
      </mesh>
      <group
        position={[mirror * -0.16, -0.02, 0.6]}
        rotation={[0, 0, THREE.MathUtils.degToRad(mirror * halluxDeg * -0.3)]}
      >
        <mesh>
          <sphereGeometry args={[0.09, 24, 20]} />
          <meshPhysicalMaterial color={"#e2b399"} roughness={0.55} />
        </mesh>
      </group>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[mirror * (0.02 + i * 0.075), -0.02, 0.62 - i * 0.02]}
        >
          <sphereGeometry args={[0.06 - i * 0.008, 20, 16]} />
          <meshPhysicalMaterial color={"#e0b294"} roughness={0.55} />
        </mesh>
      ))}
      {props.pressureZones && <PressureOverlay zones={props.pressureZones} />}
    </group>
  );
}

function PressureOverlay({
  zones,
}: {
  zones: PressureZone[];
}): React.ReactElement {
  return (
    <group position={[0, -0.32, 0]}>
      {zones.map((raw, i) => {
        const z = normalizeZone(raw);
        const color = pressureColor(z.intensity);
        const size = 0.03 + z.intensity * 0.045;
        return (
          <mesh key={i} position={[z.x * 0.35, 0, z.y * 0.5]}>
            <sphereGeometry args={[size, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.9 + z.intensity * 1.2}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function pressureColor(t: number): string {
  if (t < 0.33) return "#4c9dff";
  if (t < 0.66) return "#4ce0c8";
  if (t < 0.85) return "#ffd94c";
  return "#ff5a45";
}

function LoaderIndicator(): React.ReactElement {
  return (
    <Html center>
      <div
        style={{
          color: "#aaa",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
        }}
      >
        Loading mesh…
      </div>
    </Html>
  );
}

export default RealisticFoot;
