"use client";

// ClinicLamp · react-three-fiber component wrapping RectAreaLight
// with an IES-photometric profile matching a real Danish clinic exam lamp.
//
// Kontrakt: FRONTIER-STANDARD-REPORT §Naughty-Dog #2
// Usage:
//   <Canvas>
//     <ClinicLamp profile="waldmann-halux-5000k" position={[0, 3, 2]} />
//     <mesh> ... </mesh>
//   </Canvas>

import * as React from "react";
import { useMemo } from "react";
import * as THREE from "three";
import { getIesProfile, GENERIC_STUDIO_5500K } from "@/lib/lighting/ies-profiles";

export type ClinicLampProps = {
  profile?: string;
  position?: [number, number, number];
  lookAt?: [number, number, number];
  intensityMultiplier?: number;
};

export function ClinicLamp(props: ClinicLampProps): React.ReactElement {
  const profile = useMemo(
    () => getIesProfile(props.profile ?? GENERIC_STUDIO_5500K.id) ?? GENERIC_STUDIO_5500K,
    [props.profile],
  );

  const color = useMemo(() => new THREE.Color(profile.colorHex), [profile.colorHex]);
  const position = props.position ?? [0, 2.5, 1.5];
  const intensity = profile.intensity * (props.intensityMultiplier ?? 1);
  const widthM = profile.widthMm / 1000;
  const heightM = profile.heightMm / 1000;

  // Ref to point the RectAreaLight at the origin (or provided lookAt).
  const ref = React.useRef<THREE.RectAreaLight>(null);
  React.useEffect(() => {
    const light = ref.current;
    if (light) {
      const [lx, ly, lz] = props.lookAt ?? [0, 0, 0];
      light.lookAt(lx, ly, lz);
    }
  }, [props.lookAt]);

  return (
    <rectAreaLight
      ref={ref}
      position={position}
      color={color}
      intensity={intensity}
      width={widthM}
      height={heightM}
    />
  );
}
