// Camera screening: turns a short pose-tracking window into posture and breathing measurements,
// then combines them with the user's logged readings into a structured wellness report.
// This is a screening aid for awareness. It does not diagnose disease; the camera cannot detect illness.
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { AppData } from "./types";
import { STATUS_LABEL, assessVital, buildAlerts, overall } from "./assess";
import { buildSeries, readiness } from "./analytics";
import type { FaceSummary } from "./face";

export type Level = "ok" | "watch" | "review" | "na";

export interface Sample {
  t: number; // seconds since scan start
  lean: number;
  shoulderTilt: number;
  hipTilt: number;
  headTilt: number;
  headShift: number; // nose offset from shoulder midline, in shoulder widths
  neckRatio: number; // ear-to-shoulder height over torso length
  hipX: number; // hip midpoint x in shoulder widths
  breathY: number; // shoulder midpoint y in torso lengths
  visible: number;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
const tiltDeg = (a: NormalizedLandmark, b: NormalizedLandmark, w: number, h: number) => {
  const d = Math.abs((Math.atan2((b.y - a.y) * h, (b.x - a.x) * w) * 180) / Math.PI);
  return Math.min(d, 180 - d);
};

export function sampleFrom(lm: NormalizedLandmark[], w: number, h: number, t: number): Sample {
  const shW = Math.max(1e-6, dist(lm[11], lm[12], w, h));
  const sm = { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 };
  const hm = { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 };
  const torso = Math.max(1e-6, dist(sm, hm, w, h));
  const earM = { x: (lm[7].x + lm[8].x) / 2, y: (lm[7].y + lm[8].y) / 2 };
  const vis = [0, 7, 8, 11, 12, 23, 24].reduce((s, i) => s + (lm[i].visibility ?? 0), 0) / 7;
  return {
    t,
    lean: Math.abs((Math.atan2((sm.x - hm.x) * w, (hm.y - sm.y) * h) * 180) / Math.PI),
    shoulderTilt: tiltDeg(lm[11], lm[12], w, h),
    hipTilt: tiltDeg(lm[23], lm[24], w, h),
    headTilt: tiltDeg(lm[7], lm[8], w, h),
    headShift: Math.abs((lm[0].x - sm.x) * w) / shW,
    neckRatio: Math.max(0, (sm.y - earM.y) * h) / torso,
    hipX: (hm.x * w) / shW,
    breathY: (sm.y * h) / torso,
    visible: vis,
  };
}

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};

// Breathing rate from the vertical motion of the shoulders: detrend, smooth, count peaks.
export function breathing(samples: Sample[]): { bpm: number | null; confidence: "good" | "low" | "none"; peaks: number } {
  if (samples.length < 40) return { bpm: null, confidence: "none", peaks: 0 };
  const dur = samples[samples.length - 1].t - samples[0].t;
  if (dur < 8) return { bpm: null, confidence: "none", peaks: 0 };
  const y = samples.map((s) => s.breathY);
  const smooth = (v: number[], k: number) => v.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - k); j <= Math.min(v.length - 1, i + k); j++) { s += v[j]; n++; } return s / n; });
  const slow = smooth(y, 25), fast = smooth(y, 3);
  const sig = fast.map((v, i) => v - slow[i]);
  const amp = std(sig);
  const peaks: number[] = [];
  const minGap = 1.4; // seconds, up to about 40 breaths per minute
  for (let i = 1; i < sig.length - 1; i++) {
    if (sig[i] > sig[i - 1] && sig[i] >= sig[i + 1] && sig[i] > amp * 0.6) {
      const t = samples[i].t;
      if (!peaks.length || t - peaks[peaks.length - 1] >= minGap) peaks.push(t);
    }
  }
  if (peaks.length < 3 || amp < 0.0015) return { bpm: null, confidence: "none", peaks: peaks.length };
  const span = peaks[peaks.length - 1] - peaks[0];
  const bpm = Math.round(((peaks.length - 1) / span) * 60);
  return { bpm, confidence: peaks.length >= 4 ? "good" : "low", peaks: peaks.length };
}

export interface Finding { label: string; value: string; reference: string; level: Level; note?: string }

export interface Report {
  id: string;
  when: Date;
  seconds: number;
  frames: number;
  quality: number; // 0-100
  postureScore: number;
  findings: Finding[];
  logged: Finding[];
  readinessIndex: number;
  readinessBand: string;
  flagged: string[];
  impression: string;
  recommendations: string[];
  followUp: string[];
  tension: { level: Level; text: string };
  face?: FaceSummary | null;
  faceFindings?: Finding[];
  details?: { label: string; unit: string; mean: number; min: number; max: number; sd: number }[];
  comparison?: { label: string; prev: string; now: string; change: string }[];
  quality_notes?: string[];
}

