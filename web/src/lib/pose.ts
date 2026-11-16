export interface LM { x: number; y: number; z?: number; visibility?: number }
export const MIN_VIS = 0.6;
const ok = (p?: LM) => !!p && (p.visibility ?? 0) >= MIN_VIS;

/** Interior angle at b (degrees) from three landmarks; null if any is occluded or low-confidence. */
export function jointAngle(a?: LM, b?: LM, c?: LM): number | null {
  if (!ok(a) || !ok(b) || !ok(c)) return null;
  const v1 = [a!.x - b!.x, a!.y - b!.y], v2 = [c!.x - b!.x, c!.y - b!.y];
  const m = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
  if (m < 1e-9) return null;
  return (Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / m))) * 180) / Math.PI;
}
/** Mean visibility of the landmarks needed for the current activity; below 0.6 the frame is not used. */
export const trackingConfidence = (lm: LM[], idx: number[]) => idx.reduce((s, i) => s + (lm[i]?.visibility ?? 0), 0) / idx.length;

export type Calibration = { standingKnee: number } | null;
// MediaPipe indices: hips 23/24, knees 25/26, ankles 27/28
export function kneeAngle(lm: LM[]): number | null {
  const l = jointAngle(lm[23], lm[25], lm[27]), r = jointAngle(lm[24], lm[26], lm[28]);
  if (l != null && r != null) return (l + r) / 2;
  return l ?? r;
}

/** Bodyweight squat counter with hysteresis. Needs a side/front full-body view; camera orientation changes angles. */
export class SquatCounter {
  reps = 0; private down = false; minAngle = 180; private lowFrames = 0; skipped = 0; used = 0; depths: number[] = [];
  constructor(public downBelow = 110, public upAbove = 160) {}
  calibrate(standing: number) { this.upAbove = Math.max(150, standing - 15); this.downBelow = Math.max(80, standing - 60); }
  push(angle: number | null) {
    if (angle == null) { this.skipped++; return; }
    this.used++;
    this.minAngle = Math.min(this.minAngle, angle);
    if (!this.down && angle < this.downBelow) { if (++this.lowFrames >= 3) { this.down = true; } }
    else if (this.down && angle > this.upAbove) { this.down = false; this.lowFrames = 0; this.reps++; this.depths.push(Math.round(this.minAngle)); this.minAngle = 180; }
    else if (!this.down && angle >= this.downBelow) this.lowFrames = 0;
  }
  summary(seconds: number) {
    const total = this.used + this.skipped;
    return { activity: "bodyweight squat", reps: this.reps, seconds: Math.round(seconds), depths_deg: this.depths, frames_used: this.used, frames_skipped_low_confidence: this.skipped,
      usable_fraction: total ? +(this.used / total).toFixed(2) : 0, note: "Camera-derived knee angles in image space. Not a clinical measurement; depends on camera angle and framing. Not a measure of bone or muscle." };
  }
}

/** Landmarks -> avatar limb coordinates (units ~ avatar metres; x mirrored). Missing/occluded points return null so the avatar keeps its neutral pose. */
export function toAvatar(lm: LM[]) {
  const pt = (i: number): [number, number] | undefined => (ok(lm[i]) ? [(lm[i].x - 0.5) * -1.6, (0.5 - lm[i].y) * 1.6 + 0.3] : undefined);
  const p = { lsh: pt(11), rsh: pt(12), lel: pt(13), rel: pt(14), lwr: pt(15), rwr: pt(16) };
  return Object.values(p).every(Boolean) ? (p as Record<string, [number, number]>) : null;
}

