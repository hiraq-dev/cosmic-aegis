import { Canvas } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { Suspense } from "react";
import * as THREE from "three";

export type Pin = { lat: number; lon: number; color: string; label: string };
const xyz = (lat: number, lon: number, r = 1.01) => { const p = (90 - lat) * Math.PI / 180, t = (lon + 180) * Math.PI / 180; return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)); };
// NASA GIBS BlueMarble equirectangular snapshot (static base layer, not a live observation)
const TEX = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=BlueMarble_ShadedRelief_Bathymetry&STYLES=&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=1024&HEIGHT=512&FORMAT=image/jpeg";
function Earth({ pins }: { pins: Pin[] }) {
  const map = useTexture(TEX);
  return <group><mesh><sphereGeometry args={[1, 64, 64]} /><meshStandardMaterial map={map} /></mesh>
    {pins.map((p, i) => <mesh key={i} position={xyz(p.lat, p.lon)}><sphereGeometry args={[0.018, 8, 8]} /><meshBasicMaterial color={p.color} /></mesh>)}</group>;
}
export default function Globe3D({ pins }: { pins: Pin[] }) {
  return <Canvas camera={{ position: [0, 0, 2.8], fov: 45 }} aria-label="Earth globe with NASA EONET events and ISS position">
    <ambientLight intensity={1.1} /><Suspense fallback={null}><Earth pins={pins} /></Suspense><OrbitControls enablePan={false} minDistance={1.4} maxDistance={5} />
  </Canvas>;
}
