import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { HeartPulse, Send, Stethoscope } from "lucide-react";
import { localApi } from "../lib/local";
import { bleSupported, connectHeartRate, type HrConnection } from "../lib/ble";
import { astra, type AstraCtx, type AstraReply } from "../lib/astra";
import { listReports } from "../lib/history";
import { overall } from "../lib/assess";
import { useStore } from "../lib/store";
import { Panel } from "./ui";

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
  const { data } = useStore();
  const [hr, setHr] = useState<{ t: number; v: number }[]>([]), [card, setCard] = useState<any>({}), [ble, setBle] = useState<HrConnection | null>(null), [bleErr, setBleErr] = useState("");
  const [pose, setPose] = useState<any>(null), [region, setRegion] = useState(""), [kp, setKp] = useState<{ v: number | null; live: boolean }>({ v: null, live: false });
  const [log, setLog] = useState<{ me?: string; a?: AstraReply }[]>([]), [q, setQ] = useState("");
  const dev = useRef("");

  const refresh = useCallback(async () => {
    const [rows, cards, n] = await Promise.all([localApi("/measurements?metric=heart_rate&since_hours=1"), localApi("/cards"), localApi("/context/nasa")]);
    setHr(rows.map((r: any) => ({ t: Date.parse(r.observed_at), v: r.value }))); setCard(cards.cardiovascular?.heart_rate || {});
    setKp({ v: n.noaa_kp?.data?.current?.kp ?? null, live: !!n.noaa_kp?.live });
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

  const ctx = (): AstraCtx => {
    const o = overall(data), rep = listReports()[0], v = hr.map(p => p.v);
    return {
      hr: { n: v.length, latest: card.value ?? null, ageS: card.age_s ?? null, min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, mean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, state: STATE[card.state] || "no sensor" },
      scan: rep ? { when: rep.when.toLocaleString(), impression: rep.impression, flagged: rep.flagged, postureScore: rep.postureScore, quality: rep.quality, recommendations: rep.recommendations } : null,
      kp: kp.v, kpLive: kp.live, sleepH: o.mental.avgSleep, mood: o.mental.score,
    };
  };
  const ask = (text: string) => { const m = text.trim(); if (!m) return; setQ(""); setLog(l => [...l, { me: m }, { a: astra(m, ctx()) }]); };

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
        <div className="h-72">{webgl ? <Suspense fallback={<p className="text-sm text-slate-400">Loading 3D…</p>}><Body3D pose={pose} region={region} onPick={setRegion} /></Suspense> : <p className="text-sm text-slate-400">WebGL is unavailable on this device.</p>}</div>
        <p className="text-xs text-slate-400">Click a body part to select it. Arms follow your camera landmarks only while tracking is on; otherwise the reference posture is shown. It is a visualization, not a validated digital twin. {region && <>Selected: <b>{region}</b>.</>}</p>
        <Suspense fallback={null}><CameraPanel onPose={setPose} /></Suspense>
      </Panel>

      <div id="astra">
        <Panel title="ASTRA · health consultation" icon={<Stethoscope size={16} aria-hidden="true" />}>
          <p className="text-xs text-amber-200">ASTRA is a rule-based assistant, not an AI model and not a doctor. It reads your sensor, scan and logs in this browser, and never diagnoses or prescribes.</p>
          <div className="my-2 max-h-72 space-y-3 overflow-auto text-sm" aria-live="polite">
            {!log.length && <p className="text-slate-400">Ask about your heart rate, stress, sleep, posture or space weather.</p>}
            {log.map((m, i) => m.me ? <p key={i} className="text-slate-300">You: {m.me}</p> : (
              <div key={i} className={`rounded-lg border p-2 ${m.a!.safety ? "border-red-400/60 bg-red-900/20" : "border-white/10 bg-white/5"}`}>
                <p className="font-semibold text-white">{m.a!.concern}</p>
                {m.a!.findings.length > 0 && <><p className="mt-1 text-xs font-semibold text-cyan-300">What your data shows</p><ul className="list-disc pl-4 text-xs text-slate-200">{m.a!.findings.map((f, j) => <li key={j}>{f}</li>)}</ul></>}
                <p className="mt-1 text-xs font-semibold text-cyan-300">Assessment (wellness level)</p><p className="text-xs text-slate-200">{m.a!.assessment}</p>
                {m.a!.plan.length > 0 && <><p className="mt-1 text-xs font-semibold text-cyan-300">Suggested next steps</p><ul className="list-disc pl-4 text-xs text-slate-200">{m.a!.plan.map((f, j) => <li key={j}>{f}</li>)}</ul></>}
                {m.a!.missing.length > 0 && <p className="mt-1 text-xs text-slate-400">Missing: {m.a!.missing.join(" ")}</p>}
                <p className="mt-1 text-xs font-semibold text-amber-300">Get real care if</p><ul className="list-disc pl-4 text-xs text-slate-300">{m.a!.seekCare.map((f, j) => <li key={j}>{f}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-1">{["How is my heart rate?", "I feel stressed", "I am tired", "Review my posture scan", "Space weather today"].map(c => <button key={c} className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-slate-200 hover:bg-white/10" onClick={() => ask(c)}>{c}</button>)}</div>
          <form onSubmit={e => { e.preventDefault(); ask(q); }} className="flex gap-2">
            <input aria-label="Ask ASTRA" className="flex-1 rounded bg-slate-800 p-2 text-sm text-white" value={q} onChange={e => setQ(e.target.value)} placeholder="Describe what you feel or ask about your data" />
            <button className="rounded bg-cyan-500 px-3 text-slate-950" aria-label="Send"><Send size={16} /></button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