const lv = (v: number, ok: number, watch: number): Level => (v < ok ? "ok" : v < watch ? "watch" : "review");

export function buildReport(samples: Sample[], data: AppData, seconds: number, face: FaceSummary | null = null, prev?: Report): Report {
  const m = (f: (s: Sample) => number) => median(samples.map(f));
  const lean = m((s) => s.lean), sT = m((s) => s.shoulderTilt), hT = m((s) => s.hipTilt), hd = m((s) => s.headTilt);
  const shift = m((s) => s.headShift), neck = m((s) => s.neckRatio);
  const sway = std(samples.map((s) => s.hipX));
  const br = breathing(samples);
  const quality = Math.round(m((s) => s.visible) * 100);
  const postureScore = Math.round(Math.max(0, Math.min(100, 100 - lean * 2.2 - sT * 2 - hT * 2 - hd * 0.8 - shift * 25)));

  const findings: Finding[] = [
    { label: "Posture score", value: `${postureScore}/100`, reference: "80 or higher", level: postureScore >= 80 ? "ok" : postureScore >= 60 ? "watch" : "review" },
    { label: "Torso lean from vertical", value: `${lean.toFixed(1)}°`, reference: "under 6°", level: lv(lean, 6, 12) },
    { label: "Shoulder line tilt", value: `${sT.toFixed(1)}°`, reference: "under 3°", level: lv(sT, 3, 6) },
    { label: "Hip line tilt", value: `${hT.toFixed(1)}°`, reference: "under 3°", level: lv(hT, 3, 6) },
    { label: "Head tilt", value: `${hd.toFixed(1)}°`, reference: "under 5°", level: lv(hd, 5, 10) },
    { label: "Head shift off midline", value: `${shift.toFixed(2)} shoulder widths`, reference: "under 0.12", level: lv(shift, 0.12, 0.25) },
    { label: "Neck-to-shoulder ratio", value: neck.toFixed(2), reference: "0.25 or higher (low can mean shrugged shoulders)", level: neck >= 0.25 ? "ok" : neck >= 0.15 ? "watch" : "review" },
    { label: "Standing sway", value: `${sway.toFixed(3)}`, reference: "under 0.03", level: samples.length > 30 ? lv(sway, 0.03, 0.06) : "na" },
    br.bpm === null
      ? { label: "Breathing rate (estimated)", value: "not measured", reference: "12 to 20 per min", level: "na", note: "Needs about 18 s of still, front-facing video." }
      : { label: "Breathing rate (estimated)", value: `${br.bpm} per min`, reference: "12 to 20 per min", level: br.bpm >= 12 && br.bpm <= 20 ? "ok" : br.bpm >= 10 && br.bpm <= 24 ? "watch" : "review", note: br.confidence === "low" ? "Low confidence, few breaths counted." : undefined },
  ];

  const o = overall(data);
  const m5 = o.mental.latest;
  const logged: Finding[] = [];
  if (m5) {
    logged.push({ label: "Latest stress check-in", value: `${m5.stress}/5`, reference: "3 or lower", level: m5.stress <= 3 ? "ok" : m5.stress === 4 ? "watch" : "review" });
    logged.push({ label: "High-stress check-ins (last 5)", value: `${o.mental.highStress}`, reference: "fewer than 3", level: o.mental.highStress >= 3 ? "review" : o.mental.highStress >= 2 ? "watch" : "ok" });
  }
  logged.push({ label: "Average sleep (7 entries)", value: `${o.mental.avgSleep.toFixed(1)} h`, reference: "6.5 h or more", level: o.mental.avgSleep >= 6.5 ? "ok" : o.mental.avgSleep >= 5.5 ? "watch" : "review" });
  if (o.cardio.latest) {
    for (const v of assessVital(o.cardio.latest)) logged.push({ label: v.label, value: v.value, reference: ({ heartRate: "50 to 100 bpm", bloodPressure: "under 130/85 mmHg", spo2: "95% or higher" } as Record<string, string>)[v.key] ?? "illustrative range", level: v.status === "nominal" ? "ok" : v.status === "watch" ? "watch" : "review" });
  }
  logged.push({ label: "Active days (last 7)", value: `${o.msk.daysActive}`, reference: "4 or more", level: o.msk.daysActive >= 4 ? "ok" : o.msk.daysActive >= 2 ? "watch" : "review" });

  const series = buildSeries(data);
  const rd = readiness(series);
  const flagged = series.filter((s) => s.anomaly || s.worsening).map((s) => `${s.label}: ${s.z >= 0 ? "+" : ""}${s.z.toFixed(1)} SD from your own baseline${s.worsening ? ", worsening trend" : ""}`);

  // Tension picture: posture markers of muscular tension combined with the self-reported stress.
  const tensionMarks = [neck < 0.2, sT >= 3, lean >= 6, shift >= 0.12].filter(Boolean).length;
  const stressHigh = (m5?.stress ?? 0) >= 4 || o.mental.stressAlert;
  const tension: Report["tension"] =
    stressHigh && tensionMarks >= 2 ? { level: "review", text: "Your self-reported stress is high and your posture shows tension markers (raised or uneven shoulders, lean). These point the same way." }
    : stressHigh ? { level: "watch", text: "Your self-reported stress is high. Your posture shows few tension markers, so the strain may be mostly mental." }
    : tensionMarks >= 3 ? { level: "watch", text: "Your posture shows several tension markers even though reported stress is not high. A stretch break may help." }
    : { level: "ok", text: "No strong tension pattern in your posture, and reported stress is manageable." };


  // ---- facial expression cues (visible muscle movement only; not emotion or illness) -----------------------------------
  const faceFindings: Finding[] = [];
  if (face) {
    const pc = (v: number) => `${Math.round(v * 100)}%`;
    faceFindings.push(
      { label: "Dominant facial expression", value: face.dominant, reference: "descriptive only", level: "na", note: `Share of frames: ${(Object.entries(face.share) as [string, number][]).filter(([, v]) => v > 0.02).map(([k, v]) => `${k} ${pc(v)}`).join(", ")}` },
      { label: "Smile activity (mean / peak)", value: `${face.smileMean.toFixed(2)} / ${face.smilePeak.toFixed(2)}`, reference: "descriptive (0 to 1)", level: "na" },
      { label: "Brow furrow (mean, share of frames)", value: `${face.furrowMean.toFixed(2)}, ${pc(face.furrowShare)}`, reference: "under 20% of frames", level: face.furrowShare < 0.2 ? "ok" : face.furrowShare < 0.45 ? "watch" : "review", note: "Sustained furrowing can accompany concentration, tension or discomfort. The camera cannot tell which." },
      { label: "Blink rate", value: face.blinkPerMin === null ? "not measured" : `${face.blinkPerMin.toFixed(0)} per min`, reference: "about 8 to 30 per min", level: face.blinkPerMin === null ? "na" : face.blinkPerMin >= 8 && face.blinkPerMin <= 30 ? "ok" : "watch", note: "Needs about 8 s of clear face view. Screens, dry air and concentration change blink rate." },
      { label: "Eyes closed (share of frames)", value: pc(face.eyesClosedShare), reference: "under 15%", level: face.eyesClosedShare < 0.15 ? "ok" : face.eyesClosedShare < 0.3 ? "watch" : "review", note: "A drowsiness cue (similar in spirit to PERCLOS). Not a fatigue diagnosis." },
      { label: "Face visible in", value: pc(face.coverage), reference: "70% or more", level: face.coverage >= 0.7 ? "ok" : face.coverage >= 0.4 ? "watch" : "review", note: "Low coverage makes the expression results unreliable." },
    );
  }

  // ---- detailed per-measure statistics ---------------------------------------------------------------------------------
  const stat = (label: string, unit: string, f: (s: Sample) => number) => {
    const v = samples.map(f);
    return { label, unit, mean: v.reduce((a, b) => a + b, 0) / Math.max(1, v.length), min: Math.min(...v), max: Math.max(...v), sd: std(v) };
  };
  const details = samples.length > 1 ? [stat("Torso lean", "deg", (x) => x.lean), stat("Shoulder tilt", "deg", (x) => x.shoulderTilt), stat("Hip tilt", "deg", (x) => x.hipTilt), stat("Head tilt", "deg", (x) => x.headTilt), stat("Head shift", "shoulder widths", (x) => x.headShift), stat("Neck ratio", "ratio", (x) => x.neckRatio)] : undefined;
  const quality_notes: string[] = [];
  if (quality < 70) quality_notes.push(`Body landmarks were visible only ${quality}% of the time. Results are less reliable; stand fully in frame with good light.`);
  if (samples.length < 40 && seconds > 0) quality_notes.push("Fewer than 40 usable frames were captured, so averages and the breathing estimate are weak.");
  if (!face) quality_notes.push("No clear face view was captured, so no facial-expression cues are reported. Face the camera with your face lit.");
  if (seconds === 0) quality_notes.push("Single photo: no movement, sway or breathing information.");
  const comparison = prev ? [
    { label: "Posture score", prev: `${prev.postureScore}`, now: `${postureScore}`, change: `${postureScore - prev.postureScore >= 0 ? "+" : ""}${postureScore - prev.postureScore}` },
    { label: "Readiness index", prev: `${prev.readinessIndex}`, now: `${rd.index}`, change: `${rd.index - prev.readinessIndex >= 0 ? "+" : ""}${rd.index - prev.readinessIndex}` },
  ] : undefined;

  const bad = findings.filter((f) => f.level === "review").map((f) => f.label.toLowerCase());
  const mid = findings.filter((f) => f.level === "watch").map((f) => f.label.toLowerCase());
  const parts: string[] = [];
  parts.push(
    bad.length === 0 && mid.length === 0
      ? `Movement and posture screening is within the reference ranges (posture score ${postureScore}/100).`
      : `Posture screening shows ${[bad.length ? `findings outside range: ${bad.join(", ")}` : "", mid.length ? `borderline: ${mid.join(", ")}` : ""].filter(Boolean).join("; ")} (posture score ${postureScore}/100).`,
  );
  parts.push(`Overall logged status is ${STATUS_LABEL[o.status].toLowerCase()} with an AEGIS readiness index of ${rd.index}/100 (${rd.band}).`);
  parts.push(tension.text);
  if (face) parts.push(`Facial cues: mostly ${face.dominant}${face.blinkPerMin !== null ? `, about ${face.blinkPerMin.toFixed(0)} blinks per minute` : ""}. These describe visible facial movement only, not mood or health.`);
  if (flagged.length) parts.push(`Compared with your own baseline, ${flagged.length} logged signal${flagged.length > 1 ? "s are" : " is"} flagged.`);

  const recs: string[] = [];
  if (stressHigh) recs.push("Take a 5-minute 4-7-8 breathing break now, then log a new check-in. Tell a crew-mate how you have been feeling.");
  if (o.mental.avgSleep < 6.5) recs.push(`Protect your next sleep period. Average sleep is ${o.mental.avgSleep.toFixed(1)} h; dim lights beforehand and avoid hard exercise just before sleep.`);
  if (sT >= 3 || neck < 0.2 || lean >= 6) recs.push("Do a 5-minute shoulder roll and thoracic stretch routine, and re-check your workstation or restraint posture.");
  if (hT >= 3) recs.push("Stand evenly on both feet and re-scan. Persistent hip or shoulder asymmetry is worth mentioning to the crew medical officer.");
  if (o.msk.daysActive < 4) recs.push("Add a resistance or cardio session today to protect muscle and bone.");
  if (flagged.length) recs.push("Review the flagged signals on the AEGIS risk engine and discuss persistent changes with your medical officer.");
  if (face && (face.eyesClosedShare >= 0.15 || (face.blinkPerMin !== null && face.blinkPerMin < 8 && face.eyesClosedShare >= 0.1))) recs.push("Your eyes were often closed or slow-blinking during the scan, a possible tiredness cue. Check your recent sleep and consider a short rest before demanding tasks.");
  if (face && face.furrowShare >= 0.45) recs.push("Your brow was furrowed for much of the scan. Try a one-minute jaw and forehead relaxation, and note whether something is bothering you.");
  if (!recs.length) recs.push("Keep your daily check-in and exercise routine. Re-scan weekly to track posture over time.");

  const follow = [
    "Repeat this scan in 7 days under the same conditions (standing, full body in frame, good light).",
    "Contact the crew medical officer if you notice pain, dizziness, shortness of breath, or if flagged signals persist for more than 3 days.",
    "In an emergency, alert a crew-mate and use the mission emergency channel. This tool is not for emergencies.",
  ];

  return {
    id: "AEGIS-" + Math.random().toString(16).slice(2, 8).toUpperCase(),
    when: new Date(),
    seconds, frames: samples.length, quality, postureScore, findings, logged,
    readinessIndex: rd.index, readinessBand: rd.band, flagged,
    impression: parts.join(" "), recommendations: recs, followUp: follow, tension,
    face, faceFindings, details, comparison, quality_notes,
  };
}

export { buildAlerts };
