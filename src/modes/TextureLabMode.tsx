import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { MATERIAL_PRESETS } from '../lib/hapticPatterns';
import { audioHaptics } from '../lib/audioHaptics';

interface TextureLabModeProps {
  wandTipPosRef: React.RefObject<THREE.Vector3>;
  sendSerial: (cmd: string) => void;
  triggerHaptic: (pwm: number, ms: number) => void;
}

export const TextureLabMode: React.FC<TextureLabModeProps> = ({
  wandTipPosRef,
  sendSerial,
  triggerHaptic,
}) => {
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const lastTipPosRef = useRef(new THREE.Vector3());
  const hapticCooldownRef = useRef(0);
  const corrugatedDistanceRef = useRef(0);

  const spherePositions: [number, number, number][] = [
    [-3.75, 0.35, -0.35],
    [-1.25, 0.35, 0.15],
    [1.25, 0.35, 0.15],
    [3.75, 0.35, -0.35],
  ];

  const sphereRadius = 1.20;
  const detectionRadius = 1.28;

  useFrame((_, delta) => {
    const tipPos = wandTipPosRef.current || new THREE.Vector3();

    // Calculate wand tip velocity
    const velocity = tipPos.distanceTo(lastTipPosRef.current) / Math.max(delta, 0.001);
    const speed = Math.min(velocity, 5.0); // clamp
    lastTipPosRef.current.copy(tipPos);

    hapticCooldownRef.current += delta;
    let hitAny = false;

    spherePositions.forEach((pos, idx) => {
      const sphereCenter = new THREE.Vector3(...pos);
      const dist = tipPos.distanceTo(sphereCenter);

      if (dist < detectionRadius) {
        hitAny = true;
        const mat = MATERIAL_PRESETS[idx];

        // On first contact with new material sphere: set tip LED color matching material
        if (activeMaterialId !== mat.id) {
          setActiveMaterialId(mat.id);
          const [r, g, b] = mat.ledColor;
          sendSerial(`C,${r},${g},${b}\n`);
        }

        // Texture-specific dynamic waveform generation
        if (hapticCooldownRef.current > 0.04) {
          hapticCooldownRef.current = 0;

          if (mat.id === 'ice') {
            const pwm = Math.round(25 + speed * 15);
            triggerHaptic(pwm, 20);
            audioHaptics.playTextureWaveform('ice');
          } else if (mat.id === 'sandpaper') {
            const jitter = Math.random() * 40;
            const pwm = Math.round(140 + speed * 25 + jitter);
            triggerHaptic(pwm, 30);
            audioHaptics.playTextureWaveform('sandpaper');
          } else if (mat.id === 'metal') {
            corrugatedDistanceRef.current += speed * delta;
            if (corrugatedDistanceRef.current > 0.03) {
              corrugatedDistanceRef.current = 0;
              triggerHaptic(220, 15); // sharp ridge click
              audioHaptics.playTextureWaveform('metal');
            }
          } else if (mat.id === 'rubber') {
            const pwm = Math.round(70 + speed * 20);
            triggerHaptic(pwm, 60);
            audioHaptics.playTextureWaveform('rubber');
          }
        }
      }
    });

    if (!hitAny && activeMaterialId !== null) {
      setActiveMaterialId(null);
      sendSerial('C,0,255,255\n'); // Return tip beacon to default bright cyan
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
