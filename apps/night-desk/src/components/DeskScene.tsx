import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { agents } from "@/data/agents";

export type Marker = { id: string; x: number; y: number };

function AgentFigure({
  color,
  position,
  rotation,
  active,
}: {
  color: string;
  position: [number, number, number];
  rotation: number;
  active: boolean;
}) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const material = ring.current?.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;
    material.emissiveIntensity = active ? 2.4 + Math.sin(clock.elapsedTime * 6) * 1.3 : 0.85;
  });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.56, 0.08, 0.5]} />
        <meshStandardMaterial color="#141a2c" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.78, -0.22]}>
        <boxGeometry args={[0.56, 0.7, 0.08]} />
        <meshStandardMaterial color="#12182a" metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0.12, 0.48, 0.22]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.42]} />
        <meshStandardMaterial color="#0e1424" />
      </mesh>
      <mesh position={[-0.12, 0.48, 0.22]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.42]} />
        <meshStandardMaterial color="#0e1424" />
      </mesh>
      <mesh position={[0, 0.64, 0.02]}>
        <boxGeometry args={[0.34, 0.16, 0.28]} />
        <meshStandardMaterial color="#101624" />
      </mesh>
      <mesh position={[0, 1.0, 0.02]}>
        <capsuleGeometry args={[0.18, 0.32, 6, 16]} />
        <meshStandardMaterial color="#182033" metalness={0.5} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.02, 0.18]}>
        <boxGeometry args={[0.18, 0.045, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 3 : 1.1} />
      </mesh>
      <mesh position={[0, 1.46, 0.02]}>
        <sphereGeometry args={[0.16, 28, 28]} />
        <meshStandardMaterial color="#1b2438" metalness={0.62} roughness={0.22} />
      </mesh>
      <mesh ref={ring} position={[0, 1.46, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.19, 0.018, 12, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function Desk() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.z += delta * 0.35;
  });
  return (
    <group>
      <mesh position={[0, 0.74, 0]}>
        <boxGeometry args={[3.5, 0.1, 1.7]} />
        <meshStandardMaterial color="#12182a" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[3.15, 0.02, 1.35]} />
        <meshStandardMaterial color="#071018" emissive="#062833" emissiveIntensity={0.6} metalness={0.2} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.8, 0.86]}>
        <boxGeometry args={[3.5, 0.025, 0.03]} />
        <meshStandardMaterial color="#3EF0FF" emissive="#3EF0FF" emissiveIntensity={2.4} />
      </mesh>
      <mesh position={[0, 0.8, -0.86]}>
        <boxGeometry args={[3.5, 0.025, 0.03]} />
        <meshStandardMaterial color="#FF2BD6" emissive="#FF2BD6" emissiveIntensity={1.8} />
      </mesh>
      <mesh ref={ring} position={[0, 0.83, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.012, 8, 48]} />
        <meshStandardMaterial color="#3EF0FF" emissive="#3EF0FF" emissiveIntensity={2.2} />
      </mesh>
      {[
        [-1.7, 0.36, -0.8],
        [1.7, 0.36, -0.8],
        [-1.7, 0.36, 0.8],
        [1.7, 0.36, 0.8],
      ].map((position) => (
        <mesh key={position.join(",")} position={position as [number, number, number]}>
          <cylinderGeometry args={[0.05, 0.07, 0.72, 10]} />
          <meshStandardMaterial color="#0c121e" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Room() {
  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(24, 24, 0x3ef0ff, 0x143044);
    const materials = Array.isArray(helper.material) ? helper.material : [helper.material];
    for (const material of materials) {
      material.transparent = true;
      material.opacity = 0.38;
    }
    return helper;
  }, []);
  return (
    <>
      <color attach="background" args={["#0B0F19"]} />
      <fog attach="fog" args={["#0B0F19", 9, 22]} />
      <primitive object={grid} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[9, 64]} />
        <meshStandardMaterial color="#0B0F19" />
      </mesh>
      <ambientLight intensity={0.28} />
      <pointLight position={[-3.2, 3.4, 2.4]} color="#3EF0FF" intensity={28} distance={16} />
      <pointLight position={[3.4, 2.4, -1.5]} color="#FF2BD6" intensity={16} distance={14} />
      <pointLight position={[0, 0.5, 0]} color="#FF2BD6" intensity={6} distance={5} />
      <directionalLight position={[2, 6, 3]} intensity={0.45} />
    </>
  );
}

function CameraRig() {
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drift = reduced ? 0 : Math.sin(t * 0.18) * 0.35;
    camera.position.set(0.15 + drift, 4.85, 6.05);
    camera.lookAt(0, 0.75, 0);
  });
  return null;
}

function Markers({ onMarkers }: { onMarkers: (markers: Marker[]) => void }) {
  const elapsed = useRef(0);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const callback = useRef(onMarkers);
  callback.current = onMarkers;
  useFrame(({ camera, size }, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.1) return;
    elapsed.current = 0;
    const next = agents.map((agent) => {
      scratch.set(agent.seat[0], 1.9, agent.seat[2]);
      scratch.project(camera);
      return {
        id: agent.id,
        x: (scratch.x * 0.5 + 0.5) * size.width,
        y: (-scratch.y * 0.5 + 0.5) * size.height,
      };
    });
    callback.current(next);
  });
  return null;
}

export function DeskScene({ activeId, onMarkers }: { activeId: string; onMarkers: (markers: Marker[]) => void }) {
  return (
    <Canvas camera={{ position: [0.2, 4.85, 6.05], fov: 38 }} gl={{ antialias: true }}>
      <Room />
      <Desk />
      {agents.map((agent) => (
        <AgentFigure
          key={agent.id}
          color={agent.color}
          position={agent.seat}
          rotation={agent.facing}
          active={agent.id === activeId}
        />
      ))}
      <CameraRig />
      <Markers onMarkers={onMarkers} />
    </Canvas>
  );
}
