import { useEffect, useRef, useState } from "react";
import { EXERCISES, counterFor, exerciseSignal, toSkeleton, trackingConfidence, type Exercise, type SignalCounter } from "../lib/pose";
import { saveFit } from "../lib/fitness";
import { localApi } from "../lib/local";
import type { Pose } from "./Body3D";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export default function CameraPanel({ onPose }: { onPose: (p: Pose) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"off" | "loading" | "on" | "error">("off"), [msg, setMsg] = useState("");
  const [ex, setEx] = useState<Exercise>("squat"), [reps, setReps] = useState(0), [secs, setSecs] = useState(0), [usable, setUsable] = useState(100), [fps, setFps] = useState(0), [saved, setSaved] = useState("");
  const stop = useRef<() => void>(() => {});
  const exRef = useRef<Exercise>("squat"), counter = useRef<SignalCounter>(counterFor("squat")), setStart = useRef(performance.now()), startedAt = useRef(new Date());

  const resetSet = (e: Exercise = exRef.current) => { exRef.current = e; counter.current = counterFor(e); setStart.current = performance.now(); startedAt.current = new Date(); setReps(0); setSecs(0); setSaved(""); };
  const pick = (e: Exercise) => { setEx(e); resetSet(e); };

  const start = async () => {
    setState("loading"); setMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      const v = video.current!; v.srcObject = stream; await v.play();
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fs = await FilesetResolver.forVisionTasks(WASM);
      const lmk = await Promise.race([
        PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate: "GPU" }, runningMode: "VIDEO", numPoses: 1 }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Pose model download timed out")), 30000)),
      ]);
      let last = -1, alive = true, frames = 0; const tStart = performance.now(); resetSet();
      const loop = () => {
        if (!alive) return;
        if (v.currentTime !== last && v.readyState >= 2) { // only genuinely new frames
          last = v.currentTime; frames++;
          const res = lmk.detectForVideo(v, performance.now());
          const lm = res.landmarks?.[0];
          const good = lm && trackingConfidence(lm, [11, 12, 23, 24]) >= 0.6;
          if (good) onPose(toSkeleton(lm)); else onPose(null);
          const t = (performance.now() - setStart.current) / 1000;
          counter.current.push(good ? exerciseSignal(exRef.current, lm) : null, t);
          if (frames % 6 === 0) { setReps(counter.current.reps); setSecs(t); const c = counter.current, tot = c.used + c.skipped; setUsable(tot ? Math.round((c.used / tot) * 100) : 100); setFps(+(frames / ((performance.now() - tStart) / 1000)).toFixed(1)); }
        }
        v.requestVideoFrameCallback ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
      };
      stop.current = () => { alive = false; stream.getTracks().forEach(t => t.stop()); try { lmk.close(); } catch { /* closed */ } v.srcObject = null; onPose(null); };
      setState("on"); loop();
    } catch (e: any) { stop.current(); setState("error"); setMsg(e.name === "NotAllowedError" ? "Camera permission was denied." : e.message || "Camera or model unavailable."); }
  };
  useEffect(() => () => stop.current(), []);

  const finish = async () => {
    const c = counter.current, sec = (performance.now() - setStart.current) / 1000;
    if (c.reps === 0) { setSaved("No reps counted yet, nothing saved."); return; }
    let avg: number | null = null, max: number | null = null;
    try { const rows = await localApi("/measurements?metric=heart_rate&since_hours=1"); const v = rows.filter((r: any) => Date.parse(r.observed_at) >= startedAt.current.getTime()).map((r: any) => r.value as number); if (v.length) { avg = Math.round(v.reduce((a: number, b: number) => a + b, 0) / v.length); max = Math.max(...v); } } catch { /* no sensor */ }
    saveFit({ id: Math.random().toString(16).slice(2), when: startedAt.current.toISOString(), exercise: exRef.current, reps: c.reps, seconds: Math.round(sec), tempo: sec > 5 ? +((c.reps / sec) * 60).toFixed(1) : null, avgHr: avg, maxHr: max, usable });
    await localApi("/measurements", { method: "POST", json: { events: [{ event_id: `fit-${Date.now()}`, device_id: "camera-fitness", metric: "exercise_minutes", value: +(sec / 60).toFixed(2), unit: "min", source: "Camera rep counter", source_type: "device", context: "activity" }] } }).catch(() => {});
    setSaved(`Saved: ${c.reps} ${EXERCISES[exRef.current].label.toLowerCase()} in ${Math.round(sec)} s${avg ? `, average ${avg} bpm` : ""}.`); resetSet();
  };

  return (
    <div className="space-y-2 text-xs">
      <video ref={video} muted playsInline className={state === "on" ? "w-40 rounded" : "hidden"} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-slate-300">Exercise <select aria-label="Exercise" className="ml-1 rounded bg-slate-800 p-1 text-white" value={ex} onChange={e => pick(e.target.value as Exercise)}>{(Object.keys(EXERCISES) as Exercise[]).map(k => <option key={k} value={k}>{EXERCISES[k].label}</option>)}</select></label>
        {state !== "on" ? <button className="rounded bg-slate-700 px-3 py-1" onClick={start} disabled={state === "loading"}>{state === "loading" ? "Loading pose model…" : "Start camera and counter"}</button>
          : <button className="rounded bg-slate-700 px-3 py-1" onClick={() => { stop.current(); setState("off"); }}>Stop camera</button>}
      </div>
      <p className="text-slate-400">{EXERCISES[ex].hint}</p>
      {state === "on" && (
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-2">
          <div className="flex items-end gap-4"><div><p className="text-[10px] uppercase tracking-widest text-slate-400">Reps</p><p className="text-5xl font-extrabold tabular-nums text-white" aria-live="polite">{reps}</p></div>
            <div className="text-slate-300"><p>{Math.round(secs)} s{secs > 5 && reps > 0 ? ` · ${((reps / secs) * 60).toFixed(1)} reps/min` : ""}</p><p>Tracking quality {usable}% · {fps} fps</p></div></div>
          <div className="mt-2 flex gap-2"><button className="rounded bg-cyan-500 px-3 py-1 font-semibold text-slate-950" onClick={finish}>Finish and save set</button><button className="rounded border border-white/20 px-3 py-1 text-slate-200" onClick={() => resetSet()}>Reset</button></div>
        </div>
      )}
      {saved && <p className="text-emerald-300">{saved}</p>}
      {msg && <p role="alert" className="text-red-400">{msg}</p>}
      <p className="text-slate-500">Frames are processed in this browser and never uploaded. Counts depend on camera angle and framing; low tracking quality frames are skipped. Movement counting only: no breathing, disease or health-status inference.</p>
    </div>
  );
}
