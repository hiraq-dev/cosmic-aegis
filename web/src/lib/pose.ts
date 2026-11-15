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
