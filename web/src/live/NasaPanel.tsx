import { lazy, Suspense, useEffect, useState } from 'react';
import { api, formatTime, type Source } from './api';
const Scene = lazy(() => import('./Scene'));
const Map = lazy(() => import('./NasaMap'));
export default function NasaPanel() {
 const [sources,setSources]=useState<Record<string,Source>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[map,setMap]=useState(false);
 async function refresh(){setBusy(true);try{setSources(await api('/context/nasa'));setError('');}catch{setError('NASA relay unavailable. Previously received data may be stale.');}finally{setBusy(false);}}
 useEffect(()=>{void refresh();const id=setInterval(()=>void refresh(),30000);return()=>clearInterval(id);},[]);
 const donki=sources.donki, eonet=sources.eonet, gibs=sources.gibs;
 return <section className="live-panel nasa-panel"><div className="section-top"><div><span className="eyebrow">BEYOND THE CABIN</span><h2>Earth & space weather</h2></div><button className="quiet" disabled={busy} onClick={()=>void refresh()}>↻ Refresh</button></div>
 <Suspense fallback={<div className="scene-fallback">Loading Earth…</div>}><Scene earth events={eonet?.data?.events}/></Suspense>
 <div className="globe-caption">Drag to explore · amber points: NASA EONET events<br/><small>Geographic outline: Natural Earth. Event locations are historical reports.</small></div>
 {error&&<p className="notice" role="status">{error}</p>}
 <div className="space-counts">{['CME','GST','SEP','RBE'].map(k=><div key={k}><b>{donki?.data ? donki.data.history_counts?.[k]??0 : '—'}</b><span>{k}</span></div>)}</div>
 <p className="muted">NASA DONKI · events in the last {donki?.data?.window_days??30} days. Historical counts are not current personal risk or radiation dose.</p>
 <div className="source-list">{['donki','eonet','gibs','noaa_kp','iss'].map(k=>{const s=sources[k];return <details key={k}><summary><span>{k==='iss'?'ISS • third-party prediction':k==='noaa_kp'?'NOAA • estimated Kp':`NASA ${k.toUpperCase()}`}</span><span className="pill">{error?'RELAY OFFLINE':s?.freshness==='live'?'FETCH CURRENT':s?.freshness?.toUpperCase()??'WAITING'}</span></summary><p>Observed: {formatTime(s?.times?.observed_at)}<br/>Last successful fetch: {formatTime(s?.times?.last_success_at)}</p>{s?.error&&<p>{s.error}</p>}{k==='noaa_kp'&&<p>Estimated Kp: {s?.data?.current?.kp??'Unknown'}</p>}{k==='iss'&&<p>Position calculated by wheretheiss.at, not instrument telemetry.</p>}</details>;})}</div>
 <details><summary>Recent solar events</summary>{donki?.data?.events?.slice(0,6).map(e=><p key={e.id}><b>{e.kind}</b> · {formatTime(e.observed_at)} {e.max_kp!=null&&`· peak Kp ${e.max_kp}`} {e.link&&/^https:\/\//.test(e.link)&&<a href={e.link} target="_blank" rel="noreferrer">Source ↗</a>}</p>)??<p>No source data available.</p>}</details>
 <button className="quiet" onClick={()=>setMap(!map)}>{map?'Close imagery':'Open NASA satellite imagery'}</button>
 {map&&<Suspense fallback={<p>Loading imagery…</p>}><Map source={gibs}/></Suspense>}
 <small>DONKI is research context. GIBS imagery is dated, not live video. These feeds do not measure crew health.</small>
 </section>;
}
