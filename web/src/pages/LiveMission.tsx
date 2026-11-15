import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Globe2, Orbit, RefreshCw, Satellite, Sun } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { feature } from "topojson-client";
import land110 from "world-atlas/land-110m.json";
import { DemoBadge, Panel } from "../components/ui";

// LIVE MISSION CONTROL. Real, public, keyless data fetched in the browser:
//  - ISS position, altitude, velocity and ground track: api.wheretheiss.at (open ISS tracker)
//  - Natural events with coordinates: NASA EONET (eonet.gsfc.nasa.gov)
//  - Space-weather scales and Kp index: NOAA SWPC (services.swpc.noaa.gov)
// The South Atlantic Anomaly outline is an APPROXIMATE educational region, not a measured boundary.

const W = 1000, H = 500;
const px = (lon: number) => ((lon + 180) / 360) * W;
const py = (lat: number) => ((90 - lat) / 180) * H;

interface Iss { latitude: number; longitude: number; altitude: number; velocity: number; visibility: string; footprint: number; timestamp: number }
interface TrackPt { lat: number; lon: number; t: number }
interface Eonet { id: string; title: string; cat: string; lat: number; lon: number; date: string; link: string }
interface Scales { R: string; S: string; G: string }
interface KpPt { t: string; kp: number }

// Approximate SAA ellipse (centre, semi-axes in degrees).
const SAA = { lat: -26, lon: -50, rLat: 24, rLon: 40 };
const inSaa = (lat: number, lon: number) => ((lat - SAA.lat) / SAA.rLat) ** 2 + ((lon - SAA.lon) / SAA.rLon) ** 2 <= 1;

const CAT_COLOR: Record<string, string> = { Wildfires: "#ff6b3d", Volcanoes: "#ff2a55", "Severe Storms": "#38bdf8", "Sea and Lake Ice": "#a5f3fc", Floods: "#3b82f6", Earthquakes: "#ffb020", Drought: "#d4a373", Landslides: "#a78bfa", "Dust and Haze": "#c2a878", "Temperature Extremes": "#f472b6", "Water Color": "#34d399", Snow: "#e2e8f0", Manmade: "#94a3b8" };

