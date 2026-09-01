// MonoMSK-inspired kinematic estimator · Arch Strain (MPa) + torsion from 4D point stream
// Clinical decision support — not a medical device claim. Thresholds are configurable.
import { auditLog } from "@/lib/audit";

export type KinematicOutput = {
  archStrainMPa: number;
  pronationForceN: number;
  jointTorsionNm: number;
  peakVerticalM: number;
  frameCount: number;
  isCritical: boolean;
};

export type MonoMskConfig = {
  /** Approximate plantar fascia modulus (MPa) used in Hooke-style estimate */
  fasciaModulusMPa: number;
  /** Assumed body mass (kg) when force plate absent */
  bodyMassKg: number;
  /** Critical arch strain threshold (MPa) */
  criticalStrainMPa: number;
  /** Critical torsion threshold (N·m) */
  criticalTorsionNm: number;
};

const DEFAULT_CFG: MonoMskConfig = {
  fasciaModulusMPa: 350,
  bodyMassKg: 75,
  criticalStrainMPa: 4.5,
  criticalTorsionNm: 15,
};

export class MonoMSKSolver {
  constructor(private cfg: MonoMskConfig = DEFAULT_CFG) {}

  /**
   * Estimates internal joint loads from a normalized point-cloud stream.
   * Each frame is Float32Array XYZ (meters, relative). Uses vertical collapse
   * as strain proxy and mediolateral heel deviation as torsion lever.
   */
  public async computeInternalJointForces(
    pointCloudStream: Float32Array[],
    tenantId: string,
    patientId: string,
  ): Promise<KinematicOutput> {
    let maxStrain = 0;
    let maxTorsion = 0;
    let peakVertical = 0;

    for (let i = 0; i < pointCloudStream.length; i++) {
      const frame = pointCloudStream[i];
      if (!frame || frame.length < 3) continue;

      // Aggregate vertical deviation across points in frame
      let zSum = 0;
      let xDev = 0;
      const points = Math.floor(frame.length / 3);
      for (let p = 0; p < points; p++) {
        const x = frame[p * 3] ?? 0;
        const z = frame[p * 3 + 2] ?? 0;
        zSum += Math.abs(z);
        xDev += Math.abs(x);
      }
      const zDepth = points > 0 ? zSum / points : 0;
      const deviationX = points > 0 ? xDev / points : 0;
      peakVertical = Math.max(peakVertical, zDepth);

      // Stress ≈ E · ε with ε ≈ normalized collapse
      const strain = (zDepth * this.cfg.fasciaModulusMPa) / 100;
      if (strain > maxStrain) maxStrain = strain;

      const torsion = deviationX * 9.81 * this.cfg.bodyMassKg;
      if (torsion > maxTorsion) maxTorsion = torsion;
    }

    const output: KinematicOutput = {
      archStrainMPa: Number(maxStrain.toFixed(2)),
      pronationForceN: Number((maxTorsion / 0.1).toFixed(2)),
      jointTorsionNm: Number(maxTorsion.toFixed(2)),
      peakVerticalM: Number(peakVertical.toFixed(4)),
      frameCount: pointCloudStream.length,
      isCritical:
        maxStrain > this.cfg.criticalStrainMPa || maxTorsion > this.cfg.criticalTorsionNm,
    };

    if (output.isCritical) {
      auditLog("findings.drafted", {
        tenant_id: tenantId,
        target_ref: `patient/${patientId}`,
        alert: "High Biomechanical Strain Detected",
        ...output,
      });
    }

    return output;
  }
}
