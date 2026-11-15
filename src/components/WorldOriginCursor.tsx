import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WorldOriginCursorProps {
  wandTipPosRef?: React.RefObject<THREE.Vector3>;
}

export const WorldOriginCursor: React.FC<WorldOriginCursorProps> = ({ wandTipPosRef }) => {
  const floorMarkerRef = useRef<THREE.Group>(null);
  const laserBeamRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!wandTipPosRef?.current) return;
    const tip = wandTipPosRef.current;

    // Guard against NaN
    if (isNaN(tip.x) || isNaN(tip.y) || isNaN(tip.z)) return;

    const floorY = -2.39;

    // Position floor shadow directly under wand tip on grid floor
    if (floorMarkerRef.current) {
      floorMarkerRef.current.position.set(tip.x, floorY, tip.z);
    }

    // Position and scale vertical laser beam connecting wand tip to floor
    if (laserBeamRef.current) {
      const height = Math.max(0.01, tip.y - floorY);
      laserBeamRef.current.scale.set(1, height, 1);
      laserBeamRef.current.position.set(tip.x, floorY + height / 2, tip.z);
    }
  });

  return (
    <group>
      {/* 1. BLENDER-STYLE 3D ORIGIN PIVOT ON GRID FLOOR (-2.39) */}
      <group position={[0, -2.39, 0]}>
        {/* Ground Plane Origin Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.48, 48]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>

        {/* Outer Reference Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.78, 0.84, 32]} />
          <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} transparent opacity={0.5} wireframe />
        </mesh>

        {/* Central Pivot Sphere */}
        <mesh>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={1.5}
          />
        </mesh>

        {/* Blender 3D Cardinal Axes (X=Red, Y=Green Up, Z=Blue Depth) */}
        {/* +X Axis (Red) */}
        <mesh position={[0.6, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, 1.2, 8]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        {/* +Y Axis (Green - Upwards) */}
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.2, 8]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        {/* +Z Axis (Blue - Depth Forward) */}
        <mesh position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.2, 8]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      </group>

      {/* 2. DYNAMIC DEPTH DROP-LINE (Cylinder Laser Beam - 100% WebGL Safe) */}
      {wandTipPosRef && (
        <>
          <mesh ref={laserBeamRef}>
            <cylinderGeometry args={[0.01, 0.01, 1, 8]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.5}
              depthWrite={false}
            />
          </mesh>

          {/* Floor Shadow Ring on Ground (Slides in real-time with X and Z depth) */}
          <group ref={floorMarkerRef} position={[0, -2.39, 0]}>
            {/* Outer expanding target ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.26, 0.32, 32]} />
              <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.7} />
            </mesh>
            {/* Inner target bullseye */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.1, 20]} />
              <meshBasicMaterial color="#0284c7" side={THREE.DoubleSide} transparent opacity={0.8} />
            </mesh>
            {/* Outer dashed radar ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.5, 0.54, 32]} />
              <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.35} wireframe />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
};
