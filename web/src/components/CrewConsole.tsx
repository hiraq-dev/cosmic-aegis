import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { HeartPulse, Stethoscope } from "lucide-react";
import { localApi } from "../lib/local";
import { bleSupported, connectHeartRate, type HrConnection } from "../lib/ble";
import { Panel } from "./ui";
import AstraChat from "./AstraChat";

const Body3D = lazy(() => import("./Body3D"));
const CameraPanel = lazy(() => import("./CameraPanel"));
const webgl = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } })();
const STATE: Record<string, string> = { receiving: "Connected · receiving", connected_waiting: "Connected · waiting for data", stale: "Delayed / stale", disconnected: "Disconnected", unavailable: "No sensor connected", historical_replay: "Historical replay" };

function Spark({ pts }: { pts: { t: number; v: number }[] }) {
  if (pts.length < 2) return null;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, lo = Math.min(...pts.map(p => p.v)) - 2, hi = Math.max(...pts.map(p => p.v)) + 2;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${((p.t - t0) / Math.max(t1 - t0, 1)) * 300},${60 - ((p.v - lo) / (hi - lo)) * 56}`).join(" ");
  return <svg viewBox="0 0 300 60" className="w-full" role="img" aria-label="Heart rate over the last hour"><path d={d} fill="none" stroke="#ff6b8b" strokeWidth="1.5" /></svg>;
}

export default function CrewConsole() {
  const [hr, setHr] = useState<{ t: number; v: number }[]>([]), [card, setCard] = useState<any>({}), [ble, setBle] = useState<HrConnection | null>(null), [bleErr, setBleErr] = useState("");
  const [pose, setPose] = useState<any>(null), [sweep, setSweep] = useState(false), [region, setRegion] = useState("");
    const dev = useRef("");

  const refresh = useCallback(async () => {
    const [rows, cards] = await Promise.all([localApi("/measurements?metric=heart_rate&since_hours=1"), localApi("/cards")]);
    setHr(rows.map((r: any) => ({ t: Date.parse(r.observed_at), v: r.value }))); setCard(cards.cardiovascular?.heart_rate || {});
  }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 2000); return () => clearInterval(t); }, [refresh]);

  const pair = async () => {
    setBleErr("");
    try {
      let seq = 0;
      const c = await connectHeartRate(
        (s, at) => { localApi("/measurements", { method: "POST", json: { events: [{ event_id: `${dev.current}-${at.getTime()}-${seq}`, device_id: dev.current, metric: "heart_rate", value: s.bpm, unit: "bpm", observed_at: at.toISOString(), source: "BLE Heart Rate Service", source_type: "device", sequence: seq++, quality_flags: s.contact === false ? ["no_skin_contact"] : [] }] } }); },
        st => { if (dev.current) localApi(`/devices/${dev.current}/state`, { method: "POST", json: { state: st } }); if (st === "disconnected") setBle(null); },
      );
      dev.current = c.deviceId;
      await localApi("/devices", { method: "POST", json: { id: c.deviceId, kind: "ble_heart_rate" } });
      await localApi(`/devices/${c.deviceId}/state`, { method: "POST", json: { state: "connected" } });
      setBle(c);
    } catch (e: any) { setBleErr(e.message || "Pairing cancelled"); }
  };
  useEffect(() => () => { ble?.disconnect(); }, [ble]);


  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr_1fr]" id="crew">
      <Panel title="Heart-rate sensor" icon={<HeartPulse size={16} aria-hidden="true" />}>
        <p className="text-3xl font-bold text-white">{card.value != null ? `${card.value} bpm` : "- - -"}</p>
        <p className={`text-xs ${card.state === "receiving" ? "text-cyan-300" : "text-amber-300"}`}>{STATE[card.state] || "Loading"}{card.age_s != null && ` · observed ${card.age_s < 90 ? card.age_s + " s" : Math.round(card.age_s / 60) + " min"} ago`}</p>
        <Spark pts={hr} />
        <div className="mt-2 space-y-1 text-xs">
          {bleSupported()
            ? <button className="rounded bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950" onClick={ble ? () => ble.disconnect() : pair}>{ble ? `Disconnect ${ble.name}` : "Pair heart-rate sensor"}</button>
            : <p className="text-amber-300">Web Bluetooth is not available in this browser. Use Chrome or Edge on HTTPS.</p>}
          {bleErr && <p role="alert" className="text-red-400">{bleErr}</p>}
          <p className="text-slate-400">Works with sensors that expose the standard Bluetooth Heart Rate Service. Readings stay in this browser. No blood pressure, SpO₂ or ECG is collected.</p>
          <p className="text-slate-500">{hr.length} readings in the last hour. A reading older than 15 s is shown as stale; the device is shown disconnected after 45 s.</p>
        </div>
      </Panel>

      <Panel title="Crew visualization (3D)">
        <div className="h-72">{webgl ? <Suspense fallback={<p className="text-sm text-slate-400">Loading 3D…</p>}><Body3D pose={pose} region={region} onPick={setRegion} scanning={sweep} /></Suspense> : <p className="text-sm text-slate-400">WebGL is unavailable on this device.</p>}</div>
        <p className="text-xs text-slate-400">Drag to rotate, scroll to zoom, click a body part to select it. The sweep ring is a visual effect; with the camera on, the full skeleton is drawn from your landmarks. Arms follow your camera landmarks only while tracking is on; otherwise the reference posture is shown. It is a visualization, not a validated digital twin. {region && <>Selected: <b>{region}</b>.</>}</p>
        <button className="mb-1 rounded border border-cyan-400/40 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10" onClick={() => { setSweep(true); setTimeout(() => setSweep(false), 5000); }}>Run 3D scan sweep</button>
        <Suspense fallback={null}><CameraPanel onPose={setPose} /></Suspense>
      </Panel>

      <div id="astra">
        <Panel title="ASTRA · health consultation" icon={<Stethoscope size={16} aria-hidden="true" />}>
          <AstraChat />
        </Panel>
      </div>
    </div>
  );
}
