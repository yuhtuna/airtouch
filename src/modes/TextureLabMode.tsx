import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { MATERIAL_PRESETS } from '../lib/hapticPatterns';
import { audioHaptics } from '../lib/audioHaptics';

interface TextureLabModeProps {
  wandRotRef?: React.RefObject<[number, number, number]>;
  wandTipPosRef: React.RefObject<THREE.Vector3>;
  isTriggerHeld?: boolean;
  isTriggerHeldRef?: React.RefObject<boolean>;
  sendSerial: (cmd: string) => void;
  triggerHaptic: (pwm: number, ms: number) => void;
}

export const TextureLabMode: React.FC<TextureLabModeProps> = ({
  wandRotRef,
  wandTipPosRef,
  isTriggerHeld = false,
  isTriggerHeldRef,
  sendSerial,
  triggerHaptic,
}) => {
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const lastTipPosRef = useRef(new THREE.Vector3());
  const hapticCooldownRef = useRef(0);

  // Position spheres within physical reaching envelope of the wand tip
  const spherePositions: [number, number, number][] = [
    [-2.7, 0.25, 0.35],
    [-0.9, 0.25, 0.75],
    [0.9, 0.25, 0.75],
    [2.7, 0.25, 0.35],
  ];

  const sphereRadius = 1.15;

  useFrame((_, delta) => {
    const tipPos = wandTipPosRef.current || new THREE.Vector3();
    const rot = wandRotRef?.current || [0, 0, 0];
    const activeTrigger = Boolean((isTriggerHeldRef && isTriggerHeldRef.current) || isTriggerHeld);

    // Calculate wand tip velocity
    const velocity = tipPos.distanceTo(lastTipPosRef.current) / Math.max(delta, 0.001);
    const speed = Math.min(velocity, 5.0);
    lastTipPosRef.current.copy(tipPos);

    // Calculate forward pointing vector from wand Euler orientation (YXZ)
    const euler = new THREE.Euler(
      (rot[0] * Math.PI) / 180,
      (rot[1] * Math.PI) / 180,
      (rot[2] * Math.PI) / 180,
      'YXZ'
    );
    const forwardDir = new THREE.Vector3(0, 0, 1).applyEuler(euler);

    let bestSphereIdx = -1;
    let minAimScore = Infinity;

    spherePositions.forEach((pos, idx) => {
      const sphereCenter = new THREE.Vector3(...pos);
      const distToTip = tipPos.distanceTo(sphereCenter);

      // 1. Direct physical 3D touch / penetration
      if (distToTip < sphereRadius + 0.35) {
        if (distToTip < minAimScore) {
          minAimScore = distToTip;
          bestSphereIdx = idx;
        }
      } else {
        // 2. Optical / IMU forward raycast targeting (when pointing at sphere)
        const toSphere = sphereCenter.clone().sub(tipPos);
        const distAlongRay = toSphere.dot(forwardDir);
        if (distAlongRay > 0.2 && distAlongRay < 5.0) {
          const closestPointOnRay = tipPos.clone().addScaledVector(forwardDir, distAlongRay);
          const perpDist = closestPointOnRay.distanceTo(sphereCenter);
          if (perpDist < sphereRadius + 0.45) {
            const score = perpDist + distAlongRay * 0.15;
            if (score < minAimScore) {
              minAimScore = score;
              bestSphereIdx = idx;
            }
          }
        }
      }
    });

    if (bestSphereIdx !== -1) {
      const mat = MATERIAL_PRESETS[bestSphereIdx];

      // Sync LED optical color to current material
      if (activeMaterialId !== mat.id) {
        setActiveMaterialId(mat.id);
        const [r, g, b] = mat.ledColor;
        sendSerial(`C,${r},${g},${b}\n`);
      }

      hapticCooldownRef.current += delta;

      // ========================================================
      // PRIMARY INTERACTION: BUTTON PRESSED / HELD ON SPHERE
      // ========================================================
      if (activeTrigger) {
        if (hapticCooldownRef.current > 0.05) {
          hapticCooldownRef.current = 0;

          if (mat.id === 'ice') {
            // Slick, smooth high-frequency vibration
            triggerHaptic(170, 55);
            audioHaptics.playTextureWaveform('ice');
          } else if (mat.id === 'sandpaper') {
            // Rough, aggressive granular friction buzz
            const jitter = Math.round(Math.random() * 35);
            triggerHaptic(220 + jitter, 55);
            audioHaptics.playTextureWaveform('sandpaper');
          } else if (mat.id === 'metal') {
            // Heavy crisp detent ridge pulses
            triggerHaptic(255, 45);
            audioHaptics.playTextureWaveform('metal');
          } else if (mat.id === 'rubber') {
            // Deep viscoelastic drag buzz
            triggerHaptic(195, 75);
            audioHaptics.playTextureWaveform('rubber');
          }
        }
      } else {
        // Hover / Stroke across surface without pressing button
        if (speed > 0.15 && hapticCooldownRef.current > 0.06) {
          hapticCooldownRef.current = 0;
          const hapticPwm =
            mat.id === 'ice'
              ? 140
              : mat.id === 'sandpaper'
              ? 200
              : mat.id === 'metal'
              ? 240
              : 175;
          triggerHaptic(hapticPwm, 45);
          audioHaptics.playTextureWaveform(mat.id as any);
        }
      }
    } else {
      if (activeMaterialId !== null) {
        setActiveMaterialId(null);
        sendSerial('C,0,255,255\n'); // Return tip beacon to default bright cyan
        triggerHaptic(0, 0);
      }
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {MATERIAL_PRESETS.map((mat, index) => {
        const isHovered = activeMaterialId === mat.id;
        const pos = spherePositions[index];

        return (
          <group key={mat.id} position={pos}>
            {/* 3D Title Label */}
            <Text
              position={[0, 1.70, 0]}
              fontSize={0.28}
              color={isHovered ? '#38bdf8' : '#e2e8f0'}
              anchorX="center"
              anchorY="middle"
            >
              {mat.name}
            </Text>

            {/* Sub-label description */}
            <Text
              position={[0, 1.42, 0]}
              fontSize={0.15}
              color={isHovered ? '#93c5fd' : '#94a3b8'}
              anchorX="center"
              anchorY="middle"
            >
              {mat.description}
            </Text>

            {/* Material Sphere (Enlarged to 1.20 radius / 2.4 diameter) */}
            <mesh
              scale={isHovered ? 1.05 : 1.0}
              castShadow
              receiveShadow
              onPointerOver={() => {
                setActiveMaterialId(mat.id);
                const [r, g, b] = mat.ledColor;
                sendSerial(`C,${r},${g},${b}\n`);
                audioHaptics.playTextureWaveform(mat.id as any);
              }}
            >
              <sphereGeometry args={[sphereRadius, 48, 48]} />
              <meshStandardMaterial
                color={mat.color}
                roughness={mat.roughness}
                metalness={mat.metalness}
                emissive={mat.color}
                emissiveIntensity={isHovered ? 0.45 : 0.04}
              />
            </mesh>

            {/* Local Glow Light when Hovered/Touched */}
            {isHovered && (
              <pointLight color={mat.color} intensity={1.8} distance={3.5} />
            )}

            {/* Pedestal Base */}
            <mesh position={[0, -1.35, 0]}>
              <cylinderGeometry args={[0.55, 0.85, 0.5, 32]} />
              <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
            </mesh>

            {/* Active Floor Ring Halo */}
            {isHovered && (
              <mesh position={[0, -1.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.85, 1.25, 32]} />
                <meshBasicMaterial color={mat.color} transparent opacity={0.6} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};
