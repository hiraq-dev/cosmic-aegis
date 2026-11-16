import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { localApi } from "../lib/local";
import { subSolar, type Pin } from "./Globe3D";

const Globe3D = lazy(() => import("./Globe3D"));
const webgl = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } })();
const ago = (s?: number | null) => (s == null ? "" : s < 90 ? `${Math.round(s)} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${(s / 3600).toFixed(1)} h ago`);
const SOURCES = ["noaa_kp", "noaa_scales", "noaa_wind", "donki", "eonet", "gibs", "iss"];
const CAT_COLOR: Record<string, string> = { Wildfires: "#fb923c", Volcanoes: "#ef4444", "Severe Storms": "#c084fc", "Sea and Lake Ice": "#67e8f9", Floods: "#3b82f6", Drought: "#d4a373", Landslides: "#a16207", Earthquakes: "#f43f5e", "Dust and Haze": "#fcd34d", "Temperature Extremes": "#f472b6", "Snow": "#e0f2fe", "Water Color": "#2dd4bf", Manmade: "#94a3b8" };
const color = (c?: string) => CAT_COLOR[c ?? ""] ?? "#f59e0b";

let trail: { lat: number; lon: number }[] = [];   // ISS positions seen in this session (a ground track of observations, not a forecast)

const kpMeaning = (k: number | null) => k == null ? "unknown" : k < 4 ? "quiet" : k < 5 ? "active (no storm)" : k < 6 ? "minor storm (G1)" : k < 7 ? "moderate storm (G2)" : k < 8 ? "strong storm (G3)" : k < 9 ? "severe storm (G4)" : "extreme storm (G5)";
const windMeaning = (v: number | null) => v == null ? "unknown" : v < 400 ? "slow to normal" : v < 500 ? "moderate" : v < 700 ? "fast" : "very fast";
const bzMeaning = (b: number | null) => b == null ? "unknown" : b <= -5 ? "strongly southward: favours geomagnetic storms" : b < 0 ? "southward" : "northward: little coupling to Earth's field";
const SCALE = { G: ["none", "minor", "moderate", "strong", "severe", "extreme"], S: ["none", "minor", "moderate", "strong", "severe", "extreme"], R: ["none", "minor", "moderate", "strong", "severe", "extreme"] } as const;

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p><p className={`text-2xl font-bold ${tone ?? "text-white"}`}>{value}</p><p className="text-[11px] leading-snug text-slate-300">{sub}</p></div>;
}
const fmtLat = (v: number) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? "N" : "S"}`;
const fmtLon = (v: number) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? "E" : "W"}`;

