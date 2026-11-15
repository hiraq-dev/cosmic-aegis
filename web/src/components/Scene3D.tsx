import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

// NASA GIBS Blue Marble (static base imagery, not a live observation)
const TEX = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=BlueMarble_ShadedRelief_Bathymetry&STYLES=&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=1024&HEIGHT=512&FORMAT=image/jpeg";
const progress = () => { const m = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1); return Math.min(1, window.scrollY / m); };

function Stars() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 1400, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 12 + Math.random() * 30, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); a.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3)); return g;
  }, []);
  useFrame(() => { if (ref.current) { ref.current.rotation.y = progress() * 1.2; ref.current.rotation.x = progress() * 0.4; } });
  return <points ref={ref} geometry={geo}><pointsMaterial color="#9fd8ff" size={0.06} sizeAttenuation transparent opacity={0.85} /></points>;
}

function Earth() {
  const map = useTexture(TEX), ref = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (!ref.current) return; const p = progress();
    ref.current.rotation.y += d * 0.08;                        // slow spin
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, 2.6 - p * 5.2, 0.05);   // sweeps across as you scroll
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, 0.6 - p * 1.2, 0.05);
    const s = 1 + Math.sin(p * Math.PI) * 0.5; ref.current.scale.setScalar(THREE.MathUtils.lerp(ref.current.scale.x, s, 0.05));
  });
  return (
    <group ref={ref} position={[2.6, 0.6, -3]}>
      <mesh><sphereGeometry args={[1.5, 64, 64]} /><meshStandardMaterial map={map} /></mesh>
      <mesh scale={1.04}><sphereGeometry args={[1.5, 48, 48]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={THREE.BackSide} /></mesh>
    </group>
  );
}

function Rig() {
  const { camera, pointer } = useThree();
  useFrame(() => {   // pointer parallax + scroll dolly
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.8, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pointer.y * 0.5, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 5 - progress() * 1.5, 0.05);
    camera.lookAt(0, 0, -3);
  });
  return null;
}

/** Fixed full-page 3D backdrop: stars, a NASA Blue Marble Earth, pointer parallax and scroll-driven camera. */
export default function Scene3D() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 5], fov: 55 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.9} /><directionalLight position={[4, 2, 3]} intensity={1.6} />
        <Stars /><Suspense fallback={null}><Earth /></Suspense><Rig />
      </Canvas>
    </div>
  );
}
