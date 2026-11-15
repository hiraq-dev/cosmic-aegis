import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";

export type Pose = { lsh?: [number, number]; rsh?: [number, number]; lel?: [number, number]; rel?: [number, number]; lwr?: [number, number]; rwr?: [number, number] } | null;
const seg = (a: [number, number], b: [number, number]) => { const dx = b[0] - a[0], dy = b[1] - a[1]; return { pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0] as [number, number, number], len: Math.hypot(dx, dy), rot: Math.atan2(dy, dx) - Math.PI / 2 }; };
function Limb({ a, b, hot, onPick, name }: { a: [number, number]; b: [number, number]; hot: boolean; onPick: (n: string) => void; name: string }) {
  const s = seg(a, b);
  return <mesh position={s.pos} rotation={[0, 0, s.rot]} onClick={() => onPick(name)}><capsuleGeometry args={[0.05, Math.max(s.len - 0.1, 0.01), 4, 8]} /><meshStandardMaterial color={hot ? "#22d3ee" : "#64748b"} /></mesh>;
}
function Rig({ pose, region, onPick }: { pose: Pose; region: string; onPick: (n: string) => void }) {
  const g = useRef<Group>(null);
  useFrame((_, d) => { if (g.current && !pose) g.current.rotation.y += d * 0.0; });
  // neutral reference posture; limbs follow camera landmarks only when a pose is supplied (measured, not animated)
  const P = pose ?? { lsh: [-0.3, 0.5], rsh: [0.3, 0.5], lel: [-0.4, 0.1], rel: [0.4, 0.1], lwr: [-0.4, -0.3], rwr: [0.4, -0.3] };
  return (
    <group ref={g}>
      <mesh position={[0, 0.85, 0]} onClick={() => onPick("head")}><sphereGeometry args={[0.16, 24, 24]} /><meshStandardMaterial color={region === "head" ? "#22d3ee" : "#64748b"} /></mesh>
      <mesh position={[0, 0.2, 0]} onClick={() => onPick("torso")}><boxGeometry args={[0.6, 0.7, 0.2]} /><meshStandardMaterial color={region === "torso" ? "#22d3ee" : "#475569"} /></mesh>
      <Limb a={P.lsh as any} b={P.lel as any} hot={region === "left arm"} onPick={onPick} name="left arm" />
      <Limb a={P.lel as any} b={P.lwr as any} hot={region === "left arm"} onPick={onPick} name="left arm" />
      <Limb a={P.rsh as any} b={P.rel as any} hot={region === "right arm"} onPick={onPick} name="right arm" />
      <Limb a={P.rel as any} b={P.rwr as any} hot={region === "right arm"} onPick={onPick} name="right arm" />
    </group>
  );
}
export default function Body3D({ pose, region, onPick }: { pose: Pose; region: string; onPick: (n: string) => void }) {
  return <Canvas camera={{ position: [0, 0.3, 2.6], fov: 45 }} aria-label="3D crew visualization">
    <ambientLight intensity={0.8} /><directionalLight position={[2, 3, 3]} intensity={1.2} />
    <Rig pose={pose} region={region} onPick={onPick} /><OrbitControls enablePan={false} minDistance={1.5} maxDistance={4} />
  </Canvas>;
}