/** Real NASA / NOAA data fetched by the browser. Each source shows LIVE, CACHED (with age) or UNAVAILABLE. */
export default function NasaContext() {
  const [nasa, setNasa] = useState<any>({}), [sel, setSel] = useState<string | null>(null), [hover, setHover] = useState<{ lat: number; lon: number } | null>(null), [sun, setSun] = useState(subSolar());
  useEffect(() => {
    const load = () => localApi("/context/nasa").then(setNasa).catch(() => setNasa({}));
    load(); const t = setInterval(load, 5000), s = setInterval(() => setSun(subSolar()), 30000); return () => { clearInterval(t); clearInterval(s); };
  }, []);
  const events: any[] = nasa.eonet?.data?.events ?? [], iss = nasa.iss?.data, issLive = !!nasa.iss?.live;
  if (iss && issLive && (!trail.length || trail[trail.length - 1].lat !== iss.lat)) trail = [...trail.slice(-90), { lat: iss.lat, lon: iss.lon }];
  const pins: Pin[] = useMemo(() => events.slice(0, 120).map((e) => ({ id: e.id, lat: e.lat, lon: e.lon, color: color(e.category), label: e.title, category: e.category ?? "Event", detail: e.observed_at })), [events]);
  const cats = useMemo(() => { const m: Record<string, number> = {}; for (const e of events) m[e.category ?? "Other"] = (m[e.category ?? "Other"] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [events]);
  const chosen = events.find((e) => e.id === sel);
  const kp: number | null = nasa.noaa_kp?.data?.current?.kp ?? null, w = nasa.noaa_wind?.data?.current, sc = nasa.noaa_scales?.data?.current;
  const kpLive = !!nasa.noaa_kp?.live;
  const aurLat = kp == null ? null : Math.max(45, 67 - 2.3 * kp);
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <h2 className="mb-1 text-lg font-semibold text-white">NASA and space-weather context</h2>
      <p className="mb-3 text-xs text-slate-400">Live conditions around Earth. Drag to rotate, scroll to zoom, click an event dot. Grid lines every 30° of latitude and longitude.</p>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative overflow-hidden rounded-xl border border-white/10">
          <div className="h-[420px] w-full">
            {webgl ? <Suspense fallback={<p className="p-4 text-sm text-slate-400">Loading globe…</p>}>
              <Globe3D pins={pins} selected={sel} onSelect={setSel} iss={issLive && iss ? { lat: iss.lat, lon: iss.lon } : null} trail={trail} kp={kpLive ? kp : null} sun={sun} onHover={setHover} /></Suspense>
              : <p className="p-4 text-sm text-slate-400">The globe needs WebGL, which this device does not provide. The data panels on the right still work.</p>}
          </div>
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-slate-950/80 px-2 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
            <span className="hud-mono">{hover ? `Pointer: ${fmtLat(hover.lat)}, ${fmtLon(hover.lon)}` : "Hover the globe for coordinates"}</span>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 space-y-0.5 rounded bg-slate-950/80 px-2 py-1.5 text-[10px] text-slate-200 ring-1 ring-white/10">
            <p><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#fde68a]" />Sun overhead at {fmtLat(sun.lat)}, {fmtLon(sun.lon)} (day side is lit)</p>
            <p><span className="mr-1 inline-block h-0.5 w-3 bg-emerald-400 align-middle" />Aurora zone from Kp: {aurLat == null ? "unavailable" : `reaches about ${aurLat.toFixed(0)}° geomagnetic latitude (illustrative)`}</p>
            <p><span className="mr-1 inline-block h-0.5 w-3 bg-cyan-400 align-middle" />ISS track seen this session ({trail.length} fixes){issLive && iss ? ` · now ${fmtLat(iss.lat)}, ${fmtLon(iss.lon)}` : ""}</p>
          </div>
          {chosen && (
            <div className="absolute right-2 top-2 max-w-[15rem] rounded-lg bg-slate-950/90 p-2 text-[11px] text-slate-200 ring-1 ring-cyan-300/50">
              <p className="font-semibold text-white">{chosen.title}</p><p className="text-slate-300">{chosen.category}</p>
              <p className="hud-mono">{fmtLat(chosen.lat)}, {fmtLon(chosen.lon)}</p>
              {chosen.observed_at && <p>Last position: {new Date(chosen.observed_at).toUTCString()}</p>}
              {chosen.sources?.[0] && <a className="text-cyan-300 underline" href={chosen.sources[0]} target="_blank" rel="noreferrer">Source link</a>}
              <button className="ml-2 underline" onClick={() => setSel(null)}>close</button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Geomagnetic activity (Kp)" value={kp == null ? "?" : kp.toFixed(1)} sub={`${kpMeaning(kp)}${kpLive ? "" : " · not live"}`} tone={kp != null && kp >= 5 ? "text-amber-300" : "text-white"} />
            <Stat label="Solar wind speed" value={w?.speed_kms != null ? `${w.speed_kms}` : "?"} sub={`km/s · ${windMeaning(w?.speed_kms ?? null)}`} />
            <Stat label="Magnetic field Bz" value={w?.bz_nT != null ? `${w.bz_nT}` : "?"} sub={`nT · ${bzMeaning(w?.bz_nT ?? null)}`} tone={w?.bz_nT != null && w.bz_nT <= -5 ? "text-amber-300" : "text-white"} />
            <Stat label="NOAA scales G / S / R" value={sc ? `G${sc.geomagnetic_G ?? "?"} S${sc.solar_radiation_storm_S ?? "?"} R${sc.radio_blackout_R ?? "?"}` : "?"} sub={sc ? `geomagnetic ${SCALE.G[sc.geomagnetic_G ?? 0] ?? "?"}, radiation ${SCALE.S[sc.solar_radiation_storm_S ?? 0] ?? "?"}, radio ${SCALE.R[sc.radio_blackout_R ?? 0] ?? "?"}` : "unavailable"} />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
            <p className="font-semibold text-white">Solar activity, last 30 days (NASA DONKI)</p>
            {nasa.donki?.data?.history_counts ? <p className="mt-1">{Object.entries(nasa.donki.data.history_counts).map(([k, v]) => `${v} ${({ CME: "coronal mass ejections", GST: "geomagnetic storms", SEP: "solar energetic particle events", RBE: "radiation belt enhancements" } as Record<string, string>)[k] ?? k}`).join(" · ")}</p> : <p className="mt-1 text-amber-300">DONKI is unavailable right now.</p>}
            <p className="mt-1 text-slate-400">These are historical counts, separate from the current readings above.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
            <p className="font-semibold text-white">Earth events (NASA EONET): {events.length} open</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{cats.map(([c, n]) => <span key={c}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: color(c) }} />{c} {n}</span>)}</div>
          </div>
        </div>
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-1 text-xs text-slate-300 sm:grid-cols-2">
        {SOURCES.map((s) => {
          const d = nasa[s];
          return <li key={s}><b>{s}</b>: <span className={d?.live ? "text-cyan-300" : "text-amber-300"}>{d ? (d.live ? "LIVE" : d.freshness === "cached" ? "CACHED" : "UNAVAILABLE") : "loading"}</span>{d?.age_s != null && <> · retrieved {ago(d.age_s)}</>}{d?.times?.observed_at && <> · observed {d.times.observed_at}</>}{d?.error && <> · {d.error}</>}{d?.data?.provider && <> · {d.data.provider}</>}</li>;
        })}
      </ul>
    </section>
  );
}
