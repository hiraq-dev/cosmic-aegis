import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

export interface Pin { id: string; lat: number; lon: number; color: string; label: string; category: string; detail?: string }
export interface GlobeProps {
  pins: Pin[]; selected: string | null; onSelect: (id: string | null) => void;
  iss: { lat: number; lon: number } | null; trail: { lat: number; lon: number }[];
  kp: number | null; sun: { lat: number; lon: number };
  onHover: (c: { lat: number; lon: number } | null) => void;
}
// NASA GIBS Blue Marble base imagery (static, not a live observation)
const TEX = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=BlueMarble_ShadedRelief_Bathymetry&STYLES=&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg";
const RAD = Math.PI / 180;
export const xyz = (lat: number, lon: number, r = 1) => { const p = (90 - lat) * RAD, t = (lon + 180) * RAD; return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)); };
export const toLatLon = (v: THREE.Vector3) => { const n = v.clone().normalize(); let lon = Math.atan2(n.z, -n.x) / RAD - 180; if (lon < -180) lon += 360; return { lat: 90 - Math.acos(Math.max(-1, Math.min(1, n.y))) / RAD, lon }; };

/** Sub-solar point from the clock: where the Sun is overhead right now (accurate to roughly a degree; used only for day/night lighting). */
export function subSolar(d = new Date()) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0), n = (d.getTime() - start) / 864e5;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (n + 10));
  const hrs = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return { lat: decl, lon: (12 - hrs) * 15 };
}

function Poly({ points, color, opacity }: { points: THREE.Vector3[]; color: string; opacity: number }) {
  const obj = useMemo(() => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity })); return l; }, [points, color, opacity]);
  return <primitive object={obj} />;
}

function Graticule() {
  const lines = useMemo(() => {
    const out: THREE.Vector3[][] = [];
    for (let lat = -60; lat <= 60; lat += 30) out.push(Array.from({ length: 129 }, (_, i) => xyz(lat, -180 + (i * 360) / 128, 1.003)));
    for (let lon = -180; lon < 180; lon += 30) out.push(Array.from({ length: 65 }, (_, i) => xyz(-90 + (i * 180) / 64, lon, 1.003)));
    return out;
  }, []);
  return <group>{lines.map((l, i) => <Poly key={i} points={l} color="#7dd3fc" opacity={0.28} />)}</group>;
}

// Geomagnetic north / south poles (approximate, 2025 IGRF dipole)
const GM = [{ lat: 80.9, lon: -72.8 }, { lat: -80.9, lon: 107.2 }];
/** Auroral-zone boundary drawn at a geomagnetic colatitude that widens with Kp. Illustrative geometry from a simple
 *  rule of thumb (about 67 degrees at Kp 0, moving about 2.3 degrees equatorward per Kp step), not NOAA's OVATION model. */
function Aurora({ kp }: { kp: number | null }) {
  const k = kp ?? 0, boundary = Math.max(45, 67 - 2.3 * k), col = (90 - boundary) * RAD;
  const rings = useMemo(() => GM.map((g) => {
    const c = xyz(g.lat, g.lon), ref = Math.abs(c.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), u = new THREE.Vector3().crossVectors(c, ref).normalize(), w = new THREE.Vector3().crossVectors(c, u);
    return Array.from({ length: 97 }, (_, i) => { const a = (i / 96) * 2 * Math.PI; return c.clone().multiplyScalar(Math.cos(col)).add(u.clone().multiplyScalar(Math.sin(col) * Math.cos(a))).add(w.clone().multiplyScalar(Math.sin(col) * Math.sin(a))).multiplyScalar(1.012); });
  }), [col]);
  const colr = k >= 7 ? "#ef4444" : k >= 5 ? "#f59e0b" : k >= 4 ? "#a3e635" : "#34d399";
  return <group>{rings.map((r, i) => <Poly key={i} points={r} color={colr} opacity={0.95} />)}</group>;
}

function Earth({ p }: { p: GlobeProps }) {
  const map = useTexture(TEX);
  const trail = useMemo(() => p.trail.map((t) => xyz(t.lat, t.lon, 1.04)), [p.trail]);
  return (
    <group>
      <mesh onPointerMove={(e) => { e.stopPropagation(); p.onHover(toLatLon(e.point)); }} onPointerOut={() => p.onHover(null)} onClick={() => p.onSelect(null)}>
        <sphereGeometry args={[1, 96, 96]} /><meshStandardMaterial map={map} roughness={0.9} />
      </mesh>
      <mesh scale={1.035}><sphereGeometry args={[1, 48, 48]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.1} side={THREE.BackSide} /></mesh>
      <Graticule /><Aurora kp={p.kp} />
      {trail.length > 1 && <Poly points={trail} color="#22d3ee" opacity={0.9} />}
      {p.pins.map((pin) => {
        const pos = xyz(pin.lat, pin.lon, 1.015), sel = p.selected === pin.id;
        return (
          <group key={pin.id} position={pos}>
            <mesh onClick={(e) => { e.stopPropagation(); p.onSelect(sel ? null : pin.id); }} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
              <sphereGeometry args={[sel ? 0.03 : 0.018, 12, 12]} /><meshBasicMaterial color={sel ? "#ffffff" : pin.color} />
            </mesh>
            {sel && <Html center distanceFactor={4} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}><span className="whitespace-nowrap rounded bg-slate-950/90 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-cyan-300/60">{pin.label}</span></Html>}
          </group>
        );
      })}
      {p.iss && (
        <group position={xyz(p.iss.lat, p.iss.lon, 1.05)}>
          <mesh><boxGeometry args={[0.05, 0.015, 0.015]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh><boxGeometry args={[0.012, 0.004, 0.09]} /><meshBasicMaterial color="#22d3ee" /></mesh>
          <Html center distanceFactor={4} position={[0, 0.06, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}><span className="whitespace-nowrap rounded bg-cyan-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">ISS (predicted)</span></Html>
        </group>
      )}
    </group>
  );
}

export default function Globe3D(p: GlobeProps) {
  const sunPos = useMemo(() => xyz(p.sun.lat, p.sun.lon, 10), [p.sun.lat, p.sun.lon]);
  return (
    <Canvas camera={{ position: [0, 0.4, 2.9], fov: 42 }} dpr={[1, 2]} aria-label="Interactive 3D Earth showing NASA EONET events, the ISS track, the aurora zone from the Kp index and current day and night">
      <color attach="background" args={["#02040c"]} />
      <ambientLight intensity={0.6} /><directionalLight position={sunPos} intensity={2.6} color="#fff6e0" />
      <mesh position={sunPos.clone().multiplyScalar(0.55)}><sphereGeometry args={[0.35, 24, 24]} /><meshBasicMaterial color="#fde68a" /></mesh>
      <Suspense fallback={null}><Earth p={p} /></Suspense>
      <OrbitControls enablePan={false} minDistance={1.5} maxDistance={5} autoRotate autoRotateSpeed={0.35} enableDamping />
    </Canvas>
  );
}
