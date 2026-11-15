import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { BONES, REFERENCE, type Skeleton } from "../lib/pose";

export type Pose = Skeleton;
const GROUP: Record<string, string> = { head: "head", torso: "torso", larm: "left arm", rarm: "right arm", lleg: "left leg", rleg: "right leg" };

function Body({ pose, region, onPick }: { pose: Skeleton; region: string; onPick: (n: string) => void }) {
  const sk = pose ?? REFERENCE;
  return (
    <group>
      {BONES.map(([a, b, g], i) => {
        const p = sk[a], q = sk[b]; if (!p || !q) return null;
        const v1 = new THREE.Vector3(...p), v2 = new THREE.Vector3(...q), len = v1.distanceTo(v2), mid = v1.clone().add(v2).multiplyScalar(0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize());
        const hot = region === GROUP[g];
        return <mesh key={i} position={mid} quaternion={quat} onClick={e => { e.stopPropagation(); onPick(GROUP[g]); }}><capsuleGeometry args={[g === "torso" ? 0.07 : 0.045, Math.max(len - 0.08, 0.01), 4, 10]} /><meshStandardMaterial color={hot ? "#22d3ee" : pose ? "#34d399" : "#64748b"} emissive={hot ? "#0891b2" : "#000"} /></mesh>;
      })}
      {sk.map((p, i) => p && [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(i) ? <mesh key={"j" + i} position={p}><sphereGeometry args={[i === 0 ? 0.13 : 0.05, 16, 16]} /><meshStandardMaterial color={i === 0 ? (region === "head" ? "#22d3ee" : "#94a3b8") : "#e2e8f0"} /></mesh> : null)}
    </group>
  );
}

function Beam({ on }: { on: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ref.current) { ref.current.visible = on; ref.current.position.y = 0.2 + Math.sin(clock.elapsedTime * 1.6) * 0.95; } });
  return <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[0.55, 0.62, 64]} /><meshBasicMaterial color="#00f0ff" transparent opacity={0.8} side={THREE.DoubleSide} /></mesh>;
}

export default function Body3D({ pose, region, onPick, scanning }: { pose: Skeleton; region: string; onPick: (n: string) => void; scanning?: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0.2, 3], fov: 45 }} aria-label="Interactive 3D crew visualization. Drag to rotate, scroll to zoom, click a body part to select it.">
      <ambientLight intensity={0.8} /><directionalLight position={[2, 3, 3]} intensity={1.3} />
      <gridHelper args={[3, 12, "#0e7490", "#164e63"]} position={[0, -0.95, 0]} />
      <Body pose={pose} region={region} onPick={onPick} />
      <Beam on={!!scanning || !!pose} />
      {pose && <Html position={[0.9, 0.9, 0]} center><span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">LIVE CAMERA SKELETON</span></Html>}
      <OrbitControls enablePan={false} minDistance={1.5} maxDistance={5} makeDefault />
    </Canvas>
  );
}