export type Pt3 = [number, number, number];
export type Skeleton = (Pt3 | null)[] | null;
/** 33 MediaPipe landmarks -> 3D points (x mirrored so the avatar moves like a mirror). Occluded points are null. */
export function toSkeleton(lm: LM[]): Skeleton {
  const out = lm.map((p) => (ok(p) ? ([(0.5 - p.x) * 1.8, (0.5 - p.y) * 1.8 + 0.2, -(p.z ?? 0) * 1.2] as Pt3) : null));
  return out.filter(Boolean).length >= 8 ? out : null;
}
// [from, to, group]
export const BONES: [number, number, string][] = [
  [11, 12, "torso"], [11, 23, "torso"], [12, 24, "torso"], [23, 24, "torso"],
  [11, 13, "larm"], [13, 15, "larm"], [12, 14, "rarm"], [14, 16, "rarm"],
  [23, 25, "lleg"], [25, 27, "lleg"], [24, 26, "rleg"], [26, 28, "rleg"],
  [0, 11, "head"], [0, 12, "head"],
];
const R: Record<number, Pt3> = { 0: [0, 0.85, 0], 11: [-0.28, 0.55, 0], 12: [0.28, 0.55, 0], 13: [-0.4, 0.2, 0], 14: [0.4, 0.2, 0], 15: [-0.45, -0.15, 0], 16: [0.45, -0.15, 0], 23: [-0.15, -0.15, 0], 24: [0.15, -0.15, 0], 25: [-0.17, -0.6, 0], 26: [0.17, -0.6, 0], 27: [-0.18, -0.95, 0], 28: [0.18, -0.95, 0] };
/** Neutral reference posture shown when no camera data is flowing. */
export const REFERENCE: (Pt3 | null)[] = Array.from({ length: 33 }, (_, i) => R[i] ?? null);

// ---- exercise repetition counting ---------------------------------------------------------------------------------------
export type Exercise = "squat" | "armraise" | "jack";
export const EXERCISES: Record<Exercise, { label: string; hint: string }> = {
  squat: { label: "Squats", hint: "Face or stand side-on, full legs in view. A rep counts when your knees bend below ~110° and you stand back up." },
  armraise: { label: "Overhead arm raises", hint: "Face the camera. A rep counts when both wrists go above your shoulders and come back down." },
  jack: { label: "Jumping jacks", hint: "Face the camera with your whole body in view. A rep counts when arms go up with feet apart, then return." },
};
/** Hysteresis counter on a scalar signal: goes "high" above `high`, a rep is counted when it returns below `low`. */
export class SignalCounter {
  reps = 0; private high = false; used = 0; skipped = 0; private peak = -Infinity; peaks: number[] = []; stamps: number[] = [];
  constructor(public high_ = 0.25, public low_ = -0.05) {}
  push(v: number | null, t = 0) {
    if (v == null) { this.skipped++; return; }
    this.used++; this.peak = Math.max(this.peak, v);
    if (!this.high && v > this.high_) this.high = true;
    else if (this.high && v < this.low_) { this.high = false; this.reps++; this.peaks.push(+this.peak.toFixed(2)); this.peak = -Infinity; this.stamps.push(t); }
  }
}
const vis = (lm: LM[], idx: number[]) => idx.every((i) => ok(lm[i]));
/** Wrist height above shoulder line, in torso lengths. Positive when the wrists are raised. */
export function armSignal(lm: LM[]): number | null {
  if (!vis(lm, [11, 12, 15, 16, 23, 24])) return null;
  const sy = (lm[11].y + lm[12].y) / 2, hy = (lm[23].y + lm[24].y) / 2, wy = (lm[15].y + lm[16].y) / 2, torso = Math.max(1e-6, hy - sy);
  return (sy - wy) / torso;
}
/** Jumping-jack signal: arms up AND feet wider than shoulders -> high; both near rest -> low. */
export function jackSignal(lm: LM[]): number | null {
  const a = armSignal(lm); if (a == null || !vis(lm, [27, 28])) return null;
  const sw = Math.max(1e-6, Math.abs(lm[11].x - lm[12].x)), spread = Math.abs(lm[27].x - lm[28].x) / sw;
  return Math.min(a, (spread - 1.2) * 1.2);
}
export function exerciseSignal(ex: Exercise, lm: LM[]): number | null {
  if (ex === "armraise") return armSignal(lm);
  if (ex === "jack") return jackSignal(lm);
  const k = kneeAngle(lm); return k == null ? null : (170 - k) / 60;   // 170 deg standing -> 0, 110 deg -> 1
}
export const counterFor = (ex: Exercise) => (ex === "squat" ? new SignalCounter(0.9, 0.2) : ex === "armraise" ? new SignalCounter(0.25, -0.05) : new SignalCounter(0.2, -0.1));
