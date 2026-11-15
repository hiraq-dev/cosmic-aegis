import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Source } from './api';
export default function NasaMap({source}:{source?:Source}) {
 const el=useRef<HTMLDivElement>(null);const template=source?.data?.tile_template;
 useEffect(()=>{if(!el.current||!template)return; const map=L.map(el.current).setView([15,0],2);L.tileLayer(template,{maxZoom:9,attribution:'NASA GIBS / EOSDIS',noWrap:true}).addTo(map); return()=>{map.remove();};},[template]);
 return <div>{template?<><div ref={el} style={{height:280,borderRadius:12}}/><small>Requested imagery date: {source?.data?.requested_date}. Acquisition time: {source?.data?.acquisition_time??'not supplied by provider'}.</small></>:<p>NASA imagery is unavailable. No substitute imagery is presented as current.</p>}</div>;
}
