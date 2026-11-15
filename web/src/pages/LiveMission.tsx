import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Download, Globe2, Orbit, RefreshCw, Satellite, Save, Sun, Trash2 } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DemoBadge, Panel } from "../components/ui";
import { deleteSnapshot, download, listSnapshots, saveSnapshot, type Snapshot } from "../lib/history";

// LIVE MISSION CONTROL. Real, public, keyless data fetched in the browser:
//  - Satellite imagery: NASA GIBS (Global Imagery Browse Services), MODIS true colour from yesterday, VIIRS night lights
//  - Natural events with coordinates: NASA EONET (eonet.gsfc.nasa.gov)
//  - ISS position, altitude, velocity and ground track: api.wheretheiss.at (open ISS tracker)
//  - Space-weather scales and Kp index: NOAA SWPC (services.swpc.noaa.gov)
// The South Atlantic Anomaly outline is an APPROXIMATE educational region, not a measured boundary.

interface Iss { latitude: number; longitude: number; altitude: number; velocity: number; visibility: string; footprint: number; timestamp: number }
interface TrackPt { lat: number; lon: number; t: number }
interface Eonet { id: string; title: string; cat: string; lat: number; lon: number; date: string; link: string }
interface Scales { R: string; S: string; G: string }
interface KpPt { t: string; kp: number }

const SAA = { lat: -26, lon: -50, rLat: 24, rLon: 40 };
const inSaa = (lat: number, lon: number) => ((lat - SAA.lat) / SAA.rLat) ** 2 + ((lon - SAA.lon) / SAA.rLon) ** 2 <= 1;
const saaPolygon = (): L.LatLngTuple[] =>
  Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    return [SAA.lat + SAA.rLat * Math.sin(a), SAA.lon + SAA.rLon * Math.cos(a)] as L.LatLngTuple;
  });

const CAT_COLOR: Record<string, string> = { Wildfires: "#ff6b3d", Volcanoes: "#ff2a55", "Severe Storms": "#38bdf8", "Sea and Lake Ice": "#a5f3fc", Floods: "#3b82f6", Earthquakes: "#ffb020", Drought: "#d4a373", Landslides: "#a78bfa", "Dust and Haze": "#c2a878", "Temperature Extremes": "#f472b6", "Water Color": "#34d399", Snow: "#e2e8f0", Manmade: "#94a3b8" };

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const BASEMAPS = {
  truecolor: { label: "True colour (MODIS)", url: () => `${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/${yesterday()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`, max: 9 },
  night: { label: "Night lights (VIIRS)", url: () => `${GIBS}/VIIRS_Black_Marble/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`, max: 8 },
  marble: { label: "Blue Marble relief", url: () => `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`, max: 8 },
} as const;
type BaseKey = keyof typeof BASEMAPS;

// Split a track where it crosses the antimeridian so no line is drawn across the whole map.
function segments(pts: TrackPt[]): L.LatLngTuple[][] {
  const out: L.LatLngTuple[][] = [];
  let cur: L.LatLngTuple[] = [];
  pts.forEach((p, i) => {
    if (i > 0 && Math.abs(p.lon - pts[i - 1].lon) > 180) { out.push(cur); cur = []; }
    cur.push([p.lat, p.lon]);
  });
  if (cur.length) out.push(cur);
  return out;
}

