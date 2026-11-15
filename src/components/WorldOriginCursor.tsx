import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WorldOriginCursorProps {
  wandTipPosRef?: React.RefObject<THREE.Vector3>;
}

export const WorldOriginCursor: React.FC<WorldOriginCursorProps> = ({ wandTipPosRef }) => {
  const floorMarkerRef = useRef<THREE.Group>(null);
  const dropLineRef = useRef<THREE.Line>(null);
  const lineGeomRef = useRef<THREE.BufferGeometry>(null);

  useFrame(() => {
    if (!wandTipPosRef?.current) return;
    const tip = wandTipPosRef.current;

    // Position floor shadow directly under wand tip at floor level (y = -2.39)
    if (floorMarkerRef.current) {
      floorMarkerRef.current.position.set(tip.x, -2.39, tip.z);
    }

    // Update vertical drop-line connecting wand tip to floor
    if (lineGeomRef.current) {
      const positions = new Float32Array([
        tip.x, tip.y, tip.z,
        tip.x, -2.39, tip.z,
      ]);
      lineGeomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      lineGeomRef.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* 1. BLENDER-STYLE 3D ORIGIN PIVOT AT (0, 0, 0) */}
      <group position={[0, 0, 0]}>
        {/* Ground Plane Origin Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.46, 48]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>

        {/* Outer Dashed Reference Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.78, 0.82, 32]} />
          <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} transparent opacity={0.6} wireframe />
        </mesh>

        {/* Central Pivot Sphere */}
        <mesh>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={1.2}
          />
        </mesh>

        {/* Blender-style 3D Axis Stems (X=Red, Y=Green, Z=Blue) */}
        {/* +X Axis (Red) */}
        <line>
          <bufferGeometry attach="geometry" {...createAxisGeom([0, 0, 0], [0.9, 0, 0])} />
          <lineBasicMaterial color="#ef4444" linewidth={2} />
        </line>
        {/* +Y Axis (Green) */}
        <line>
          <bufferGeometry attach="geometry" {...createAxisGeom([0, 0, 0], [0, 0.9, 0])} />
          <lineBasicMaterial color="#22c55e" linewidth={2} />
        </line>
        {/* +Z Axis (Blue - Depth!) */}
        <line>
          <bufferGeometry attach="geometry" {...createAxisGeom([0, 0, 0], [0, 0, 0.9])} />
          <lineBasicMaterial color="#3b82f6" linewidth={2} />
        </line>
      </group>

      {/* 2. DYNAMIC DEPTH DROP-LINE (Connects tip to floor for instant 3D depth perception) */}
      {wandTipPosRef && (
        <>
          <line ref={dropLineRef}>
            <bufferGeometry ref={lineGeomRef} />
            <lineDashedMaterial
              color="#38bdf8"
              dashSize={0.08}
              gapSize={0.05}
              transparent
              opacity={0.4}
            />
          </line>

          {/* Floor Shadow Ring on Ground */}
          <group ref={floorMarkerRef} position={[0, -2.39, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.12, 0.18, 24]} />
              <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.5} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.06, 16]} />
              <meshBasicMaterial color="#0284c7" side={THREE.DoubleSide} transparent opacity={0.6} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
};

function createAxisGeom(start: [number, number, number], end: [number, number, number]) {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array([...start, ...end]);
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geom;
}
