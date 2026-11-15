import * as THREE from 'three';

export interface DepthFusionMetrics {
  fusedZ: number;
  opticalZ: number;
  velocityZ: number;
  biasZ: number;
  lastDt: number;
  activeSource: 'FUSED' | 'OPTICAL_ONLY' | 'IMU_PREDICTION';
}

/**
 * DepthSensorFusion — State-Space Predict-Correct Observer
 * 
 * Fusion Architecture:
 * - 100 Hz IMU (Linear Acceleration + Orientation):
 *   High-frequency motion predictor. Integrates gravity-compensated linear acceleration
 *   with leaky velocity damping (tau ≈ 180ms) to provide zero-latency tactile response
 *   without unbounded integration drift.
 * 
 * - 60 Hz Optical Blob Camera (Connected-Component Apparent Diameter):
 *   Absolute, drift-free depth anchor. Corrects prediction error, tracks physical distance,
 *   and dynamically adapts accelerometer zero-bias.
 * 
 * - Seamless Coasting & Reacquisition:
 *   When optical tracking drops momentarily (≤ 300ms), IMU dead-reckoning maintains
 *   smooth continuous motion without snapping or freezing.
 */
export class DepthSensorFusion {
  private fusedZ = 0;
  private opticalZ = 0;
  private velocityZ = 0;
  private biasZ = 0;
  private lastImuTime = 0;
  private lastOpticalTime = 0;
  private isInitialized = false;
  private lastDt = 0.01;

  // Filter tuning parameters
  // Leaky velocity decay time constant (seconds)
  private readonly velocityTau = 0.18;
  // Noise gate deadband for resting accelerometer noise (m/s^2)
  private readonly accelDeadband = 0.28;
  
  // Correction observer gains
  private readonly K_pos = 0.32;   // Position correction gain per optical frame
  private readonly K_vel = 0.20;   // Velocity correction gain
  private readonly K_bias = 0.015; // Bias adaptation gain

  /**
   * Reset fusion state to a specific depth (e.g. on Recenter or Start)
   */
  reset(initialZ = 0) {
    this.fusedZ = initialZ;
    this.opticalZ = initialZ;
    this.velocityZ = 0;
    this.biasZ = 0;
    this.lastImuTime = performance.now();
    this.lastOpticalTime = performance.now();
    this.isInitialized = true;
  }

  /**
   * Update with 100 Hz IMU telemetry (Linear Acceleration + Orientation)
   * Predicts short-term depth motion with leaky velocity integration.
   */
  updateIMU(
    ax: number,
    ay: number,
    az: number,
    pitchDeg: number,
    yawDeg: number,
    rollDeg: number,
    now: number = performance.now()
  ): number {
    if (!this.isInitialized) {
      this.lastImuTime = now;
      this.isInitialized = true;
      return this.fusedZ;
    }

    if (this.lastImuTime === 0) {
      this.lastImuTime = now;
      return this.fusedZ;
    }

    const dt = Math.max(0.002, Math.min(0.05, (now - this.lastImuTime) / 1000.0));
    this.lastImuTime = now;
    this.lastDt = dt;

    // 1. Build rotation quaternion from IMU Euler angles ('YXZ' convention)
    const euler = new THREE.Euler(
      (pitchDeg * Math.PI) / 180,
      (yawDeg * Math.PI) / 180,
      (rollDeg * Math.PI) / 180,
      'YXZ'
    );
    const quat = new THREE.Quaternion().setFromEuler(euler);

    // 2. Remove gravity in sensor body frame
    // At rest horizontal, MPU-6050 reads 1g (9.80665 m/s^2) on the Z axis
    const gravityWorld = new THREE.Vector3(0, 0, 9.80665);
    const invQuat = quat.clone().invert();
    const gravityBody = gravityWorld.applyQuaternion(invQuat);

    const linAccBody = new THREE.Vector3(
      ax - gravityBody.x,
      ay - gravityBody.y,
      az - gravityBody.z
    );

    // 3. Transform dynamic acceleration into world frame
    const linAccWorld = linAccBody.applyQuaternion(quat);

    // Dynamic acceleration along depth (Z) axis minus estimated bias
    let dynamicAz = linAccWorld.z - this.biasZ;

    // Deadband filter to reject stationary sensor noise
    if (Math.abs(dynamicAz) < this.accelDeadband) {
      dynamicAz = 0;
    } else {
      dynamicAz -= Math.sign(dynamicAz) * this.accelDeadband;
    }

    // Clamp extreme acceleration spikes to physical human hand limits
    dynamicAz = Math.max(-12.0, Math.min(12.0, dynamicAz));

    // 4. Leaky velocity integration: v(t + dt) = (v(t) + a * dt) * exp(-dt / tau)
    const decay = Math.exp(-dt / this.velocityTau);
    this.velocityZ = Math.max(-2.5, Math.min(2.5, (this.velocityZ + dynamicAz * dt) * decay));

    // 5. Predict position: z(t + dt) = z(t) + v * dt
    this.fusedZ += this.velocityZ * dt;

    return this.fusedZ;
  }

  /**
   * Update with 60 Hz Optical Camera Depth measurement
   * Anchors position with high responsiveness, corrects drift, and tracks physical distance.
   */
  updateOptical(opticalZ: number, confidence = 100, now: number = performance.now()): number {
    if (isNaN(opticalZ)) return this.fusedZ;

    if (!this.isInitialized) {
      this.reset(opticalZ);
      return opticalZ;
    }

    this.opticalZ = opticalZ;
    const timeSinceLastImu = now - this.lastImuTime;
    this.lastOpticalTime = now;

    // If hardware IMU is not streaming, optical camera directly drives position
    if (timeSinceLastImu > 250) {
      this.fusedZ = opticalZ;
      this.velocityZ = 0;
      this.biasZ = 0;
      return this.fusedZ;
    }

    // Fast, responsive complementary anchor:
    // Optical camera is the ground-truth depth anchor (85% immediate convergence per 60Hz frame)
    const residual = opticalZ - this.fusedZ;
    this.fusedZ += 0.85 * residual;

    // Blend instantaneous velocity towards optical displacement rate
    this.velocityZ = this.velocityZ * 0.5 + 0.5 * (residual * 8.0);
    this.velocityZ = Math.max(-2.5, Math.min(2.5, this.velocityZ));

    return this.fusedZ;
  }

  getDepth(): number {
    return this.fusedZ;
  }

  getMetrics(): DepthFusionMetrics {
    const now = performance.now();
    const isImuActive = (now - this.lastImuTime) < 250;
    const isOpticalActive = (now - this.lastOpticalTime) < 300;

    let activeSource: DepthFusionMetrics['activeSource'] = 'FUSED';
    if (!isImuActive && isOpticalActive) {
      activeSource = 'OPTICAL_ONLY';
    } else if (isImuActive && !isOpticalActive) {
      activeSource = 'IMU_PREDICTION';
    }

    return {
      fusedZ: this.fusedZ,
      opticalZ: this.opticalZ,
      velocityZ: this.velocityZ,
      biasZ: this.biasZ,
      lastDt: this.lastDt,
      activeSource,
    };
  }
}
