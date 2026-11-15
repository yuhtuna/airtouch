import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

export const RotatingBackground: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.25;
      ring1Ref.current.rotation.z += delta * 0.18;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.2;
      ring2Ref.current.rotation.x -= delta * 0.12;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.5, 0]}>
      {/* Outer Floating Gyro Rings */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[3.2, 0.04, 16, 100]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.8}
          wireframe
        />
      </mesh>

      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.5, 0.03, 16, 100]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#7c3aed"
          emissiveIntensity={0.6}
          wireframe
        />
      </mesh>

      {/* Futuristic Floating Central Core */}
      <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[1.2, 1]} />
          <meshStandardMaterial
            color="#0ea5e9"
            emissive="#0369a1"
            emissiveIntensity={0.4}
            metalness={0.9}
            roughness={0.15}
            wireframe
          />
        </mesh>
      </Float>

      {/* Orbiting Satellite Tech Cubes */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i * Math.PI * 2) / 6;
        const radius = 4.2;
        return (
          <Float key={i} speed={1.5 + i * 0.2} floatIntensity={1}>
            <mesh position={[Math.cos(angle) * radius, (i % 2 === 0 ? 0.8 : -0.8), Math.sin(angle) * radius]}>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? '#38bdf8' : '#c084fc'}
                emissive={i % 2 === 0 ? '#0284c7' : '#9333ea'}
                emissiveIntensity={0.5}
                wireframe
              />
            </mesh>
          </Float>
        );
      })}
    </group>
  );
};
