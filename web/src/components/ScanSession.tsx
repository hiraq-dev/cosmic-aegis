import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Download, FileDown, ImageUp, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { DrawingUtils, FilesetResolver, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useStore } from "../lib/store";
import { deleteReport, download, listReports, reportsCsv, saveReport } from "../lib/history";
import { buildReport, sampleFrom, type Level, type Report, type Sample } from "../lib/screening";

// Interactive session: camera on -> body scan with live graphics -> clinical-style report.
// Pose tracking runs on this device (MediaPipe BlazePose). Nothing is uploaded.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const SCAN_SECONDS = 18;

type Phase = "idle" | "loading" | "position" | "scanning" | "report" | "error";

const STAGES = [
  { upTo: 0.25, label: "Mapping skeleton (33 landmarks)" },
  { upTo: 0.5, label: "Measuring posture and symmetry" },
  { upTo: 0.8, label: "Estimating breathing from shoulder motion" },
  { upTo: 1.01, label: "Compiling screening report" },
];

const LEVEL_STYLE: Record<Level, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  watch: "bg-amber-100 text-amber-800",
  review: "bg-red-100 text-red-800",
  na: "bg-slate-200 text-slate-600",
};
const LEVEL_TEXT: Record<Level, string> = { ok: "Normal", watch: "Borderline", review: "Review", na: "n/a" };

