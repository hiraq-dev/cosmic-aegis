import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Camera, CameraOff, ImageUp, Save, ScanLine } from "lucide-react";
import { DrawingUtils, FilesetResolver, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { DemoBadge, Panel } from "../components/ui";
import { useStore } from "../lib/store";
import { today } from "../lib/dates";

// REAL-TIME BODY SCAN. Runs Google MediaPipe BlazePose (a neural network) locally in the browser on the webcam.
// 33 body landmarks -> joint angles, posture and symmetry scores, squat repetition counting and a fatigue trend.
// Video never leaves the device. This is a movement-quality demo, not a medical measurement.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const L = { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27 };
const R = { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28 };

interface Metrics {
  kneeL: number; kneeR: number; elbowL: number; elbowR: number; hipL: number; hipR: number;
  shoulderTilt: number; hipTilt: number; lean: number; symmetry: number; posture: number; visible: number;
}
interface Rep { t: number; dur: number; depth: number }

function ang(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark, w: number, h: number): number {
  const v1 = [(a.x - b.x) * w, (a.y - b.y) * h], v2 = [(c.x - b.x) * w, (c.y - b.y) * h];
  const d = v1[0] * v2[0] + v1[1] * v2[1];
  const n = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
  return n ? (Math.acos(Math.max(-1, Math.min(1, d / n))) * 180) / Math.PI : 0;
}
const tilt = (a: NormalizedLandmark, b: NormalizedLandmark, w: number, h: number) => (Math.atan2((b.y - a.y) * h, (b.x - a.x) * w) * 180) / Math.PI;

function compute(lm: NormalizedLandmark[], w: number, h: number): Metrics {
  const k = (s: typeof L) => ({ knee: ang(lm[s.hip], lm[s.kn], lm[s.an], w, h), elbow: ang(lm[s.sh], lm[s.el], lm[s.wr], w, h), hip: ang(lm[s.sh], lm[s.hip], lm[s.kn], w, h) });
  const l = k(L), r = k(R);
  const sT = Math.abs(tilt(lm[11], lm[12], w, h)), sTn = Math.min(sT, 180 - sT);
  const hT = Math.abs(tilt(lm[23], lm[24], w, h)), hTn = Math.min(hT, 180 - hT);
  const sm = { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 }, hm = { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 };
  const lean = Math.abs((Math.atan2((sm.x - hm.x) * w, (hm.y - sm.y) * h) * 180) / Math.PI);
  const symmetry = Math.max(0, 100 - Math.abs(l.knee - r.knee) * 2.2 - Math.abs(sTn - hTn) * 1.5);
  const posture = Math.max(0, Math.min(100, 100 - lean * 2.2 - sTn * 2 - hTn * 2 + (symmetry - 100) * 0.2));
  const vis = [11, 12, 23, 24, 25, 26, 27, 28].reduce((s, i) => s + (lm[i].visibility ?? 0), 0) / 8;
  return { kneeL: l.knee, kneeR: r.knee, elbowL: l.elbow, elbowR: r.elbow, hipL: l.hip, hipR: r.hip, shoulderTilt: sTn, hipTilt: hTn, lean, symmetry, posture, visible: vis };
}

export default function Scan() {
  const { addExercise } = useStore();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const landmarkers = useRef<Partial<Record<"VIDEO" | "IMAGE", PoseLandmarker>>>({});
  const raf = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const lastTs = useRef(-1);
  const phase = useRef<"up" | "down">("up");
  const repStart = useRef(0);
  const minKnee = useRef(180);
  const reps = useRef<Rep[]>([]);
  const started = useRef(0);
  const frames = useRef({ n: 0, t0: 0 });

  const [status, setStatus] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [m, setM] = useState<Metrics | null>(null);
  const [repList, setRepList] = useState<Rep[]>([]);
  const [fps, setFps] = useState(0);
  const [hist, setHist] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);

  const ensureModel = useCallback(async (mode: "VIDEO" | "IMAGE") => {
    // one landmarker per running mode: switching mode on a live graph can stall, so never call setOptions
    if (!landmarkers.current[mode]) {
      setMsg("Loading the pose model (about 6 MB, first time only)...");
      const fs = await FilesetResolver.forVisionTasks(WASM);
      const make = (delegate: "GPU" | "CPU") => PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: mode, numPoses: 1 });
      try { landmarkers.current[mode] = await make("GPU"); } catch { landmarkers.current[mode] = await make("CPU"); }
    }
    return landmarkers.current[mode]!;
  }, []);

  const draw = (lms: NormalizedLandmark[] | null, w: number, h: number) => {
    const c = canvas.current;
    if (!c) return;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    if (!lms) return;
    const du = new DrawingUtils(ctx);
    du.drawConnectors(lms, PoseLandmarker.POSE_CONNECTIONS, { color: "#00f0ff", lineWidth: 3 });
    du.drawLandmarks(lms, { color: "#ffffff", fillColor: "#a78bfa", radius: 3.5 });
  };

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setStatus((s) => (s === "live" || s === "loading" ? "idle" : s));
  }, []);
  useEffect(() => stop, [stop]);

  const loop = useCallback(() => {
    const v = video.current, lmk = landmarkers.current.VIDEO;
    if (!v || !lmk || v.readyState < 2) { raf.current = requestAnimationFrame(loop); return; }
    const ts = performance.now();
    if (ts !== lastTs.current && v.videoWidth) {
      lastTs.current = ts;
      const res = lmk.detectForVideo(v, ts);
      const w = v.videoWidth, h = v.videoHeight;
      const lms = res.landmarks[0];
      draw(lms ?? null, w, h);
      frames.current.n++;
      if (ts - frames.current.t0 > 1000) { setFps(Math.round((frames.current.n * 1000) / (ts - frames.current.t0))); frames.current = { n: 0, t0: ts }; }
      if (lms) {
        const mm = compute(lms, w, h);
        const knee = (mm.kneeL + mm.kneeR) / 2;
        // squat repetition state machine with hysteresis (down < 105 deg, up > 160 deg)
        if (phase.current === "up" && knee < 105) { phase.current = "down"; repStart.current = ts; minKnee.current = knee; }
        else if (phase.current === "down") {
          minKnee.current = Math.min(minKnee.current, knee);
          if (knee > 160) {
            phase.current = "up";
            const r = { t: ts, dur: (ts - repStart.current) / 1000, depth: minKnee.current };
            if (r.dur > 0.6) { reps.current = [...reps.current, r]; setRepList(reps.current); }
          }
        }
        if (frames.current.n % 3 === 0) { setM(mm); setHist((hh) => [...hh.slice(-79), knee]); }
      }
    }
    raf.current = requestAnimationFrame(loop);
  }, []);

  const start = async () => {
    setStatus("loading"); setSaved(false); reps.current = []; setRepList([]); setHist([]); phase.current = "up";
    try {
      const lmk = await ensureModel("VIDEO");
      if (!lmk) throw new Error("model");
      setMsg("Requesting camera...");
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      started.current = Date.now();
      frames.current = { n: 0, t0: performance.now() };
      setStatus("live"); setMsg("");
      raf.current = requestAnimationFrame(loop);
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error && /Permission|NotAllowed|NotFound|Device/i.test(e.name + e.message) ? "Camera not available or permission denied. You can analyse a photo instead." : "Could not start the scan. Check your connection (the model downloads once) and try again.");
    }
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    stop(); setStatus("loading"); setMsg("Analysing photo...");
    try {
      const lmk = await ensureModel("IMAGE");
      const el = img.current!;
      await new Promise<void>((ok, bad) => { el.onload = () => ok(); el.onerror = () => bad(new Error("image")); el.src = URL.createObjectURL(f); });
      const res = lmk.detect(el);
      const lms = res.landmarks[0];
      if (!lms) { setMsg("No person detected in that photo."); setStatus("error"); return; }
      const w = el.naturalWidth, h = el.naturalHeight;
      draw(lms, w, h);
      setM(compute(lms, w, h)); setStatus("idle"); setMsg("");
    } catch (e) { setStatus("error"); setMsg("Could not analyse that photo."); }
  };

  // fatigue: slowing of reps and loss of depth, via OLS slope across reps
  const fatigue = (() => {
    if (repList.length < 3) return null;
    const slope = (ys: number[]) => { const n = ys.length, mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n; let a = 0, b = 0; ys.forEach((y, i) => { a += (i - mx) * (y - my); b += (i - mx) ** 2; }); return b ? a / b : 0; };
    const durS = slope(repList.map((r) => r.dur)), depS = slope(repList.map((r) => r.depth));
    const score = Math.max(0, Math.min(100, durS * 120 + depS * 6));
    return { score: Math.round(score), durS, depS };
  })();

  const save = () => {
    const mins = Math.max(1, Math.round((Date.now() - started.current) / 60000));
    addExercise({ date: today(), kind: "Resistive (ARED-style)", minutes: mins, strengthKg: 0 });
    setSaved(true);
  };

  const chip = (label: string, v: string, c = "#00f0ff") => (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="hud-mono text-[10px] tracking-wider text-slate-400">{label}</div>
      <div className="hud-mono text-lg font-bold tabular-nums" style={{ color: c, textShadow: `0 0 8px ${c}55` }}>{v}</div>
    </div>
  );
  const good = (v: number) => (v >= 80 ? "#00ff9d" : v >= 55 ? "#ffb020" : "#ff2a55");
  const spark = hist.length > 1 ? hist.map((v, i) => `${(i / 79) * 300},${60 - ((v - 60) / 120) * 60}`).join(" ") : "";

  return (
    <div className="space-y-5">
      <header className="glass p-5">
        <div className="hud-mono text-[10px] tracking-widest text-hud-emerald">REAL-TIME BODY SCAN</div>
        <h1 className="font-display mt-1 text-2xl font-extrabold text-white sm:text-3xl">Scan your movement with your camera</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          A neural network (MediaPipe BlazePose) finds 33 body landmarks in every video frame, right in your browser. AEGIS turns them into joint angles, posture and symmetry scores, counts squats, and watches for fatigue as reps slow down. In orbit this is how a camera could check exercise form without a trainer, which matters for muscle and bone protection.{" "}
          <Link to="/musculoskeletal" className="text-aegis-cyan underline">See muscle and bone</Link>
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Live scan" icon={<ScanLine size={16} aria-hidden="true" />} action={<DemoBadge text="ON-DEVICE AI" />}>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-[640px] overflow-hidden rounded-lg border border-cyan-400/30 bg-black">
            <video ref={video} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
            <img ref={img} alt="Uploaded for analysis" className={`absolute inset-0 h-full w-full object-contain ${status === "live" ? "hidden" : ""}`} />
            <canvas ref={canvas} className={`absolute inset-0 h-full w-full object-cover ${status === "live" ? "-scale-x-100" : "object-contain"}`} />
            {status !== "live" && !m && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-300">
                <Camera size={32} className="text-aegis-cyan" aria-hidden="true" />
                {status === "loading" ? msg : "Stand 2 metres back so your whole body is in frame, then start. Your video never leaves this device."}
              </div>
            )}
            {status === "live" && <div className="hud-mono absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-hud-emerald">LIVE {fps} FPS</div>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {status === "live" ? (
              <button onClick={stop} className="inline-flex items-center gap-2 rounded-lg border border-red-400/60 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100"><CameraOff size={16} aria-hidden="true" /> Stop scan</button>
            ) : (
              <button onClick={start} disabled={status === "loading"} className="inline-flex items-center gap-2 rounded-lg border border-aegis-cyan bg-aegis-cyan/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Camera size={16} aria-hidden="true" /> Start camera scan</button>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5">
              <ImageUp size={16} aria-hidden="true" /> Analyse a photo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
            {repList.length > 0 && (
              <button onClick={save} disabled={saved} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/50 px-4 py-2 text-sm text-emerald-100 disabled:opacity-60"><Save size={16} aria-hidden="true" /> {saved ? "Saved to activity log" : "Save session"}</button>
            )}
          </div>
          {msg && status !== "loading" && <p className="mt-2 text-sm text-amber-200" role="status">{msg}</p>}
          <p className="mt-2 text-[11px] text-slate-400">Model: MediaPipe Pose Landmarker (lite) running in your browser via WebAssembly/WebGL. Downloaded once from Google storage; no video is uploaded. Movement-quality demo only, not a medical measurement.</p>
        </Panel>

        <div className="space-y-5">
          <Panel title="Body metrics" icon={<Activity size={16} aria-hidden="true" />}>
            {m ? (
              <div className="grid grid-cols-2 gap-2.5">
                {chip("KNEE L / R", `${Math.round(m.kneeL)}° / ${Math.round(m.kneeR)}°`)}
                {chip("HIP L / R", `${Math.round(m.hipL)}° / ${Math.round(m.hipR)}°`, "#a78bfa")}
                {chip("ELBOW L / R", `${Math.round(m.elbowL)}° / ${Math.round(m.elbowR)}°`, "#38bdf8")}
                {chip("TORSO LEAN", `${m.lean.toFixed(1)}°`, m.lean < 8 ? "#00ff9d" : "#ffb020")}
                {chip("SHOULDER TILT", `${m.shoulderTilt.toFixed(1)}°`, "#ffb020")}
                {chip("HIP TILT", `${m.hipTilt.toFixed(1)}°`, "#ffb020")}
                {chip("POSTURE SCORE", `${Math.round(m.posture)}`, good(m.posture))}
                {chip("SYMMETRY", `${Math.round(m.symmetry)}`, good(m.symmetry))}
              </div>
            ) : (
              <p className="text-sm text-slate-300">Start the camera or analyse a photo to see joint angles, posture and symmetry.</p>
            )}
            {m && m.visible < 0.5 && <p className="mt-2 text-xs text-amber-200">Low body visibility. Step back so shoulders to ankles are in frame.</p>}
          </Panel>

          <Panel title="Squat counter and fatigue" icon={<Activity size={16} aria-hidden="true" />}>
            <div className="grid grid-cols-3 gap-2.5">
              {chip("REPS", String(repList.length), "#00ff9d")}
              {chip("LAST DEPTH", repList.length ? `${Math.round(repList[repList.length - 1].depth)}°` : "-")}
              {chip("FATIGUE", fatigue ? `${fatigue.score}` : "-", fatigue ? (fatigue.score < 25 ? "#00ff9d" : fatigue.score < 55 ? "#ffb020" : "#ff2a55") : "#94a3b8")}
            </div>
            <svg viewBox="0 0 300 60" className="mt-3 h-16 w-full" role="img" aria-label="Average knee angle over time">
              <line x1="0" x2="300" y1={60 - ((105 - 60) / 120) * 60} y2={60 - ((105 - 60) / 120) * 60} stroke="rgba(255,42,85,.4)" strokeDasharray="3 3" />
              {spark && <polyline points={spark} fill="none" stroke="#00f0ff" strokeWidth="2" />}
            </svg>
            <p className="text-xs text-slate-300">
              {fatigue
                ? `Rep time trend ${fatigue.durS >= 0 ? "+" : ""}${fatigue.durS.toFixed(2)} s per rep, depth trend ${fatigue.depS >= 0 ? "+" : ""}${fatigue.depS.toFixed(1)} degrees per rep. Slower, shallower reps raise the fatigue score.`
                : "Do 3 or more squats to estimate fatigue from rep speed and depth. A rep counts when the knee bends below 105 degrees and returns above 160."}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
