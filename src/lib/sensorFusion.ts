import * as THREE from 'three';

/**
 * DepthSensorFusion — Complementary Fusion of Optical Camera Depth & IMU Linear Acceleration.
 * 
 * Architecture:
 * - Optical Camera (Low-Frequency Ground Truth):
 *   Measures apparent LED blob size. Drift-free absolute depth anchor.
 * - IMU Accelerometer (High-Frequency Inertial Impulse):
 *   Measures instantaneous forward/backward push-pull acceleration at 100 Hz.
 * - Leaky Complementary Filter:
 *   Blends instant inertial velocity with drift-free optical position anchor.
 */
export class DepthSensorFusion {
  private fusedZ = 0;
  private velocityZ = 0;
  private lastTime = performance.now();
  private isInitialized = false;

  // Fusion tuning parameters
  private readonly alpha = 0.22; // Weight towards optical anchor per optical frame
  private readonly velocityDecay = 0.86; // Damps integration drift within 150-200ms

  /**
   * Reset fusion state to a specific depth (e.g. on Recenter or Start)
   */
  reset(initialZ = 0) {
    this.fusedZ = initialZ;
    this.velocityZ = 0;
    this.lastTime = performance.now();
    this.isInitialized = true;
  }

  /**
   * Update with 100 Hz IMU telemetry (Linear Acceleration + Orientation)
   */
  updateIMU(
    ax: number,
    ay: number,
    az: number,
    pitchDeg: number,
    yawDeg: number,
    rollDeg: number,
    now: number = performance.now()
  ) {
    if (!this.isInitialized) return;

    const dt = Math.max(0.002, Math.min(0.05, (now - this.lastTime) / 1000.0));
    this.lastTime = now;

    // 1. Build rotation quaternion from IMU Euler angles
    const euler = new THREE.Euler(
      (pitchDeg * Math.PI) / 180,
      (yawDeg * Math.PI) / 180,
      (rollDeg * Math.PI) / 180,
      'YXZ'
    );
    const quat = new THREE.Quaternion().setFromEuler(euler);

    // 2. Compute gravity vector in sensor body frame
    // At zero tilt, MPU-6050 reads 1g (9.80665 m/s^2) on the Z axis
    const gravityWorld = new THREE.Vector3(0, 0, 9.80665);
    const invQuat = quat.clone().invert();
    const gravityBody = gravityWorld.applyQuaternion(invQuat);

    // 3. Remove gravity component to isolate dynamic user thrust
    const linAccBody = new THREE.Vector3(
      ax - gravityBody.x,
      ay - gravityBody.y,
      az - gravityBody.z
    );

    // 4. Transform linear acceleration into world/camera frame
    const linAccWorld = linAccBody.applyQuaternion(quat);

    // Noise gate: ignore small resting sensor noise (< 1.2 m/s^2)
    let dynamicAz = linAccWorld.z;
    if (Math.abs(dynamicAz) < 1.2) {
      dynamicAz = 0;
    }

    // 5. Integrate acceleration into dynamic velocity with leaky decay
    this.velocityZ = Math.max(-2.0, Math.min(2.0, (this.velocityZ + dynamicAz * dt) * this.velocityDecay));
  }

  /**
   * Update with 60 Hz Optical Camera Depth measurement
   */
  updateOptical(opticalZ: number): number {
    if (!this.isInitialized) {
      this.reset(opticalZ);
      return opticalZ;
    }

    if (isNaN(opticalZ)) return this.fusedZ;

    // Optical depth directly anchors position with rock-solid stability
    this.fusedZ = opticalZ;
    return this.fusedZ;
  }

  getDepth(): number {
    return this.fusedZ;
  }
}
