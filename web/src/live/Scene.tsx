import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { mesh } from 'topojson-client';
import countries from 'world-atlas/countries-110m.json';
import type { Joint } from './PoseCamera';
const edges = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const rest: [number,number,number][] = Array.from({length:33},()=>[0,0,0]);
Object.assign(rest,{11:[-.3,.65,0],12:[.3,.65,0],13:[-.45,.2,0],14:[.45,.2,0],15:[-.5,-.15,0],16:[.5,-.15,0],23:[-.2,0,0],24:[.2,0,0],25:[-.2,-.55,0],26:[.2,-.55,0],27:[-.2,-1.05,0],28:[.2,-1.05,0]});
function Avatar({pose}:{pose:Joint[]}) {
  const points = pose.length ? pose.map(p=>[p.x*1.8,-p.y*1.8,-p.z*1.8] as [number,number,number]) : rest;
  return <group position={[0,.15,0]}>{edges.map(([a,b])=><Line key={`${a}-${b}`} points={[points[a],points[b]]} color={pose.length?'#64ead2':'#5f7c94'} lineWidth={5}/>)}{[11,12,13,14,15,16,23,24,25,26,27,28].map(i=><mesh key={i} position={points[i]}><sphereGeometry args={[.045,12,12]}/><meshStandardMaterial color="#b1fff0" emissive="#2a8d82" emissiveIntensity={.4}/></mesh>)}<mesh position={pose.length?[points[0][0],points[0][1],points[0][2]]:[0,.94,0]}><sphereGeometry args={[.17,24,24]}/><meshStandardMaterial color="#4c6f84" metalness={.7} roughness={.25}/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.2,0]}><ringGeometry args={[.8,.81,64]}/><meshBasicMaterial color="#4de2c8" side={THREE.DoubleSide}/></mesh></group>;
}
const xyz = (lon:number,lat:number,r=1.5):[number,number,number] => { const a=lat*Math.PI/180,b=lon*Math.PI/180; return [r*Math.cos(a)*Math.cos(b),r*Math.sin(a),-r*Math.cos(a)*Math.sin(b)]; };
function Earth({events,reduced}:{events:Array<{lat?:number;lon?:number}>;reduced:boolean}) {
  const group = useRef<THREE.Group>(null);
  const lines = useMemo(()=> {
    const topo = countries as unknown as Parameters<typeof mesh>[0];
    return mesh(topo, (topo as typeof topo & {objects:{countries:Parameters<typeof mesh>[1]}}).objects.countries).coordinates.map(r=>r.map(p=>xyz(p[0],p[1],1.508)));
  },[]);
  useFrame((_,dt)=>{ if(group.current && !reduced) group.current.rotation.y += dt*.035; });
  return <group ref={group} rotation={[.15,-1,0]}><mesh><sphereGeometry args={[1.5,64,48]}/><meshStandardMaterial color="#092c40" roughness={.8} metalness={.2}/></mesh><mesh><sphereGeometry args={[1.51,24,16]}/><meshBasicMaterial wireframe color="#1c5667" transparent opacity={.18}/></mesh>{lines.map((p,i)=><Line key={i} points={p} color="#46948e" lineWidth={.7}/>)}{events.filter(e=>e.lat!==undefined&&e.lon!==undefined).slice(0,80).map((e,i)=><mesh key={i} position={xyz(e.lon!,e.lat!,1.53)}><sphereGeometry args={[.018,8,8]}/><meshBasicMaterial color="#f7bb72"/></mesh>)}</group>;
}
class Boundary extends Component<{children:ReactNode},{failed:boolean}> { state={failed:false}; static getDerivedStateFromError(){return {failed:true};} render(){return this.state.failed?<div className="scene-fallback">3D unavailable. All measurements remain available below.</div>:this.props.children;} }
export default function Scene({pose=[],earth=false,events=[]}:{pose?:Joint[];earth?:boolean;events?:Array<{lat?:number;lon?:number}>}) {
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 return <Boundary><div className="scene" aria-label={earth?'Interactive Earth with EONET event markers':'Movement avatar; illustrative until camera tracking starts'}><Canvas dpr={[1,1.5]} camera={{position:[0,0,4.5],fov:45}} gl={{antialias:true,powerPreference:'low-power'}}><ambientLight intensity={1.4}/><directionalLight position={[4,4,4]} intensity={3}/><Suspense fallback={null}>{earth?<Earth events={events} reduced={reduced}/>:<Avatar pose={pose}/>}</Suspense><OrbitControls enablePan={false} enableZoom={false} autoRotate={false}/></Canvas></div></Boundary>;
}
