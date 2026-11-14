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
    [-2.4, 0.2, 0],
    [-0.8, 0.2, 0],
    [0.8, 0.2, 0],
    [2.4, 0.2, 0],
  ];

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
      const radius = 0.72;

      if (dist < radius) {
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
            {/* 3D Label */}
            <Text
              position={[0, 1.1, 0]}
              fontSize={0.22}
              color={isHovered ? '#38bdf8' : '#94a3b8'}
              anchorX="center"
              anchorY="middle"
            >
              {mat.name}
            </Text>

            {/* Sub-label */}
            <Text
              position={[0, 0.88, 0]}
              fontSize={0.12}
              color="#64748b"
              anchorX="center"
              anchorY="middle"
            >
              {mat.description}
            </Text>

            {/* Material Sphere */}
            <mesh scale={isHovered ? 1.06 : 1.0}>
              <sphereGeometry args={[0.65, 36, 36]} />
              <meshStandardMaterial
                color={mat.color}
                roughness={mat.roughness}
                metalness={mat.metalness}
                emissive={isHovered ? mat.color : '#000000'}
                emissiveIntensity={isHovered ? 0.4 : 0}
              />
            </mesh>

            {/* Pedestal Base */}
            <mesh position={[0, -0.9, 0]}>
              <cylinderGeometry args={[0.3, 0.45, 0.4, 24]} />
              <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
