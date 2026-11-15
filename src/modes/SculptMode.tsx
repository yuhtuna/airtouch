import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Stroke, StrokePoint, SculptTool, SculptTarget } from '../types/telemetry';

interface SculptModeProps {
  wandTipPosRef: React.RefObject<THREE.Vector3>;
  isTriggerHeld: boolean;
  brushRadius: number;
  tool: SculptTool;
  sculptTarget: SculptTarget;
  strokes: Stroke[];
  onAddCompletedStroke: (stroke: Stroke) => void;
  onEraseAtTip: (tipPos: THREE.Vector3, radius: number) => void;
  triggerHaptic: (pwm: number, ms: number) => void;
  clayResetTrigger?: number;
  wireframe?: boolean;
  clayColor?: string;
}

// Cached Static Mesh for Completed Freehand Air Strokes
const CompletedStroke: React.FC<{ stroke: Stroke }> = React.memo(({ stroke }) => {
  const geom = useMemo(() => {
    if (stroke.points.length < 3) return null;

    try {
      const curvePoints = stroke.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const radius = stroke.points[0]?.radius || 0.08;
      return new THREE.TubeGeometry(
        curve,
        Math.min(stroke.points.length * 4, 128),
        radius,
        8,
        false
      );
    } catch (e) {
      return null;
    }
  }, [stroke]);

  useEffect(() => {
    return () => {
      geom?.dispose();
    };
  }, [geom]);

  if (!geom) return null;

  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color="#38bdf8"
        emissive="#0284c7"
        emissiveIntensity={0.25}
        roughness={0.2}
        metalness={0.4}
      />
    </mesh>
  );
});

