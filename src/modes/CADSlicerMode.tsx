import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CADSlicerModeProps {
  wandRotRef: React.RefObject<[number, number, number]>;
  wandTipPosRef: React.RefObject<THREE.Vector3>;
  isTriggerPressed: boolean;
  triggerHaptic: (pwm: number, ms: number) => void;
}

export const CADSlicerMode: React.FC<CADSlicerModeProps> = ({
  wandRotRef,
  wandTipPosRef,
  isTriggerPressed,
  triggerHaptic,
}) => {
  const { gl } = useThree();
  const [explodedFactor, setExplodedFactor] = useState(0);
  const clippingPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const wasPressedRef = useRef(false);
  const rotationAngleRef = useRef(0);

  // Enable local clipping on WebGLRenderer
  gl.localClippingEnabled = true;

  useFrame((_, delta) => {
    const rot = wandRotRef.current || [0, 0, 0];
    const tipPos = wandTipPosRef.current || new THREE.Vector3(0, 0, 0);

    // Slicer plane orientation derived from wand tilt (pitch and roll)
    const euler = new THREE.Euler(
      (rot[0] * Math.PI) / 180,
      (rot[1] * Math.PI) / 180,
      (rot[2] * Math.PI) / 180,
      'YXZ'
    );
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(euler);
    clippingPlane.set(normal, -tipPos.dot(normal));

    // Dynamic planetary gear rotation
    rotationAngleRef.current += delta * 1.2;

    // Exploder factor interpolation when trigger is held
    if (isTriggerPressed) {
      setExplodedFactor((prev) => Math.min(prev + delta * 2.0, 1.0));
      if (!wasPressedRef.current) {
        triggerHaptic(150, 40); // grab thud
        wasPressedRef.current = true;
      }
    } else {
      setExplodedFactor((prev) => Math.max(prev - delta * 2.2, 0.0));
      wasPressedRef.current = false;
    }
  });

  const partMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0284c7',
        metalness: 0.8,
        roughness: 0.25,
        clippingPlanes: [clippingPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),
    [clippingPlane]
  );

  const goldMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#eab308',
        metalness: 0.9,
        roughness: 0.2,
        clippingPlanes: [clippingPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),
    [clippingPlane]
  );

  const steelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        metalness: 0.7,
        roughness: 0.35,
        clippingPlanes: [clippingPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),
    [clippingPlane]
  );

  const sunAngle = rotationAngleRef.current;
  const planetOrbitAngle = sunAngle * 0.4;
  const planetSpinAngle = -sunAngle * 1.5;

  return (
    <group position={[0, 0.5, 0]}>
      {/* Central Drive Shaft */}
      <mesh
        material={steelMaterial}
        position={[0, explodedFactor * 1.2, 0]}
        rotation={[0, sunAngle, 0]}
      >
        <cylinderGeometry args={[0.2, 0.2, 2.5, 32]} />
      </mesh>

      {/* Sun Gear (Center) */}
      <mesh
        material={goldMaterial}
        position={[0, 0, 0]}
        rotation={[0, sunAngle, 0]}
      >
        <cylinderGeometry args={[0.7, 0.7, 0.4, 24]} />
      </mesh>

      {/* Planetary Gear 1 */}
      <mesh
        material={partMaterial}
        position={[
          (1.2 + explodedFactor * 1.2) * Math.cos(planetOrbitAngle),
          explodedFactor * 0.4,
          (1.2 + explodedFactor * 1.2) * Math.sin(planetOrbitAngle),
        ]}
        rotation={[0, planetSpinAngle, 0]}
      >
        <cylinderGeometry args={[0.45, 0.45, 0.38, 20]} />
      </mesh>

      {/* Planetary Gear 2 */}
      <mesh
        material={partMaterial}
        position={[
          (1.2 + explodedFactor * 1.2) * Math.cos(planetOrbitAngle + (2 * Math.PI) / 3),
          explodedFactor * 0.4,
          (1.2 + explodedFactor * 1.2) * Math.sin(planetOrbitAngle + (2 * Math.PI) / 3),
        ]}
        rotation={[0, planetSpinAngle, 0]}
      >
        <cylinderGeometry args={[0.45, 0.45, 0.38, 20]} />
      </mesh>

      {/* Planetary Gear 3 */}
      <mesh
        material={partMaterial}
        position={[
          (1.2 + explodedFactor * 1.2) * Math.cos(planetOrbitAngle + (4 * Math.PI) / 3),
          explodedFactor * 0.4,
          (1.2 + explodedFactor * 1.2) * Math.sin(planetOrbitAngle + (4 * Math.PI) / 3),
        ]}
        rotation={[0, planetSpinAngle, 0]}
      >
        <cylinderGeometry args={[0.45, 0.45, 0.38, 20]} />
      </mesh>

      {/* Outer Ring Housing */}
      <mesh
        material={steelMaterial}
        position={[0, -explodedFactor * 0.8, 0]}
        scale={[1 + explodedFactor * 0.4, 1, 1 + explodedFactor * 0.4]}
      >
        <torusGeometry args={[2.0, 0.22, 16, 64]} />
      </mesh>
    </group>
  );
};