export default function ScanSession() {
  const { data } = useStore();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const landmarkers = useRef<Partial<Record<"VIDEO" | "IMAGE", PoseLandmarker>>>({});
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const samples = useRef<Sample[]>([]);
  const t0 = useRef(0);
  const okSince = useRef(0);
  const lastLm = useRef<NormalizedLandmark[] | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const dataRef = useRef(data);
  dataRef.current = data;

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState({ posture: 0, lean: 0, tilt: 0, vis: 0 });
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<Report[]>(() => listReports());
  const showReport = (r: Report) => { setReport(r); setHistory(saveReport(r)); };
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const getModel = useCallback(async (mode: "VIDEO" | "IMAGE") => {
    if (!landmarkers.current[mode]) {
      const timeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise<T>((_, bad) => setTimeout(() => bad(new Error("model timeout")), 45000))]);
      const fs = await timeout(FilesetResolver.forVisionTasks(WASM));
      const make = (delegate: "GPU" | "CPU") => PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: mode, numPoses: 1 });
      try { landmarkers.current[mode] = await timeout(make("GPU")); } catch { landmarkers.current[mode] = await timeout(make("CPU")); }
    }
    return landmarkers.current[mode]!;
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  // ---- drawing -------------------------------------------------------------------------------------------------
  const paint = (lm: NormalizedLandmark[] | null, w: number, h: number, scanFrac: number | null, now: number) => {
    const c = canvas.current;
    if (!c) return;
    if (c.width !== w) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    // faint grid
    ctx.strokeStyle = "rgba(0,240,255,.10)"; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    if (!lm) return;
    // bounding box of the body
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const p of lm) { if ((p.visibility ?? 0) < 0.3) continue; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    if (maxX <= minX) return;
    const bx = (minX - 0.04) * w, by = (minY - 0.05) * h, bw = (maxX - minX + 0.08) * w, bh = (maxY - minY + 0.1) * h;
    // scanned region wash
    if (scanFrac !== null) {
      const sweep = ((now / 1800) % 1);
      const yy = by + bh * sweep;
      const g = ctx.createLinearGradient(0, yy - 60, 0, yy);
      g.addColorStop(0, "rgba(0,240,255,0)"); g.addColorStop(1, "rgba(0,240,255,.35)");
      ctx.fillStyle = g; ctx.fillRect(bx, Math.max(by, yy - 60), bw, Math.min(60, yy - by));
      ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 18; ctx.strokeStyle = "#7df9ff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(bx - 10, yy); ctx.lineTo(bx + bw + 10, yy); ctx.stroke(); ctx.shadowBlur = 0;
    }
    // corner brackets
    ctx.strokeStyle = "#00f0ff"; ctx.lineWidth = 3; const L = 26;
    for (const [cx, cy, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]] as const) {
      ctx.beginPath(); ctx.moveTo(cx, cy + dy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * L, cy); ctx.stroke();
    }
    // skeleton with glow
    const du = new DrawingUtils(ctx);
    ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 10;
    du.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: "#00f0ff", lineWidth: 3 });
    ctx.shadowBlur = 0;
    du.drawLandmarks(lm, { color: "#fff", fillColor: "#a78bfa", radius: 3.2 });
    // joint rings pulsing on shoulders and hips
    ctx.strokeStyle = "rgba(167,139,250,.8)"; ctx.lineWidth = 2;
    for (const i of [11, 12, 23, 24]) {
      const r = 8 + 5 * Math.sin(now / 280 + i);
      ctx.beginPath(); ctx.arc(lm[i].x * w, lm[i].y * h, r, 0, Math.PI * 2); ctx.stroke();
    }
  };

  // ---- main loop -----------------------------------------------------------------------------------------------
  const loop = useCallback(() => {
    const v = video.current, lmk = landmarkers.current.VIDEO;
    if (!v || !lmk || v.readyState < 2 || !v.videoWidth) { raf.current = requestAnimationFrame(loop); return; }
    const now = performance.now();
    const res = lmk.detectForVideo(v, now);
    const w = v.videoWidth, h = v.videoHeight;
    const lm = res.landmarks[0] ?? null;
    lastLm.current = lm;
    const ph = phaseRef.current;
    let frac: number | null = null;

    if (lm) {
      const s = sampleFrom(lm, w, h, 0);
      const body = [11, 12, 23, 24].every((i) => (lm[i].visibility ?? 0) > 0.5);
      if (ph === "position") {
        if (body) { if (!okSince.current) okSince.current = now; if (now - okSince.current > 1200) { phaseRef.current = "scanning"; setPhaseState("scanning"); t0.current = now; samples.current = []; } }
        else okSince.current = 0;
      }
      if (phaseRef.current === "scanning") {
        const t = (now - t0.current) / 1000;
        frac = Math.min(1, t / SCAN_SECONDS);
        if (body) samples.current.push({ ...s, t });
        if (samples.current.length % 4 === 0) {
          setProgress(frac);
          const posture = Math.round(Math.max(0, Math.min(100, 100 - s.lean * 2.2 - s.shoulderTilt * 2 - s.hipTilt * 2)));
          setLive({ posture, lean: s.lean, tilt: s.shoulderTilt, vis: Math.round(s.visible * 100) });
        }
        if (t >= SCAN_SECONDS) { finish(); return; }
      }
    } else if (ph === "position") okSince.current = 0;

    paint(lm, w, h, frac, now);
    raf.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    stopCamera();
    setProgress(1);
    showReport(buildReport(samples.current, dataRef.current, SCAN_SECONDS));
    setPhase("report");
    setTimeout(() => document.getElementById("scan-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  const start = async () => {
    setPhase("loading"); setMsg("Loading the on-device pose model (about 6 MB, first time only)..."); setReport(null); setProgress(0); okSince.current = 0;
    try {
      await getModel("VIDEO");
      setMsg("Requesting camera...");
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setPhase("position"); setMsg("");
      raf.current = requestAnimationFrame(loop);
    } catch (e) {
      stopCamera();
      setPhase("error");
      setMsg(e instanceof Error && /Permission|NotAllowed|NotFound|Device/i.test(e.name + e.message) ? "Camera not available or permission denied. You can scan from a photo instead." : "Could not start the scan. Check your connection (the model downloads once) and try again.");
    }
  };

  const fromPhoto = async (f?: File) => {
    if (!f) return;
    stopCamera(); setPhase("loading"); setMsg("Analysing photo...");
    try {
      const lmk = await getModel("IMAGE");
      const el = img.current!;
      await new Promise<void>((ok, bad) => { el.onload = () => ok(); el.onerror = () => bad(new Error("image")); el.src = URL.createObjectURL(f); });
      const lm = lmk.detect(el).landmarks[0];
      if (!lm) { setPhase("error"); setMsg("No person detected in that photo. Use a full-body, front-facing photo."); return; }
      const w = el.naturalWidth, h = el.naturalHeight;
      paint(lm, w, h, null, performance.now());
      const s = sampleFrom(lm, w, h, 0);
      showReport(buildReport([s], dataRef.current, 0));
      setPhase("report");
      setTimeout(() => document.getElementById("scan-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch { setPhase("error"); setMsg("Could not analyse that photo."); }
  };

  const reset = () => { stopCamera(); setReport(null); setProgress(0); setPhase("idle"); setMsg(""); if (canvas.current) canvas.current.getContext("2d")?.clearRect(0, 0, canvas.current.width, canvas.current.height); };

  const stage = STAGES.find((s) => progress < s.upTo)!;
  const active = phase === "position" || phase === "scanning" || phase === "loading";
  const ring = 2 * Math.PI * 44;

  return (
    <section className="glass overflow-hidden p-5 md:p-6" aria-label="Interactive body scan">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="hud-mono text-[10px] tracking-widest text-hud-emerald">INTERACTIVE SESSION</div>
          <h2 className="font-display text-xl font-extrabold text-white md:text-2xl">Scan your body and get a screening report</h2>
        </div>
        <span className="hud-mono inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 text-[10px] tracking-wider text-slate-300"><ShieldCheck size={12} aria-hidden="true" /> RUNS ON YOUR DEVICE. VIDEO IS NOT UPLOADED.</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* viewport */}
        <div className="relative mx-auto aspect-[4/3] w-full max-w-[680px] overflow-hidden rounded-xl border border-cyan-400/30 bg-[#04070f]">
          <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${active && phase !== "loading" ? "" : "hidden"}`} />
          <img ref={img} alt="Photo used for the scan" className={`absolute inset-0 h-full w-full object-contain ${phase === "report" && !stream.current && img.current?.src ? "" : "hidden"}`} />
          <canvas ref={canvas} className={`absolute inset-0 h-full w-full ${phase === "report" && !img.current?.src ? "hidden" : ""} ${active ? "-scale-x-100 object-cover" : "object-contain"}`} />

          {phase === "idle" || phase === "error" || phase === "loading" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
              <svg viewBox="0 0 200 260" className="h-40 w-32 opacity-90" aria-hidden="true">
                <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#00f0ff" stopOpacity="0" /><stop offset="1" stopColor="#00f0ff" stopOpacity=".6" /></linearGradient></defs>
                <g fill="none" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".85">
                  <circle cx="100" cy="30" r="18" />
                  <path d="M100 48v14M62 70h76M62 70l-22 70M138 70l22 70M80 70l4 80M120 70l-4 80M84 150l-10 90M116 150l10 90" />
                </g>
                <rect x="20" y="0" width="160" height="40" fill="url(#sg)"><animate attributeName="y" values="-40;240;-40" dur="3.2s" repeatCount="indefinite" /></rect>
              </svg>
              <p className="max-w-xs text-sm text-slate-300" role="status">{phase === "loading" || msg ? msg : "Stand about 2 metres from the camera with your whole body in view, in good light."}</p>
            </div>
          ) : null}

          {phase === "position" && (
            <div className="absolute inset-x-0 bottom-3 text-center"><span className="hud-mono rounded bg-black/70 px-3 py-1 text-xs text-amber-200">STEP BACK AND HOLD STILL, WHOLE BODY IN FRAME...</span></div>
          )}
          {phase === "scanning" && (
            <>
              <div className="hud-mono absolute left-3 top-3 rounded bg-black/65 px-2.5 py-1 text-[11px] tracking-widest text-hud-emerald">SCANNING {Math.round(progress * 100)}%</div>
              <div className="hud-mono absolute bottom-3 left-3 right-3 rounded bg-black/65 px-3 py-1.5 text-center text-xs text-cyan-200">{stage.label}...</div>
            </>
          )}
        </div>

        {/* side panel */}
        <div className="flex flex-col gap-3">
          {phase === "scanning" || phase === "position" ? (
            <>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90" role="img" aria-label={`Scan progress ${Math.round(progress * 100)} percent`}>
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#00f0ff" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${progress * ring} ${ring}`} style={{ filter: "drop-shadow(0 0 6px #00f0ff)" }} />
                </svg>
                <div>
                  <div className="font-display text-3xl font-bold tabular-nums text-white">{Math.round(progress * SCAN_SECONDS)}<span className="text-base text-slate-400"> / {SCAN_SECONDS}s</span></div>
                  <div className="hud-mono text-[10px] tracking-widest text-slate-400">KEEP STILL, BREATHE NORMALLY</div>
                </div>
              </div>
              <ul className="space-y-1.5 text-sm">
                {STAGES.map((s, i) => {
                  const done = progress >= s.upTo || (i === STAGES.length - 1 && progress >= 1);
                  const cur = !done && progress >= (STAGES[i - 1]?.upTo ?? 0);
                  return (
                    <li key={s.label} className={`flex items-center gap-2 ${done ? "text-emerald-300" : cur ? "text-white" : "text-slate-500"}`}>
                      <span className={`inline-block h-2 w-2 rounded-full ${done ? "bg-emerald-400" : cur ? "animate-pulse bg-aegis-cyan" : "bg-slate-600"}`} /> {s.label}
                    </li>
                  );
                })}
              </ul>
              <div className="grid grid-cols-3 gap-2">
                {[["POSTURE", String(live.posture)], ["LEAN", `${live.lean.toFixed(1)}°`], ["SHOULDER TILT", `${live.tilt.toFixed(1)}°`]].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
                    <div className="hud-mono text-[9px] tracking-wider text-slate-400">{l}</div>
                    <div className="hud-mono text-lg font-bold tabular-nums text-aegis-cyan">{v}</div>
                  </div>
                ))}
              </div>
              <button onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/50 px-3 py-2 text-sm text-red-100"><CameraOff size={15} aria-hidden="true" /> Cancel scan</button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-300">
                A neural network finds 33 body landmarks in every frame. For 18 seconds AEGIS measures posture, symmetry and shoulder-driven breathing, then combines the scan with your logged check-ins and vitals into a structured screening report you can print or save as a PDF.
              </p>
              <ul className="space-y-1 text-xs text-slate-400">
                <li>Measures: posture, tilt, sway, head position, estimated breathing rate.</li>
                <li>Combines with: stress, sleep, vitals, exercise and your personal baseline.</li>
                <li>Does not do: diagnose disease. A camera cannot detect illness.</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <button onClick={start} disabled={phase === "loading"} className="inline-flex items-center gap-2 rounded-lg border border-aegis-cyan bg-aegis-cyan/20 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(0,240,255,.35)] disabled:opacity-60"><Camera size={17} aria-hidden="true" /> {phase === "report" ? "Scan again" : "Open camera and scan"}</button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5">
                  <ImageUp size={16} aria-hidden="true" /> Use a photo
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => fromPhoto(e.target.files?.[0])} />
                </label>
                {phase === "report" && <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm text-slate-200"><RotateCcw size={15} aria-hidden="true" /> Clear</button>}
              </div>
              {phase === "error" && msg && <p className="text-sm text-amber-200" role="status">{msg}</p>}
            </>
          )}
        </div>
      </div>

      {report && <ReportView r={report} data={data} />}

      {history.length > 0 && (
        <section className="mt-6 print:hidden" aria-label="Saved scan reports">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-white">Saved scans ({history.length})</h3>
            <div className="flex gap-2">
              <button onClick={() => download("aegis-scan-reports.json", JSON.stringify(history, null, 2))} className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"><Download size={13} aria-hidden="true" /> JSON</button>
              <button onClick={() => download("aegis-scan-reports.csv", reportsCsv(history), "text/csv")} className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"><Download size={13} aria-hidden="true" /> CSV</button>
            </div>
          </div>
          <ul className="space-y-1.5 text-xs">
            {history.slice(0, 6).map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                <span className="hud-mono text-slate-400">{h.when.toLocaleString()}</span>
                <span>Posture {h.postureScore}/100 &middot; readiness {h.readinessIndex}/100 ({h.readinessBand})</span>
                <span className="flex gap-3">
                  <button onClick={() => { setReport(h); setTimeout(() => document.getElementById("scan-report")?.scrollIntoView({ behavior: "smooth" }), 100); }} className="text-aegis-cyan underline">Open</button>
                  <button onClick={() => setHistory(deleteReport(h.id))} aria-label={`Delete report ${h.id}`} className="text-slate-400 hover:text-red-300"><Trash2 size={14} /></button>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-slate-500">Saved only in this browser. Reports include no video or images.</p>
        </section>
      )}
    </section>
  );
}

