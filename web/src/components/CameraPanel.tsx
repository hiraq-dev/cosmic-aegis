import { useEffect, useRef, useState } from "react";
import { SquatCounter, kneeAngle, toSkeleton, trackingConfidence } from "../lib/pose";
import type { Pose } from "./Body3D";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export default function CameraPanel({ onPose }: { onPose: (p: Pose) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"off" | "loading" | "on" | "error">("off"), [msg, setMsg] = useState(""), [stat, setStat] = useState<any>(null);
  const stop = useRef<() => void>(() => {});

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
      const counter = new SquatCounter(), t0 = performance.now(); let last = -1, alive = true, frames = 0, tStart = performance.now();
      const loop = () => {
        if (!alive) return;
        if (v.currentTime !== last && v.readyState >= 2) { // only process genuinely new frames
          last = v.currentTime; frames++;
          const res = lmk.detectForVideo(v, performance.now());
          const lm = res.landmarks?.[0];
          if (lm && trackingConfidence(lm, [11, 12, 23, 24]) >= 0.6) { onPose(toSkeleton(lm)); counter.push(kneeAngle(lm)); } else { onPose(null); counter.push(null); }
          if (frames % 15 === 0) setStat({ ...counter.summary((performance.now() - t0) / 1000), fps: +(frames / ((performance.now() - tStart) / 1000)).toFixed(1) });
        }
        v.requestVideoFrameCallback ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
      };
      stop.current = () => { alive = false; stream.getTracks().forEach(t => t.stop()); try { lmk.close(); } catch { /* closed */ } v.srcObject = null; onPose(null); };
      setState("on"); loop();
    } catch (e: any) { stop.current(); setState("error"); setMsg(e.name === "NotAllowedError" ? "Camera permission was denied." : e.message || "Camera or model unavailable."); }
  };
  useEffect(() => () => stop.current(), []);
  return (
    <div className="space-y-1 text-xs">
      <video ref={video} muted playsInline className={state === "on" ? "w-40 rounded" : "hidden"} />
      {state !== "on" ? <button className="rounded bg-slate-700 px-3 py-1" onClick={start} disabled={state === "loading"}>{state === "loading" ? "Loading pose model…" : "Start camera movement tracking"}</button>
        : <button className="rounded bg-slate-700 px-3 py-1" onClick={() => { stop.current(); setState("off"); }}>Stop camera</button>}
      {msg && <p role="alert" className="text-red-400">{msg}</p>}
      {stat && <p className="text-slate-300">Squats counted: <b>{stat.reps}</b> · usable frames {Math.round(stat.usable_fraction * 100)}% · {stat.fps} fps measured{stat.reps > 0 && <> · depths {stat.depths_deg.join(", ")}°</>}</p>}
      <p className="text-slate-500">Frames are processed in this browser and never uploaded. Angles depend on camera position; full body must be visible. Movement tracking only: no breathing, disease or health-status inference.</p>
    </div>
  );
}
