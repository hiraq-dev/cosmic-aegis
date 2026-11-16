import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BONES, REFERENCE } from "../lib/pose";
import { speakLines, speechSupported, stopSpeech } from "../lib/speech";

const TEX = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=BlueMarble_ShadedRelief_Bathymetry&STYLES=&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=1024&HEIGHT=512&FORMAT=image/jpeg";
export const INTRO_SECONDS = 30;
const SCENES = [
  { at: 0, tag: "THE PROBLEM", text: "On long space missions, help can be many minutes away." },
  { at: 6, tag: "WHY IT MATTERS", text: "Space changes the heart, the muscles, the bones and the mind. Crews need early, calm awareness." },
  { at: 12, tag: "OUR IDEA", text: "C.O.S.M.I.C. AEGIS: one console that watches crew health with real sensors, a body scan and live NASA space-weather data." },
  { at: 18, tag: "WHAT YOU CAN DO", text: "Pair a heart-rate sensor, scan your body with your camera, and talk to ASTRA about what you see." },
  { at: 25, tag: "GOOD TO KNOW", text: "Prototype for the NASA Space Apps Challenge. Not a medical device and not endorsed by NASA. Team AEGIS." },
];
const HOT = [
  { id: "heart", label: "HEART", pos: [0, 0.4, 0.15] as const, text: "Pair a Bluetooth heart-rate sensor and watch live beats-per-minute with honest freshness." },
  { id: "body", label: "BODY SCAN", pos: [0.45, -0.1, 0.1] as const, text: "Your camera tracks 33 body landmarks. Frames stay in your browser." },
  { id: "mind", label: "MIND", pos: [0, 0.95, 0.1] as const, text: "Daily check-ins feed trends and ASTRA's wellness-level guidance." },
];

function Stars() {
  const g = useMemo(() => { const n = 1600, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = 14 + Math.random() * 30, t = Math.random() * 6.283, p = Math.acos(2 * Math.random() - 1); a.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p)], i * 3); } const b = new THREE.BufferGeometry(); b.setAttribute("position", new THREE.BufferAttribute(a, 3)); return b; }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.01; });
  return <points ref={ref} geometry={g}><pointsMaterial color="#bfe6ff" size={0.07} sizeAttenuation /></points>;
}

function Earth() {
  const map = useTexture(TEX), ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.12; });
  return <group position={[-2.2, -1.2, -6]}><mesh ref={ref}><sphereGeometry args={[3, 64, 64]} /><meshStandardMaterial map={map} /></mesh><mesh scale={1.03}><sphereGeometry args={[3, 48, 48]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={THREE.BackSide} /></mesh></group>;
}

function Station({ t }: { t: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) { const a = t.current * 0.5; ref.current.position.set(-2.2 + Math.cos(a) * 4.2, -1.2 + Math.sin(a * 0.7) * 1.2, -6 + Math.sin(a) * 4.2); ref.current.rotation.y = -a; } });
  return <group ref={ref}><mesh><boxGeometry args={[0.35, 0.12, 0.12]} /><meshStandardMaterial color="#e2e8f0" /></mesh><mesh position={[0, 0, 0]}><boxGeometry args={[0.1, 0.02, 0.9]} /><meshStandardMaterial color="#38bdf8" emissive="#0369a1" /></mesh></group>;
}

function Figure({ t, onHot }: { t: React.MutableRefObject<number>; onHot: (id: string) => void }) {
  const g = useRef<THREE.Group>(null), ring = useRef<THREE.Mesh>(null), heart = useRef<THREE.Mesh>(null);
  const drag = useRef({ down: false, x: 0, ry: 0 });
  useFrame(() => {
    if (!g.current) return;
    const s = t.current, vis = THREE.MathUtils.smoothstep(s, 5, 8); // figure drifts in at scene 2
    g.current.visible = vis > 0.01; g.current.scale.setScalar(0.4 + vis * 0.8);
    g.current.position.set(1.5 - vis * 1.5, 0.2 + Math.sin(s * 0.9) * 0.08, 0);
    if (!drag.current.down) drag.current.ry += 0.004; g.current.rotation.y = drag.current.ry;
    if (ring.current) { ring.current.visible = s > 17; ring.current.position.y = 0.2 + Math.sin(s * 2) * 0.95; }
    if (heart.current) heart.current.scale.setScalar(1 + Math.max(0, Math.sin(s * 7.5)) * 0.5); // decorative beat, NOT a measurement
  });
  return (
    <group ref={g}
      onPointerDown={e => { drag.current.down = true; drag.current.x = e.clientX; (e.target as any).setPointerCapture?.(e.pointerId); }}
      onPointerMove={e => { if (drag.current.down) { drag.current.ry += (e.clientX - drag.current.x) * 0.01; drag.current.x = e.clientX; } }}
      onPointerUp={() => { drag.current.down = false; }}>
      {BONES.map(([a, b], i) => { const p = REFERENCE[a], q = REFERENCE[b]; if (!p || !q) return null; const v1 = new THREE.Vector3(...p), v2 = new THREE.Vector3(...q), len = v1.distanceTo(v2); const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize()); return <mesh key={i} position={v1.clone().add(v2).multiplyScalar(0.5)} quaternion={quat}><capsuleGeometry args={[0.05, Math.max(len - 0.08, 0.01), 4, 10]} /><meshStandardMaterial color="#7dd3fc" emissive="#0c4a6e" /></mesh>; })}
      <mesh position={[0, 0.85, 0]}><sphereGeometry args={[0.14, 20, 20]} /><meshStandardMaterial color="#e0f2fe" emissive="#0c4a6e" /></mesh>
      <mesh ref={heart} position={[0.1, 0.42, 0.12]}><sphereGeometry args={[0.05, 16, 16]} /><meshBasicMaterial color="#ff6b8b" /></mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[0.55, 0.62, 64]} /><meshBasicMaterial color="#00f0ff" transparent opacity={0.85} side={THREE.DoubleSide} /></mesh>
      {HOT.map(h => <Html key={h.id} position={[...h.pos]} center zIndexRange={[10, 0]}><button onClick={() => onHot(h.id)} className="whitespace-nowrap rounded-full border border-cyan-300/70 bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold tracking-wider text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,.5)] hover:bg-cyan-400/20">{h.label}</button></Html>)}
    </group>
  );
}

