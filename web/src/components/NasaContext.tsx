import { lazy, Suspense, useEffect, useState } from "react";
import { localApi } from "../lib/local";

const Globe3D = lazy(() => import("./Globe3D"));
const webgl = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } })();
const ago = (s?: number | null) => (s == null ? "" : s < 90 ? `${Math.round(s)} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${(s / 3600).toFixed(1)} h ago`);
const SOURCES = ["noaa_kp", "noaa_scales", "donki", "eonet", "gibs", "iss"];

/** Real NASA / NOAA data fetched by the browser. Each source shows LIVE, CACHED (with age) or UNAVAILABLE. */
export default function NasaContext() {
  const [nasa, setNasa] = useState<any>({});
  useEffect(() => {
    const load = () => localApi("/context/nasa").then(setNasa).catch(() => setNasa({}));
    load(); const t = setInterval(load, 5000); return () => clearInterval(t);
  }, []);
  const eon = nasa.eonet?.data?.events ?? [], iss = nasa.iss?.data;
  const pins = [...eon.slice(0, 80).map((e: any) => ({ lat: e.lat, lon: e.lon, color: "#f59e0b", label: e.title })), ...(iss && nasa.iss.live ? [{ lat: iss.lat, lon: iss.lon, color: "#22d3ee", label: "ISS (predicted)" }] : [])];
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <h2 className="mb-2 text-lg font-semibold text-white">NASA and space-weather context</h2>
      <div className="h-64">{webgl ? <Suspense fallback={null}><Globe3D pins={pins} /></Suspense> : <p className="text-sm text-slate-400">Globe unavailable without WebGL.</p>}</div>
      <ul className="mt-3 space-y-1 text-xs text-slate-300">
        {SOURCES.map(s => {
          const d = nasa[s];
          return (
            <li key={s}><b>{s}</b>: <span className={d?.live ? "text-cyan-300" : "text-amber-300"}>{d ? (d.live ? "LIVE" : d.freshness === "cached" ? "CACHED" : "UNAVAILABLE") : "loading"}</span>
              {d?.age_s != null && <> · retrieved {ago(d.age_s)}</>}{d?.times?.observed_at && <> · observed {d.times.observed_at}</>}{d?.error && <> · {d.error}</>}{d?.data?.provider && <> · {d.data.provider}</>}</li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Kp now: {nasa.noaa_kp?.data?.current?.kp ?? "unknown"}. Space-weather context does not by itself indicate any personal health effect. Historical DONKI counts (last 30 days): {JSON.stringify(nasa.donki?.data?.history_counts ?? {})}.</p>
    </section>
  );
}
