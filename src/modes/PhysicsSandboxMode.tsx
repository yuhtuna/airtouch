import React, { useRef } from 'react';
import { Physics, RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioHaptics } from '../lib/audioHaptics';

export interface PhysicsObject {
  id: string;
  shape: 'cube' | 'sphere' | 'cylinder' | 'gear';
  position: [number, number, number];
  color: string;
}

interface PhysicsSandboxModeProps {
  wandTipPosRef: React.RefObject<THREE.Vector3>;
  objects: PhysicsObject[];
  triggerHaptic: (pwm: number, ms: number) => void;
}

export const PhysicsSandboxMode: React.FC<PhysicsSandboxModeProps> = ({
  wandTipPosRef,
  objects,
  triggerHaptic,
}) => {
  const wandKinematicRef = useRef<RapierRigidBody>(null);
  const prevTipPosRef = useRef(new THREE.Vector3());
  const tipVelocityRef = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const tipPos = wandTipPosRef.current || new THREE.Vector3();

    // Calculate instantaneous wand tip velocity vector
    if (delta > 0) {
      tipVelocityRef.current
        .copy(tipPos)
        .sub(prevTipPosRef.current)
        .divideScalar(delta);
    }
    prevTipPosRef.current.copy(tipPos);

    if (wandKinematicRef.current) {
      // Kinematic translation follow wand tip position
      wandKinematicRef.current.setNextKinematicTranslation({
        x: tipPos.x,
        y: tipPos.y,
        z: tipPos.z,
      });
    }
  });

  const handleWandCollision = (event: any) => {
    const impactSpeed = tipVelocityRef.current.length();
    const pwm = Math.min(255, Math.round(180 + impactSpeed * 30));
    triggerHaptic(pwm, 60);
    audioHaptics.playCollisionThud(impactSpeed / 4.0);

    // Apply impulse to dynamic object if struck
    if (event.other && event.other.rigidBodyObject) {
      const otherBody = event.other.rigidBody;
      if (otherBody && typeof otherBody.applyImpulse === 'function') {
        const impulse = tipVelocityRef.current.clone().multiplyScalar(0.4);
        otherBody.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
      }
    }
  };

  return (
    <Physics gravity={[0, -9.81, 0]}>
      {/* Invisible Arena Colliders */}
      <CuboidCollider position={[0, -2.4, 0]} args={[12, 0.2, 12]} />
      <CuboidCollider position={[-6, 2, 0]} args={[0.2, 5, 12]} />
      <CuboidCollider position={[6, 2, 0]} args={[0.2, 5, 12]} />
      <CuboidCollider position={[0, 2, -6]} args={[12, 5, 0.2]} />
      <CuboidCollider position={[0, 2, 6]} args={[12, 5, 0.2]} />

      {/* Kinematic Wand Tip Collider */}
      <RigidBody
        ref={wandKinematicRef}
        type="kinematicPosition"
        colliders="ball"
        onCollisionEnter={handleWandCollision}
      >
        <mesh visible={false}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial wireframe />
        </mesh>
      </RigidBody>

      {/* Dynamic Spawned Physics Primitives */}
      {objects.map((obj) => (
        <RigidBody
          key={obj.id}
          position={obj.position}
          restitution={0.65}
          friction={0.4}
          colliders="hull"
        >
          {obj.shape === 'cube' && (
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.6, 0.6, 0.6]} />
              <meshStandardMaterial color={obj.color} roughness={0.3} metalness={0.2} />
            </mesh>
          )}

          {obj.shape === 'sphere' && (
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.35, 24, 24]} />
              <meshStandardMaterial color={obj.color} roughness={0.2} metalness={0.4} />
            </mesh>
          )}

          {obj.shape === 'cylinder' && (
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.3, 0.7, 20]} />
              <meshStandardMaterial color={obj.color} roughness={0.4} metalness={0.3} />
            </mesh>
          )}

          {obj.shape === 'gear' && (
            <group>
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[0.5, 0.5, 0.22, 24]} />
                <meshStandardMaterial color={obj.color} roughness={0.2} metalness={0.8} />
              </mesh>
              {/* Radial Gear Teeth */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <mesh
                  key={i}
                  position={[0.55 * Math.cos((i * Math.PI) / 3), 0, 0.55 * Math.sin((i * Math.PI) / 3)]}
                  rotation={[0, -(i * Math.PI) / 3, 0]}
                >
                  <boxGeometry args={[0.18, 0.2, 0.14]} />
                  <meshStandardMaterial color={obj.color} roughness={0.2} metalness={0.8} />
                </mesh>
              ))}
            </group>
          )}
        </RigidBody>
      ))}
    </Physics>
  );
};
