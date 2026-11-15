import { useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
export type Joint = { x: number; y: number; z: number; visibility?: number };
export default function PoseCamera({ onPose, onSave }: { onPose: (p: Joint[]) => void; onSave: (reps: number, minutes: number) => Promise<void> }) {
  const video = useRef<HTMLVideoElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const model = useRef<PoseLandmarker | null>(null), stream = useRef<MediaStream | null>(null), frame = useRef(0), generation = useRef(0);
  const callbacks = useRef({ onPose, onSave }); callbacks.current = { onPose, onSave };
  const [status, setStatus] = useState('Camera off'), [running, setRunning] = useState(false), [busy, setBusy] = useState(false), [count, setCount] = useState(0), [angle, setAngle] = useState<number | null>(null), [saved, setSaved] = useState(false);
  const started = useRef(0), repetitions = useRef(0);
  function stop() { generation.current++; cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; model.current?.close(); model.current = null; callbacks.current.onPose([]); setRunning(false); setBusy(false); setAngle(null); setStatus('Camera off'); }
  useEffect(() => () => { generation.current++; cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(t => t.stop()); model.current?.close(); callbacks.current.onPose([]); }, []);
  async function start() {
    stop(); const gen = generation.current; setBusy(true); setStatus('Loading local pose model…'); setSaved(false); repetitions.current = 0; setCount(0);
    try {
      const { FilesetResolver, PoseLandmarker: Pose, DrawingUtils } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm');
      const options = { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' }, runningMode: 'VIDEO' as const, numPoses: 1 };
      let detector: PoseLandmarker;
      try { detector = await Pose.createFromOptions(files, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } }); } catch { detector = await Pose.createFromOptions(files, options); }
      if (gen !== generation.current) { detector.close(); return; } model.current = detector;
      const media = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      if (gen !== generation.current) { media.getTracks().forEach(t => t.stop()); return; } stream.current = media;
      video.current!.srcObject = media; await video.current!.play();
      if (gen !== generation.current) return;
      started.current = Date.now(); setRunning(true); setBusy(false);
      let previousVideo = -1, previousFrame = 0, down = false, downAt = 0;
      const tick = (t: number) => {
        if (gen !== generation.current) return;
        const v = video.current!, c = canvas.current!;
        try {
          if (v.readyState >= 2 && v.currentTime !== previousVideo && t - previousFrame > 66) {
            previousVideo = v.currentTime; previousFrame = t;
            const result = detector.detectForVideo(v, t), lm = result.landmarks[0];
            c.width = v.videoWidth; c.height = v.videoHeight; const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height);
            const visible = lm && [11,12,23,24,25,26,27,28].every(i => (lm[i].visibility ?? 0) > .65);
            if (visible) {
              new DrawingUtils(ctx).drawConnectors(lm, Pose.POSE_CONNECTIONS, { color: '#66e9d2', lineWidth: 3 });
              callbacks.current.onPose(result.worldLandmarks[0] || []);
              const a = lm[23], b = lm[25], d = lm[27];
              const u = [(a.x-b.x)*c.width,(a.y-b.y)*c.height], w = [(d.x-b.x)*c.width,(d.y-b.y)*c.height];
              const n = Math.hypot(...u)*Math.hypot(...w);
              const degrees = n ? Math.acos(Math.max(-1,Math.min(1,(u[0]*w[0]+u[1]*w[1])/n)))*180/Math.PI : 0;
              setAngle(Math.round(degrees)); setStatus('Tracking • local inference');
              if (!down && degrees < 105) { down = true; downAt = t; }
              if (down && degrees > 160) { if (t-downAt > 600 && t-downAt < 15000) { repetitions.current++; setCount(repetitions.current); } down = false; }
            } else { down = false; setAngle(null); setStatus('Step back: keep your full body visible'); callbacks.current.onPose([]); }
          }
          frame.current = requestAnimationFrame(tick);
        } catch { stop(); setStatus('Tracking stopped. Try restarting the camera.'); }
      };
      frame.current = requestAnimationFrame(tick);
    } catch (e) { if (gen === generation.current) { stop(); setStatus(e instanceof Error ? e.message : 'Camera unavailable'); } }
  }
  return <section className="live-panel camera-panel"><div className="section-top"><div><span className="eyebrow">LOCAL VISION</span><h2>Movement lab</h2></div><span className="pill">{running ? 'CAMERA ON' : 'PRIVATE BY DEFAULT'}</span></div>
    <div className="camera-view"><video ref={video} muted playsInline /><canvas ref={canvas} />{!running && <div className="camera-empty">Your movement.<br/><strong>Your device.</strong><small>Video stays in this browser.</small></div>}</div>
    <p role="status">{status}</p><div className="camera-metrics"><span><b>{count}</b> squat cycles</span><span><b>{angle ?? '—'}</b> knee angle °</span></div>
    <div className="actions"><button onClick={() => void start()} disabled={busy || running}>{busy ? 'Loading…' : 'Start camera'}</button><button className="quiet" onClick={stop} disabled={!running && !busy}>Stop</button><button className="quiet" disabled={!running || saved} onClick={() => void callbacks.current.onSave(count, (Date.now()-started.current)/60000).then(() => setSaved(true)).catch(e => setStatus(e.message))}>{saved ? 'Saved' : 'Save session'}</button></div>
    <small>Experimental movement observations, not a bone-density or medical assessment. Face the camera, keep it level, and use good lighting. Camera angle affects measurements.</small>
  </section>;
}