function landPath(): string {
  const f: any = feature(land110 as any, (land110 as any).objects.land);
  const rings: number[][][] = [];
  const geoms = f.type === "FeatureCollection" ? f.features.map((x: any) => x.geometry) : [f.geometry ?? f];
  for (const g of geoms) {
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const p of polys) for (const ring of p) rings.push(ring);
  }
  return rings.map((r) => r.map(([lo, la], i) => `${i === 0 || Math.abs(lo - r[i - 1][0]) > 180 ? "M" : "L"}${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join("")).join("");
}

// Split a track into segments so the line does not cross the whole map at the antimeridian.
function trackPath(pts: TrackPt[]): string {
  let d = "";
  pts.forEach((p, i) => {
    const wrap = i > 0 && Math.abs(p.lon - pts[i - 1].lon) > 180;
    d += `${i === 0 || wrap ? "M" : "L"}${px(p.lon).toFixed(1)},${py(p.lat).toFixed(1)}`;
  });
  return d;
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
  const [sel, setSel] = useState<Eonet | null>(null);
  const [updated, setUpdated] = useState<number>(0);
  const issAlive = useRef(true);
  const land = useMemo(landPath, []);

  const fail = (k: string) => setErr((e) => (e.includes(k) ? e : [...e, k]));

  // ISS position every 5 s
  useEffect(() => {
    issAlive.current = true;
    const tick = () =>
      j<Iss>("https://api.wheretheiss.at/v1/satellites/25544")
        .then((d) => { if (issAlive.current) { setIss(d); setUpdated(Date.now()); setErr((e) => e.filter((x) => x !== "ISS")); } })
        .catch(() => fail("ISS"));
    tick();
    const id = setInterval(tick, 5000);
    return () => { issAlive.current = false; clearInterval(id); };
  }, []);

  // ground track: 10 past + 10 future points at 5-minute spacing (two requests of 10)
  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    const ts = Array.from({ length: 20 }, (_, i) => now + (i - 8) * 360);
    Promise.all([ts.slice(0, 10), ts.slice(10)].map((c) => j<any[]>(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${c.join(",")}`)))
      .then(([a, b]) => setTrack([...a, ...b].map((p) => ({ lat: p.latitude, lon: p.longitude, t: p.timestamp }))))
      .catch(() => fail("track"));
  }, []);

  // NASA EONET
  useEffect(() => {
    j<any>("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=120")
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

  // NOAA SWPC scales + Kp, refresh every 2 min
  useEffect(() => {
    const go = () => {
      j<any>("https://services.swpc.noaa.gov/products/noaa-scales.json")
        .then((d) => setScales({ R: d["0"].R.Scale, S: d["0"].S.Scale, G: d["0"].G.Scale }))
        .catch(() => fail("SWPC scales"));
      j<any[]>("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json")
        .then((d) => setKp(d.filter((_, i) => i % 6 === 0).slice(-60).map((x) => ({ t: x.time_tag, kp: x.estimated_kp }))))
        .catch(() => fail("SWPC Kp"));
    };
    go();
    const id = setInterval(go, 120000);
    return () => clearInterval(id);
  }, []);

  const inside = iss ? inSaa(iss.latitude, iss.longitude) : false;
  const nextSaa = useMemo(() => {
    if (!iss || !track.length) return null;
    const nowS = Math.floor(Date.now() / 1000);
    const fut = track.filter((p) => p.t > nowS);
    const hit = fut.find((p) => inSaa(p.lat, p.lon));
    return hit ? Math.max(1, Math.round((hit.t - nowS) / 60)) : null;
  }, [iss, track]);
  const past = track.filter((p) => p.t <= Math.floor(Date.now() / 1000));
  const fut = track.filter((p) => p.t > Math.floor(Date.now() / 1000));
  const lastKp = kp.length ? kp[kp.length - 1].kp : null;

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
          Real data fetched live in your browser: ISS position and orbit, open natural events on Earth from NASA EONET, and space-weather conditions from NOAA SWPC. It shows the radiation and orbital context that drives crew health. Your health entries stay simulated.{" "}
          <Link to="/scan" className="text-aegis-cyan underline">Try the live body scan</Link>
        </p>
      </header>

      <Panel title="Live orbit map" icon={<Globe2 size={16} aria-hidden="true" />} action={<DemoBadge text="LIVE DATA" />}>
        <div className="overflow-hidden rounded-lg border border-cyan-400/20 bg-[#050a18]">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="World map with the live ISS position, ground track, South Atlantic Anomaly region and open NASA EONET events">
            {[-60, -30, 0, 30, 60].map((la) => <line key={la} x1="0" x2={W} y1={py(la)} y2={py(la)} stroke="rgba(0,240,255,.08)" />)}
            {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lo) => <line key={lo} y1="0" y2={H} x1={px(lo)} x2={px(lo)} stroke="rgba(0,240,255,.08)" />)}
            <path d={land} fill="rgba(56,189,248,.16)" stroke="rgba(56,189,248,.5)" strokeWidth=".6" />
            <ellipse cx={px(SAA.lon)} cy={py(SAA.lat)} rx={(SAA.rLon / 360) * W} ry={(SAA.rLat / 180) * H} fill="rgba(255,42,85,.18)" stroke="#ff2a55" strokeDasharray="5 4" />
            <text x={px(SAA.lon)} y={py(SAA.lat) + 4} textAnchor="middle" fontSize="11" fill="#ff8aa3" className="hud-mono">SAA (approx.)</text>
            {events.map((e) => (
              <circle key={e.id} cx={px(e.lon)} cy={py(e.lat)} r={sel?.id === e.id ? 6 : 3.2} fill={CAT_COLOR[e.cat] ?? "#94a3b8"} fillOpacity=".9" stroke="#000" strokeWidth=".4" style={{ cursor: "pointer" }} onClick={() => setSel(e)}>
                <title>{e.title}</title>
              </circle>
            ))}
            {past.length > 1 && <path d={trackPath(past)} fill="none" stroke="#a78bfa" strokeWidth="1.6" strokeOpacity=".7" />}
            {fut.length > 1 && <path d={trackPath([...(past.slice(-1)), ...fut])} fill="none" stroke="#00f0ff" strokeWidth="1.6" strokeDasharray="6 5" />}
            {iss && (
              <g transform={`translate(${px(iss.longitude)} ${py(iss.latitude)})`}>
                <circle r="22" fill="none" stroke="#00f0ff" strokeOpacity=".5"><animate attributeName="r" values="8;28;8" dur="2.4s" repeatCount="indefinite" /><animate attributeName="stroke-opacity" values=".8;0;.8" dur="2.4s" repeatCount="indefinite" /></circle>
                <circle r="5.5" fill="#fff" stroke="#00f0ff" strokeWidth="2" />
                <text y="-12" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" className="hud-mono">ISS</text>
              </g>
            )}
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span><span className="text-[#a78bfa]">&#9473;</span> past 50 min</span>
          <span><span className="text-aegis-cyan">&#9548;</span> next 60 min</span>
          <span><span className="text-[#ff2a55]">&#9711;</span> South Atlantic Anomaly (approximate)</span>
          <span>dots: open NASA EONET events ({events.length})</span>
        </div>
        {sel && (
          <p className="mt-2 rounded-md border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
            <strong style={{ color: CAT_COLOR[sel.cat] ?? "#fff" }}>{sel.cat}</strong>: {sel.title} ({sel.lat.toFixed(2)}, {sel.lon.toFixed(2)}), {sel.date.slice(0, 10)}.{" "}
            <a className="text-aegis-cyan underline" href={sel.link} target="_blank" rel="noreferrer">NASA EONET record</a>
          </p>
        )}
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
          <p className="mt-2 text-xs text-slate-300">
            S-scale tracks solar radiation storms that matter most for astronaut dose; G-scale and Kp show geomagnetic disturbance. Scales run 0 (none) to 5 (extreme).
          </p>
          <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1"><RefreshCw size={10} aria-hidden="true" /> Source: NOAA Space Weather Prediction Center, refreshed every 2 minutes. Awareness only.</p>
        </Panel>
      </div>
    </div>
  );
}
