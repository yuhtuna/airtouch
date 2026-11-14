import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Wand3DProps {
  positionRef: React.RefObject<[number, number, number]>;
  rotationRef: React.RefObject<[number, number, number]>;
  isPressed: boolean;
  brushRadius: number;
}

export const Wand3D = React.forwardRef<THREE.Group, Wand3DProps>(
  ({ positionRef, rotationRef, isPressed, brushRadius }, ref) => {
    const internalRef = useRef<THREE.Group>(null);
    const targetGroup = (ref as React.RefObject<THREE.Group>) || internalRef;

    useFrame(() => {
      if (targetGroup.current) {
        const pos = positionRef.current || [0, 0, 0];
        const rot = rotationRef.current || [0, 0, 0];

        // Smooth lerp to live reference position
        targetGroup.current.position.lerp(new THREE.Vector3(pos[0], pos[1], pos[2]), 0.4);

        // Smooth slerp to live reference rotation
        const targetEuler = new THREE.Euler(
          (rot[0] * Math.PI) / 180, // Pitch (X)
          (rot[1] * Math.PI) / 180, // Yaw (Y)
          (rot[2] * Math.PI) / 180, // Roll (Z)
          'YXZ'
        );
        const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);
        targetGroup.current.quaternion.slerp(targetQuat, 0.4);
      }
    });

    return (
      <group ref={targetGroup}>
        {/* Wand Handle */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 1.3, 24]} />
          <meshStandardMaterial
            color="#1e293b"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>

        {/* Arduino Nano Module Shell (Classic Blue PCB + Microcontroller package) */}
        <mesh position={[0, 0.09, -0.05]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.2, 0.05, 0.52]} />
          <meshStandardMaterial
            color="#0284c7"
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>

        {/* ATmega328P IC Package */}
        <mesh position={[0, 0.125, -0.05]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[0.1, 0.03, 0.1]} />
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Illuminated Pushbutton Switch (Pin 2) */}
        <mesh position={[0, 0.13, 0.28]}>
          <cylinderGeometry args={[0.045, 0.045, 0.04, 16]} />
          <meshStandardMaterial
            color={isPressed ? '#ef4444' : '#64748b'}
            emissive={isPressed ? '#ef4444' : '#000000'}
            emissiveIntensity={isPressed ? 2.5 : 0}
            roughness={0.3}
          />
        </mesh>

        {/* Diffused Optical Tracking Beacon (12mm tip at Pin 3) */}
        <mesh position={[0, 0, 0.68]}>
          <sphereGeometry args={[0.11, 24, 24]} />
          <meshStandardMaterial
            color="#22d3ee"
            emissive="#22d3ee"
            emissiveIntensity={2.5}
            roughness={0.1}
          />
        </mesh>

        {/* Dynamic Brush Radius Reticle Sphere around tip */}
        <mesh position={[0, 0, 0.68]}>
          <sphereGeometry args={[0.11 * brushRadius, 16, 16]} />
          <meshStandardMaterial
            color="#38bdf8"
            wireframe
            transparent
            opacity={0.35}
          />
        </mesh>

        {/* Point light emitted by tip beacon */}
        <pointLight position={[0, 0, 0.7]} color="#22d3ee" intensity={1.5} distance={3} />
      </group>
    );
  }
);