export const SculptMode: React.FC<SculptModeProps> = ({
  wandTipPosRef,
  isTriggerHeld,
  brushRadius,
  tool,
  sculptTarget,
  strokes,
  onAddCompletedStroke,
  onEraseAtTip,
  triggerHaptic,
  clayResetTrigger = 0,
  wireframe = false,
  clayColor = '#ea580c', // Studio Terracotta Clay
}) => {
  // Freehand Air Draw State
  const [activePoints, setActivePoints] = useState<StrokePoint[]>([]);
  const activePointsRef = useRef<StrokePoint[]>([]);
  const lastPosRef = useRef<THREE.Vector3 | null>(null);
  const wasDrawingRef = useRef(false);
  const hapticTimerRef = useRef(0);

  // Digital Clay Sphere Geometry (Subdivided Icosahedron for uniform organic vertex distribution)
  const sphereRadius = 1.75;
  const clayGeom = useMemo(() => {
    const geom = new THREE.IcosahedronGeometry(sphereRadius, 5); // ~2562 vertices, 5120 faces
    return geom;
  }, [sphereRadius]);

  // Clone original pristine vertex positions for reset / smooth operations
  const basePositions = useMemo(() => {
    return Float32Array.from(clayGeom.attributes.position.array);
  }, [clayGeom]);

  // Reset clay back to pristine smooth sphere when trigger prop changes
  useEffect(() => {
    if (clayGeom && basePositions) {
      const posAttr = clayGeom.attributes.position as THREE.BufferAttribute;
      posAttr.array.set(basePositions);
      posAttr.needsUpdate = true;
      clayGeom.computeVertexNormals();
    }
  }, [clayResetTrigger, clayGeom, basePositions]);

  // Dispose clay geometry on unmount
  useEffect(() => {
    return () => {
      clayGeom.dispose();
    };
  }, [clayGeom]);

  // Surface Reticle State for Sculpt Brush Projection
  const reticleRef = useRef<THREE.Group>(null);
  const reticleRingRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const tipPos = wandTipPosRef.current || new THREE.Vector3(0, 0, 0);

    // ========================================================
    // MODE A: DIGITAL CLAY SCULPTING (BLENDER-STYLE OBJECT ANCHOR)
    // ========================================================
    if (sculptTarget === 'CLAY') {
      const posAttr = clayGeom.attributes.position as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;

      // Project reticle ring onto clay surface facing outwards
      const distToCenter = tipPos.length();
      const normalDir = distToCenter > 0.001 ? tipPos.clone().normalize() : new THREE.Vector3(0, 0, 1);
      const surfacePoint = normalDir.clone().multiplyScalar(sphereRadius);

      if (reticleRef.current) {
        reticleRef.current.position.copy(surfacePoint);
        reticleRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalDir);
      }

      if (reticleRingRef.current) {
        reticleRingRef.current.position.copy(tipPos);
      }

      if (isTriggerHeld) {
        // Continuous tactile haptic buzz while actively sculpting/carving clay
        hapticTimerRef.current += delta;
        if (hapticTimerRef.current > 0.05) {
          hapticTimerRef.current = 0;
          const hapticPwm = tool === 'DRAW' ? 85 : tool === 'ERASE' ? 140 : 65;
          triggerHaptic(hapticPwm, 35);
        }

        const effectiveBrushRadius = Math.max(0.2, 0.42 * brushRadius);
        const brushRadiusSq = effectiveBrushRadius * effectiveBrushRadius;
        const sculptSpeed = (tool === 'DRAW' ? 0.95 : tool === 'ERASE' ? 0.95 : 0.65) * Math.min(delta, 0.05);

        let modified = false;
        const count = posAttr.count;

        for (let i = 0; i < count; i++) {
          const vx = positions[i * 3];
          const vy = positions[i * 3 + 1];
          const vz = positions[i * 3 + 2];

          const dx = vx - tipPos.x;
          const dy = vy - tipPos.y;
          const dz = vz - tipPos.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < brushRadiusSq) {
            modified = true;
            const dist = Math.sqrt(distSq);
            // Cubic smooth bell falloff: (1 - (dist / R)^2)^2
            const normDist = dist / effectiveBrushRadius;
            const falloff = Math.pow(1 - normDist * normDist, 2);

            // Outward vertex normal
            const vLen = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
            const nx = vx / vLen;
            const ny = vy / vLen;
            const nz = vz / vLen;

            if (tool === 'DRAW') {
              // INFLATE / ADD CLAY: Extrude outward along surface normal
              const displacement = sculptSpeed * falloff;
              // Limit max extrusion to 3.2 units to maintain solid geometry
              if (vLen + displacement < 3.2) {
                positions[i * 3] += nx * displacement;
                positions[i * 3 + 1] += ny * displacement;
                positions[i * 3 + 2] += nz * displacement;
              }
            } else if (tool === 'ERASE') {
              // CARVE / PUSH IN: Depress clay inward along surface normal
              const displacement = sculptSpeed * falloff;
              // Limit min depression to 0.4 units (core core floor)
              if (vLen - displacement > 0.4) {
                positions[i * 3] -= nx * displacement;
                positions[i * 3 + 1] -= ny * displacement;
                positions[i * 3 + 2] -= nz * displacement;
              }
            } else if (tool === 'SMOOTH') {
              // LEVEL / SMOOTH: Lerp back towards original base sphere radius
              const targetX = basePositions[i * 3];
              const targetY = basePositions[i * 3 + 1];
              const targetZ = basePositions[i * 3 + 2];
              const smoothFactor = 0.22 * falloff;
              positions[i * 3] = vx * (1 - smoothFactor) + targetX * smoothFactor;
              positions[i * 3 + 1] = vy * (1 - smoothFactor) + targetY * smoothFactor;
              positions[i * 3 + 2] = vz * (1 - smoothFactor) + targetZ * smoothFactor;
            }
          }
        }

        if (modified) {
          posAttr.needsUpdate = true;
          clayGeom.computeVertexNormals();
        }
      }
    }

    // ========================================================
    // MODE B: FREEHAND 3D AIR DRAWING
    // ========================================================
    if (sculptTarget === 'AIR') {
      if (isTriggerHeld) {
        if (tool === 'DRAW') {
          hapticTimerRef.current += delta;
          if (hapticTimerRef.current > 0.05) {
            hapticTimerRef.current = 0;
            triggerHaptic(85, 45);
          }

          if (!lastPosRef.current || lastPosRef.current.distanceTo(tipPos) > 0.035) {
            const newPt: StrokePoint = {
              x: tipPos.x,
              y: tipPos.y,
              z: tipPos.z,
              radius: 0.075 * brushRadius,
              color: '#38bdf8',
            };
            lastPosRef.current = tipPos.clone();
            activePointsRef.current.push(newPt);
            setActivePoints([...activePointsRef.current]);
          }
          wasDrawingRef.current = true;
        } else if (tool === 'ERASE') {
          hapticTimerRef.current += delta;
          if (hapticTimerRef.current > 0.06) {
            hapticTimerRef.current = 0;
            triggerHaptic(160, 30);
          }
          onEraseAtTip(tipPos, 0.25 * brushRadius);
        }
      } else {
        if (wasDrawingRef.current) {
          const completedPoints = [...activePointsRef.current];
          if (completedPoints.length >= 3) {
            onAddCompletedStroke({
              id: Math.random().toString(36).substring(2, 9),
              points: completedPoints,
            });
          }
          activePointsRef.current = [];
          setActivePoints([]);
          lastPosRef.current = null;
          wasDrawingRef.current = false;
          triggerHaptic(0, 0);
        }
      }
    }
  });

  // Active freehand stroke dynamic preview geometry
  const activeGeom = useMemo(() => {
    if (activePoints.length < 3) return null;
    try {
      const curvePoints = activePoints.map((p) => new THREE.Vector3(p.x, p.y, p.z));
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const radius = activePoints[0]?.radius || 0.075;
      return new THREE.TubeGeometry(
        curve,
        Math.min(activePoints.length * 3, 96),
        radius,
        6,
        false
      );
    } catch (e) {
      return null;
    }
  }, [activePoints]);

  useEffect(() => {
    return () => {
      activeGeom?.dispose();
    };
  }, [activeGeom]);

  const effectiveRadius = Math.max(0.2, 0.42 * brushRadius);

  return (
    <group>
      {/* ======================================================== */}
      {/* BLENDER-STYLE CENTRAL DEFORMABLE CLAY OBJECT (BIG SPHERE) */}
      {/* ======================================================== */}
      {sculptTarget === 'CLAY' && (
        <group position={[0, 0, 0]}>
          {/* Main Deformable Clay Mesh */}
          <mesh geometry={clayGeom} castShadow receiveShadow>
            <meshStandardMaterial
              color={clayColor}
              roughness={0.45}
              metalness={0.12}
              wireframe={wireframe}
            />
          </mesh>

          {/* Wireframe Topology Accent when wireframe is off for studio look */}
          {!wireframe && (
            <mesh geometry={clayGeom}>
              <meshBasicMaterial
                color="#000000"
                wireframe
                transparent
                opacity={0.06}
              />
            </mesh>
          )}

          {/* Interactive Projected Surface Sculpt Reticle */}
          <group ref={reticleRef}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[effectiveRadius * 0.88, effectiveRadius * 1.02, 32]} />
              <meshBasicMaterial
                color={tool === 'DRAW' ? '#38bdf8' : tool === 'ERASE' ? '#ef4444' : '#10b981'}
                side={THREE.DoubleSide}
                transparent
                opacity={0.8}
              />
            </mesh>
            <pointLight
              color={tool === 'DRAW' ? '#38bdf8' : tool === 'ERASE' ? '#ef4444' : '#10b981'}
              intensity={0.6}
              distance={1.5}
            />
          </group>

          {/* 3D Brush Radius Sphere following Wand Tip */}
          <group ref={reticleRingRef}>
            <mesh>
              <sphereGeometry args={[effectiveRadius, 16, 16]} />
              <meshBasicMaterial
                color={tool === 'DRAW' ? '#38bdf8' : tool === 'ERASE' ? '#ef4444' : '#10b981'}
                wireframe
                transparent
                opacity={0.35}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* ======================================================== */}
      {/* FREEHAND AIR DRAWING STROKES */}
      {/* ======================================================== */}
      {/* Permanent Baked Strokes */}
      {strokes.map((stroke) => (
        <CompletedStroke key={stroke.id} stroke={stroke} />
      ))}

      {/* Real-time Active Drawing Preview */}
      {sculptTarget === 'AIR' && activeGeom && (
        <mesh geometry={activeGeom}>
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={0.5}
            roughness={0.1}
          />
        </mesh>
      )}

      {/* Visual Erase Reticle when ERASE mode is selected in AIR DRAW */}
      {sculptTarget === 'AIR' && tool === 'ERASE' && wandTipPosRef.current && (
        <mesh position={[wandTipPosRef.current.x, wandTipPosRef.current.y, wandTipPosRef.current.z]}>
          <sphereGeometry args={[0.25 * brushRadius, 16, 16]} />
          <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
};