async function j<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export default function LiveMission() {
  const [iss, setIss] = useState<Iss | null>(null);
  const [track, setTrack] = useState<TrackPt[]>([]);
  const [events, setEvents] = useState<Eonet[]>([]);
  const [scales, setScales] = useState<Scales | null>(null);
  const [kp, setKp] = useState<KpPt[]>([]);
  const [err, setErr] = useState<string[]>([]);
  const [updated, setUpdated] = useState(0);
  const [base, setBase] = useState<BaseKey>("truecolor");
  const [follow, setFollow] = useState(false);
  const [snaps, setSnaps] = useState<Snapshot[]>(() => listSnapshots());
  const [savedMsg, setSavedMsg] = useState("");

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const baseLayer = useRef<L.TileLayer | null>(null);
  const issMarker = useRef<L.Marker | null>(null);
  const footprint = useRef<L.Circle | null>(null);
  const trackLayer = useRef<L.LayerGroup | null>(null);
  const eventLayer = useRef<L.LayerGroup | null>(null);
  const followRef = useRef(false);
  followRef.current = follow;

  const fail = (k: string) => setErr((e) => (e.includes(k) ? e : [...e, k]));

  // ---- map setup (once) ---------------------------------------------------------------------------------------
  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = L.map(mapEl.current, { center: [15, 10], zoom: 2, minZoom: 2, maxZoom: 9, worldCopyJump: true, zoomSnap: 0.5 });
    m.attributionControl.setPrefix(false);
    map.current = m;
    L.polygon(saaPolygon(), { color: "#ff2a55", weight: 1.5, dashArray: "6 5", fillColor: "#ff2a55", fillOpacity: 0.18 }).addTo(m).bindTooltip("South Atlantic Anomaly (approximate): higher charged-particle flux", { sticky: true });
    trackLayer.current = L.layerGroup().addTo(m);
    eventLayer.current = L.layerGroup().addTo(m);
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; issMarker.current = null; footprint.current = null; };
  }, []);

  // base layer (NASA GIBS)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    baseLayer.current?.remove();
    const b = BASEMAPS[base];
    baseLayer.current = L.tileLayer(b.url(), { maxNativeZoom: b.max, maxZoom: 9, minZoom: 2, attribution: "Imagery: NASA GIBS / EOSDIS" }).addTo(m);
    baseLayer.current.bringToBack();
  }, [base]);

  // ---- data ---------------------------------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    const tick = () =>
      j<Iss>("https://api.wheretheiss.at/v1/satellites/25544")
        .then((d) => { if (alive) { setIss(d); setUpdated(Date.now()); setErr((e) => e.filter((x) => x !== "ISS")); } })
        .catch(() => fail("ISS"));
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    const ts = Array.from({ length: 20 }, (_, i) => now + (i - 8) * 360);
    Promise.all([ts.slice(0, 10), ts.slice(10)].map((c) => j<any[]>(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${c.join(",")}`)))
      .then(([a, b]) => setTrack([...a, ...b].map((p) => ({ lat: p.latitude, lon: p.longitude, t: p.timestamp }))))
      .catch(() => fail("track"));
  }, []);

  useEffect(() => {
    j<any>("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=150")
      .then((d) =>
        setEvents(
          d.events
            .map((e: any): Eonet | null => {
              const g = e.geometry[e.geometry.length - 1];
              if (!g || g.type !== "Point") return null;
              return { id: e.id, title: e.title, cat: e.categories[0]?.title ?? "Event", lon: g.coordinates[0], lat: g.coordinates[1], date: g.date, link: e.link };
            })
            .filter(Boolean),
        ),
      )
      .catch(() => fail("EONET"));
  }, []);

  useEffect(() => {
    const go = () => {
      j<any>("https://services.swpc.noaa.gov/products/noaa-scales.json").then((d) => setScales({ R: d["0"].R.Scale, S: d["0"].S.Scale, G: d["0"].G.Scale })).catch(() => fail("SWPC scales"));
      j<any[]>("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json").then((d) => setKp(d.filter((_, i) => i % 6 === 0).slice(-60).map((x) => ({ t: x.time_tag, kp: x.estimated_kp })))).catch(() => fail("SWPC Kp"));
    };
    go();
    const id = setInterval(go, 120000);
    return () => clearInterval(id);
  }, []);

  // ---- draw dynamic layers ------------------------------------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !iss) return;
    const ll: L.LatLngTuple = [iss.latitude, iss.longitude];
    if (!issMarker.current) {
      issMarker.current = L.marker(ll, {
        icon: L.divIcon({ className: "", html: '<div class="iss-pulse"><span>ISS</span></div>', iconSize: [34, 34], iconAnchor: [17, 17] }),
        zIndexOffset: 1000,
      }).addTo(m);
      footprint.current = L.circle(ll, { radius: (iss.footprint / 2) * 1000, color: "#00f0ff", weight: 1, fillColor: "#00f0ff", fillOpacity: 0.07 }).addTo(m);
    } else {
      issMarker.current.setLatLng(ll);
      footprint.current?.setLatLng(ll).setRadius((iss.footprint / 2) * 1000);
    }
    if (followRef.current) m.panTo(ll, { animate: true });
  }, [iss]);

  useEffect(() => {
    const g = trackLayer.current;
    if (!g) return;
    g.clearLayers();
    const nowS = Math.floor(Date.now() / 1000);
    const past = track.filter((p) => p.t <= nowS), fut = track.filter((p) => p.t > nowS);
    segments(past).forEach((s) => L.polyline(s, { color: "#a78bfa", weight: 3, opacity: 0.85 }).addTo(g));
    segments([...past.slice(-1), ...fut]).forEach((s) => L.polyline(s, { color: "#00f0ff", weight: 3, dashArray: "8 7", opacity: 0.95 }).addTo(g));
  }, [track]);

  useEffect(() => {
    const g = eventLayer.current;
    if (!g) return;
    g.clearLayers();
    events.forEach((e) => {
      const c = CAT_COLOR[e.cat] ?? "#94a3b8";
      L.circleMarker([e.lat, e.lon], { radius: 6, color: "#000", weight: 1, fillColor: c, fillOpacity: 0.9 })
        .bindPopup(`<strong style="color:${c}">${e.cat}</strong><br/>${e.title}<br/><small>${e.lat.toFixed(2)}, ${e.lon.toFixed(2)} &middot; ${e.date.slice(0, 10)}</small><br/><a href="${e.link}" target="_blank" rel="noreferrer">NASA EONET record</a>`)
        .addTo(g);
    });
  }, [events]);

  // ---- derived ------------------------------------------------------------------------------------------------
  const inside = iss ? inSaa(iss.latitude, iss.longitude) : false;
  const nextSaa = useMemo(() => {
    if (!iss || !track.length) return null;
    const nowS = Math.floor(Date.now() / 1000);
    const hit = track.filter((p) => p.t > nowS).find((p) => inSaa(p.lat, p.lon));
    return hit ? Math.max(1, Math.round((hit.t - nowS) / 60)) : null;
  }, [iss, track]);
  const lastKp = kp.length ? kp[kp.length - 1].kp : null;
  const byCat = useMemo(() => events.reduce<Record<string, number>>((a, e) => ((a[e.cat] = (a[e.cat] ?? 0) + 1), a), {}), [events]);

  const snapshot = () => {
    const s: Snapshot = {
      id: "SNAP-" + Math.random().toString(16).slice(2, 7).toUpperCase(),
      when: new Date().toISOString(),
      iss: iss ? { lat: iss.latitude, lon: iss.longitude, altKm: Math.round(iss.altitude), speedKmh: Math.round(iss.velocity) } : undefined,
      scales: scales ?? undefined, kp: lastKp, eonetCount: events.length, eonetByCategory: byCat,
    };
    setSnaps(saveSnapshot(s));
    setSavedMsg("Snapshot saved in this browser.");
    setTimeout(() => setSavedMsg(""), 2500);
  };

  const scaleCell = (label: string, hint: string, v: string | undefined) => {
    const n = Number(v ?? 0);
    const c = n === 0 ? "#00ff9d" : n <= 2 ? "#ffb020" : "#ff2a55";
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
        <div className="font-display text-2xl font-bold" style={{ color: c, textShadow: `0 0 10px ${c}66` }}>{v === undefined ? "-" : `${label}${v}`}</div>
        <div className="hud-mono mt-0.5 text-[10px] tracking-wider text-slate-400">{hint}</div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <header className="glass p-5">
        <div className="hud-mono text-[10px] tracking-widest text-hud-emerald">LIVE MISSION CONTROL</div>
        <h1 className="font-display mt-1 text-2xl font-extrabold text-white sm:text-3xl">The environment your crew is flying through, right now</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Real data fetched live in your browser: NASA satellite imagery (GIBS), open natural events from NASA EONET, the ISS position and orbit, and space-weather conditions from NOAA. Zoom, pan and click the map. Your health entries stay simulated.{" "}
          <Link to="/" className="text-aegis-cyan underline">Back to the body scan</Link>
        </p>
      </header>

      <Panel title="Live orbit map (NASA imagery, zoom and pan)" icon={<Globe2 size={16} aria-hidden="true" />} action={<DemoBadge text="LIVE NASA DATA" />}>
        <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="Map layer">
          {(Object.keys(BASEMAPS) as BaseKey[]).map((k) => (
            <button key={k} onClick={() => setBase(k)} aria-pressed={base === k} className={`rounded-md border px-2.5 py-1 text-xs ${base === k ? "border-aegis-cyan bg-aegis-cyan/15 text-white" : "border-white/15 text-slate-300 hover:bg-white/5"}`}>{BASEMAPS[k].label}</button>
          ))}
          <button onClick={() => setFollow((f) => !f)} aria-pressed={follow} className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${follow ? "border-emerald-400 bg-emerald-400/15 text-white" : "border-white/15 text-slate-300 hover:bg-white/5"}`}><Crosshair size={12} aria-hidden="true" /> Follow ISS</button>
          <button onClick={() => { setFollow(false); map.current?.setView([15, 10], 2); }} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5">Reset view</button>
          {iss && <button onClick={() => { setFollow(false); map.current?.setView([iss.latitude, iss.longitude], 5); }} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5">Zoom to ISS</button>}
        </div>
        <div ref={mapEl} className="h-[460px] w-full overflow-hidden rounded-lg border border-cyan-400/25 bg-[#050a18]" role="application" aria-label="Interactive world map with the live ISS position, orbit, South Atlantic Anomaly and open NASA EONET events" />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span><span className="text-[#a78bfa]">&#9473;</span> past 50 min</span>
          <span><span className="text-aegis-cyan">&#9548;</span> next 60 min</span>
          <span><span className="text-[#ff2a55]">&#9711;</span> South Atlantic Anomaly (approximate)</span>
          <span>dots: {events.length} open NASA EONET events (click for details)</span>
          <span>scroll or pinch to zoom, drag to pan</span>
        </div>
        {err.length > 0 && <p className="mt-2 text-xs text-amber-200" role="status">Could not reach: {err.join(", ")}. Other feeds still work. <button className="underline" onClick={() => location.reload()}>Retry</button></p>}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="ISS telemetry" icon={<Satellite size={16} aria-hidden="true" />} action={<DemoBadge text="LIVE" />}>
          {iss ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {[
                  ["LATITUDE", iss.latitude.toFixed(3) + "°"],
                  ["LONGITUDE", iss.longitude.toFixed(3) + "°"],
                  ["ALTITUDE", Math.round(iss.altitude) + " km"],
                  ["VELOCITY", Math.round(iss.velocity).toLocaleString() + " km/h"],
                  ["SUNLIGHT", iss.visibility],
                  ["FOOTPRINT", Math.round(iss.footprint).toLocaleString() + " km"],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                    <div className="hud-mono text-[10px] tracking-wider text-slate-400">{l}</div>
                    <div className="hud-mono text-base font-bold tabular-nums text-white">{v}</div>
                  </div>
                ))}
              </div>
              <div className={`mt-3 rounded-lg border p-3 text-sm ${inside ? "border-red-400/60 bg-red-500/10 text-red-100" : "border-emerald-400/30 bg-emerald-500/5 text-slate-200"}`}>
                <Orbit size={14} className="mr-1 inline" aria-hidden="true" />
                {inside
                  ? "The ISS is inside the South Atlantic Anomaly region now. Charged-particle flux is higher here, so crews limit sensitive activities."
                  : nextSaa !== null
                    ? `Outside the South Atlantic Anomaly. Next approximate entry in about ${nextSaa} min.`
                    : "Outside the South Atlantic Anomaly. No entry in the next hour."}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Updated {new Date(updated).toLocaleTimeString()} (every 5 s). Source: api.wheretheiss.at. The SAA region is an educational approximation.</p>
            </>
          ) : (
            <p className="text-sm text-slate-300" role="status">{err.includes("ISS") ? "ISS feed unreachable right now." : "Locating the ISS..."}</p>
          )}
        </Panel>

        <Panel title="Space weather now (radiation environment)" icon={<Sun size={16} aria-hidden="true" />} action={<DemoBadge text="LIVE NOAA SWPC" />}>
          <div className="grid grid-cols-3 gap-3">
            {scaleCell("R", "RADIO BLACKOUT", scales?.R)}
            {scaleCell("S", "RADIATION STORM", scales?.S)}
            {scaleCell("G", "GEOMAGNETIC", scales?.G)}
          </div>
          <div className="mt-3 flex items-baseline justify-between text-xs text-slate-300">
            <span>Planetary Kp index (last 10 h)</span>
            <strong className="hud-mono text-aegis-cyan">{lastKp === null ? "-" : lastKp.toFixed(1)}</strong>
          </div>
          <div className="h-24 w-full">
            <ResponsiveContainer>
              <LineChart data={kp} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <YAxis hide domain={[0, 9]} />
                <Tooltip contentStyle={{ background: "#0a1226", border: "1px solid rgba(0,240,255,.3)", fontSize: 11 }} labelFormatter={(l) => String(l).slice(11, 16) + " UTC"} />
                <Line dataKey="kp" stroke="#00f0ff" dot={false} strokeWidth={2} name="Kp" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-300">S-scale tracks solar radiation storms that matter most for astronaut dose; G-scale and Kp show geomagnetic disturbance. Scales run 0 (none) to 5 (extreme).</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><RefreshCw size={10} aria-hidden="true" /> Source: NOAA Space Weather Prediction Center, refreshed every 2 minutes. Awareness only.</p>
        </Panel>
      </div>

      <Panel title="Saved environment snapshots" icon={<Save size={16} aria-hidden="true" />} action={<DemoBadge text="STORED IN YOUR BROWSER" />}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={snapshot} className="inline-flex items-center gap-2 rounded-lg border border-aegis-cyan bg-aegis-cyan/15 px-4 py-2 text-sm font-semibold text-white"><Save size={15} aria-hidden="true" /> Save snapshot now</button>
          {snaps.length > 0 && <button onClick={() => download("aegis-snapshots.json", JSON.stringify(snaps, null, 2))} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"><Download size={15} aria-hidden="true" /> Export JSON</button>}
          {savedMsg && <span className="text-sm text-hud-emerald" role="status">{savedMsg}</span>}
        </div>
        {snaps.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Save a record of the ISS position, space-weather scales and open NASA events at this moment, to compare later.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-xs">
            {snaps.slice(0, 8).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                <span className="hud-mono text-slate-400">{new Date(s.when).toLocaleString()}</span>
                <span>ISS {s.iss ? `${s.iss.lat.toFixed(1)}, ${s.iss.lon.toFixed(1)}` : "n/a"} &middot; S{s.scales?.S ?? "-"} G{s.scales?.G ?? "-"} R{s.scales?.R ?? "-"} &middot; Kp {typeof s.kp === "number" ? s.kp.toFixed(1) : "-"} &middot; {s.eonetCount ?? 0} events</span>
                <button onClick={() => setSnaps(deleteSnapshot(s.id))} aria-label={`Delete snapshot ${s.id}`} className="text-slate-400 hover:text-red-300"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
