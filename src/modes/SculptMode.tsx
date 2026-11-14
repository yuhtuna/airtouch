import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Stroke, StrokePoint, SculptTool } from '../types/telemetry';

interface SculptModeProps {
  wandTipPosRef: React.RefObject<THREE.Vector3>;
  isTriggerHeld: boolean;
  brushRadius: number;
  tool: SculptTool;
  strokes: Stroke[];
  onAddCompletedStroke: (stroke: Stroke) => void;
  onEraseAtTip: (tipPos: THREE.Vector3, radius: number) => void;
  triggerHaptic: (pwm: number, ms: number) => void;
}

// Cached Static Mesh for Completed Strokes
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
  strokes,
  onAddCompletedStroke,
  onEraseAtTip,
  triggerHaptic,
}) => {
  const [activePoints, setActivePoints] = useState<StrokePoint[]>([]);
  const lastPosRef = useRef<THREE.Vector3 | null>(null);
  const wasDrawingRef = useRef(false);
  const hapticTimerRef = useRef(0);

  useFrame((_, delta) => {
    const tipPos = wandTipPosRef.current || new THREE.Vector3(0, 0, 0);

    if (isTriggerHeld) {
      if (tool === 'DRAW') {
        // Continuous subtle haptic buzz while extruding
        hapticTimerRef.current += delta;
        if (hapticTimerRef.current > 0.05) {
          hapticTimerRef.current = 0;
          triggerHaptic(85, 45);
        }

        // Sample points along stroke path with minimum distance threshold
        if (!lastPosRef.current || lastPosRef.current.distanceTo(tipPos) > 0.035) {
          const newPt: StrokePoint = {
            x: tipPos.x,
            y: tipPos.y,
            z: tipPos.z,
            radius: 0.075 * brushRadius,
            color: '#38bdf8',
          };
          lastPosRef.current = tipPos.clone();
          setActivePoints((prev) => [...prev, newPt]);
        }
        wasDrawingRef.current = true;
      } else if (tool === 'ERASE') {
        // Erase strokes near tip
        hapticTimerRef.current += delta;
        if (hapticTimerRef.current > 0.06) {
          hapticTimerRef.current = 0;
          triggerHaptic(160, 30);
        }
        onEraseAtTip(tipPos, 0.25 * brushRadius);
      }
    } else {
      if (wasDrawingRef.current) {
        // Finalize active stroke into permanent list
        if (activePoints.length >= 3) {
          onAddCompletedStroke({
            id: Math.random().toString(36).substring(2, 9),
            points: [...activePoints],
          });
        }
        setActivePoints([]);
        lastPosRef.current = null;
        wasDrawingRef.current = false;
        triggerHaptic(0, 0); // Stop buzz
      }
    }
  });

  // Active stroke dynamic preview geometry
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

  // Clean up WebGL GPU geometry buffers on activeGeom updates to avoid memory leaks
  useEffect(() => {
    return () => {
      activeGeom?.dispose();
    };
  }, [activeGeom]);

  return (
    <group>
      {/* Permanent Baked Strokes */}
      {strokes.map((stroke) => (
        <CompletedStroke key={stroke.id} stroke={stroke} />
      ))}

      {/* Real-time Active Drawing Preview */}
      {activeGeom && (
        <mesh geometry={activeGeom}>
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={0.5}
            roughness={0.1}
          />
        </mesh>
      )}

      {/* Visual Erase Reticle when ERASE mode is selected */}
      {tool === 'ERASE' && wandTipPosRef.current && (
        <mesh position={[wandTipPosRef.current.x, wandTipPosRef.current.y, wandTipPosRef.current.z]}>
          <sphereGeometry args={[0.25 * brushRadius, 16, 16]} />
          <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
};