function Rig({ t }: { t: React.MutableRefObject<number> }) {
  const { camera, pointer } = useThree();
  useFrame(() => {
    const s = t.current;
    const tz = s < 6 ? 8 - s * 0.2 : s < 12 ? 5.5 : s < 18 ? 4.6 : 3.6, ty = s < 12 ? 0 : 0.2;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.9, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, ty + pointer.y * 0.5, 0.04);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, tz, 0.03);
    camera.lookAt(0, 0.1, 0);
  });
  return null;
}

function Clock({ t, start }: { t: React.MutableRefObject<number>; start: number }) {
  useFrame(() => { t.current = (performance.now() - start) / 1000; });
  return null;
}

/** Full-screen 30-second interactive 3D intro. Drag the figure, click the labels, skip any time. */
export default function Intro3D({ onDone }: { onDone: () => void }) {
  const t = useRef(0), start = useMemo(() => performance.now(), []);
  const [sec, setSec] = useState(0), [hot, setHot] = useState<string | null>(null), [voice, setVoice] = useState(false);
  useEffect(() => {
    const i = setInterval(() => { const s = (performance.now() - start) / 1000; setSec(s); if (s >= INTRO_SECONDS) { stopSpeech(); onDone(); } }, 100);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { stopSpeech(); onDone(); } };
    window.addEventListener("keydown", key);
    return () => { clearInterval(i); window.removeEventListener("keydown", key); stopSpeech(); };
  }, [onDone, start]);
  const idx = SCENES.reduce((a, s, i) => (sec >= s.at ? i : a), 0), scene = SCENES[idx], h = HOT.find(x => x.id === hot);
  useEffect(() => { if (voice) { stopSpeech(); speakLines([scene.text]); } }, [idx, voice]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 z-[100] bg-[#02040c]" role="dialog" aria-label="AEGIS introduction">
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.8} /><directionalLight position={[5, 3, 4]} intensity={1.8} />
        <Clock t={t} start={start} /><Stars /><Suspense fallback={null}><Earth /></Suspense><Station t={t} /><Figure t={t} onHot={setHot} /><Rig t={t} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <span className="font-display text-lg font-extrabold tracking-wider text-white">C.O.S.M.I.C. <span className="text-cyan-300">AEGIS</span></span>
        <div className="pointer-events-auto flex gap-2">
          {speechSupported && <button className="rounded border border-white/20 px-3 py-1 text-xs text-slate-200 hover:bg-white/10" onClick={() => { if (voice) stopSpeech(); setVoice(!voice); }}>{voice ? "Voice on" : "Voice off"}</button>}
          <button className="rounded bg-cyan-400 px-4 py-1 text-xs font-bold text-slate-950" onClick={() => { stopSpeech(); onDone(); }}>Skip intro ›</button>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6 text-center">
        {h && <p className="pointer-events-auto mx-auto mb-3 max-w-md rounded-lg border border-cyan-300/40 bg-slate-950/80 p-3 text-sm text-cyan-100">{h.text}</p>}
        <p className="hud-mono text-xs font-bold tracking-[0.3em] text-cyan-300">{scene.tag}</p>
        <p className="mx-auto mt-1 max-w-2xl text-lg font-semibold text-white sm:text-xl">{scene.text}</p>
        <div className="mx-auto mt-4 h-1 max-w-md overflow-hidden rounded bg-white/10"><div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, (sec / INTRO_SECONDS) * 100)}%` }} /></div>
        <p className="mt-2 text-[11px] text-slate-400">Drag the figure to rotate it · click the glowing labels · press Esc to skip. Entering the site automatically in {Math.max(0, Math.ceil(INTRO_SECONDS - sec))} s.</p>
      </div>
    </div>
  );
}