// ---- report ----------------------------------------------------------------------------------------------------
function Row({ f }: { f: { label: string; value: string; reference: string; level: Level; note?: string } }) {
  return (
    <tr className="border-b border-slate-200 align-top">
      <td className="py-1.5 pr-3 font-medium text-slate-900">{f.label}{f.note && <div className="text-[11px] font-normal text-slate-500">{f.note}</div>}</td>
      <td className="py-1.5 pr-3 tabular-nums text-slate-900">{f.value}</td>
      <td className="py-1.5 pr-3 text-slate-600">{f.reference}</td>
      <td className="py-1.5"><span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${LEVEL_STYLE[f.level]}`}>{LEVEL_TEXT[f.level]}</span></td>
    </tr>
  );
}

function ReportView({ r, data }: { r: Report; data: ReturnType<typeof useStore>["data"] }) {
  const p = data.profile;
  const table = (title: string, rows: Report["findings"]) => (
    <section className="mt-4">
      <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h4>
      <table className="w-full text-left text-[13px]">
        <thead><tr className="border-b-2 border-slate-300 text-[11px] uppercase tracking-wide text-slate-500"><th className="pb-1 pr-3">Measure</th><th className="pb-1 pr-3">Result</th><th className="pb-1 pr-3">Reference</th><th className="pb-1">Status</th></tr></thead>
        <tbody>{rows.map((f) => <Row key={f.label} f={f} />)}</tbody>
      </table>
    </section>
  );
  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h3 className="font-display text-lg font-bold text-white">Your screening report</h3>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-aegis-cyan bg-aegis-cyan/15 px-4 py-2 text-sm font-semibold text-white"><FileDown size={16} aria-hidden="true" /> Print or save as PDF</button>
      </div>
      <article id="scan-report" className="mx-auto max-w-4xl rounded-lg bg-white p-6 text-slate-800 shadow-2xl md:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-slate-800 pb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Team AEGIS &bull; C.O.S.M.I.C. AEGIS</div>
            <h3 className="text-xl font-bold text-slate-900">Wellness Screening Report</h3>
            <p className="text-xs text-slate-500">Demo prototype. Sample data. Not a medical record.</p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Report ID <strong className="text-slate-900">{r.id}</strong></div>
            <div>{r.when.toLocaleString()}</div>
          </div>
        </header>

        <section className="mt-3 grid gap-x-8 gap-y-1 text-[13px] sm:grid-cols-2">
          <div><span className="text-slate-500">Subject:</span> <strong>{p.name}</strong> (fictional profile)</div>
          <div><span className="text-slate-500">Role:</span> {p.role}, age {p.age}</div>
          <div><span className="text-slate-500">Mission:</span> {p.missionName}</div>
          <div><span className="text-slate-500">Scan:</span> {r.seconds ? `${r.seconds} s, ${r.frames} frames` : "single photo"}, image quality {r.quality}%</div>
        </section>

        <section className="mt-4 rounded-md border border-slate-300 bg-slate-50 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Impression</h4>
          <p className="mt-1 text-[13.5px] leading-relaxed text-slate-900">{r.impression}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-[13px]">
            <span>Posture score <strong>{r.postureScore}/100</strong></span>
            <span>AEGIS readiness <strong>{r.readinessIndex}/100</strong> ({r.readinessBand})</span>
          </div>
        </section>

        {table("A. Camera scan findings", r.findings)}
        {table("B. Logged data (check-ins, vitals, activity)", r.logged)}

        <section className="mt-4">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">C. Stress and tension</h4>
          <p className="text-[13px] text-slate-900"><span className={`mr-2 rounded px-2 py-0.5 text-[11px] font-semibold ${LEVEL_STYLE[r.tension.level]}`}>{LEVEL_TEXT[r.tension.level]}</span>{r.tension.text}</p>
          <p className="mt-1 text-[11px] text-slate-500">Stress cannot be measured by a camera. This combines your own check-in answers with posture markers of muscle tension.</p>
        </section>

        {r.flagged.length > 0 && (
          <section className="mt-4">
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">D. Changes against your own baseline</h4>
            <ul className="list-disc pl-5 text-[13px] text-slate-900">{r.flagged.map((f) => <li key={f}>{f}</li>)}</ul>
          </section>
        )}

        <section className="mt-4">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Recommendations</h4>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-slate-900">{r.recommendations.map((x) => <li key={x}>{x}</li>)}</ol>
        </section>
        <section className="mt-4">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Follow-up</h4>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-slate-900">{r.followUp.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>

        <footer className="mt-5 border-t border-slate-300 pt-3 text-[11px] leading-relaxed text-slate-500">
          <strong>Limitations.</strong> This is an awareness screening from a webcam and self-reported entries. It does not diagnose disease, measure vital signs, or replace a medical examination. Reference ranges are illustrative. Breathing rate is estimated from shoulder movement and may be unreliable. Health entries in this prototype are simulated. If you feel unwell, contact your crew medical officer or mission emergency channel.
        </footer>
      </article>
    </div>
  );
}
