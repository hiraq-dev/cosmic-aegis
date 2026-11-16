// Facial-expression cues from MediaPipe face blendshapes (0..1 muscle-activation scores).
// These describe visible facial movement only. They are NOT a measure of emotion, mood, pain or illness.
export interface FaceSample { t: number; smile: number; browDown: number; browUp: number; jawOpen: number; blink: number; frown: number; squint: number }
export type ExprLabel = "neutral" | "smiling" | "tense" | "surprised" | "eyes closed";

export interface Cat { categoryName: string; score: number }
const g = (c: Cat[], n: string) => c.find((x) => x.categoryName === n)?.score ?? 0;
const avg = (c: Cat[], a: string, b: string) => (g(c, a) + g(c, b)) / 2;

export function faceSampleFrom(cats: Cat[], t: number): FaceSample {
  return {
    t, smile: avg(cats, "mouthSmileLeft", "mouthSmileRight"), browDown: avg(cats, "browDownLeft", "browDownRight"),
    browUp: Math.max(g(cats, "browInnerUp"), avg(cats, "browOuterUpLeft", "browOuterUpRight")), jawOpen: g(cats, "jawOpen"),
    blink: avg(cats, "eyeBlinkLeft", "eyeBlinkRight"), frown: avg(cats, "mouthFrownLeft", "mouthFrownRight"), squint: avg(cats, "eyeSquintLeft", "eyeSquintRight"),
  };
}

/** Rule-based label for one frame. Thresholds are heuristics, not validated. */
export function labelFor(s: FaceSample): ExprLabel {
  if (s.blink > 0.6) return "eyes closed";
  if (s.smile > 0.35) return "smiling";
  if (s.browUp > 0.4 && s.jawOpen > 0.25) return "surprised";
  if (s.browDown > 0.4 || s.frown > 0.3 || s.squint > 0.5) return "tense";
  return "neutral";
}

export interface FaceSummary {
  frames: number; coverage: number; seconds: number;
  dominant: ExprLabel; share: Record<ExprLabel, number>;
  smileMean: number; smilePeak: number; furrowMean: number; furrowShare: number; browRaiseMean: number;
  blinkCount: number; blinkPerMin: number | null; eyesClosedShare: number; expressiveness: number;
}

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sd = (a: number[]) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };

export function summarizeFace(samples: FaceSample[], totalFrames: number, seconds: number): FaceSummary | null {
  if (samples.length < 10) return null;
  const share: Record<ExprLabel, number> = { neutral: 0, smiling: 0, tense: 0, surprised: 0, "eyes closed": 0 };
  for (const s of samples) share[labelFor(s)]++;
  (Object.keys(share) as ExprLabel[]).forEach((k) => { share[k] = share[k] / samples.length; });
  const dominant = (Object.keys(share) as ExprLabel[]).reduce((a, b) => (share[a] >= share[b] ? a : b));
  // blink = rising edge through 0.5 with at least 150 ms between blinks
  let blinks = 0, lastT = -1, prev = 0;
  for (const s of samples) { if (prev <= 0.5 && s.blink > 0.5 && s.t - lastT > 0.15) { blinks++; lastT = s.t; } prev = s.blink; }
  const dur = Math.max(1e-6, samples[samples.length - 1].t - samples[0].t);
  return {
    frames: samples.length, coverage: Math.min(1, samples.length / Math.max(1, totalFrames)), seconds,
    dominant, share, smileMean: mean(samples.map((s) => s.smile)), smilePeak: Math.max(...samples.map((s) => s.smile)),
    furrowMean: mean(samples.map((s) => s.browDown)), furrowShare: samples.filter((s) => s.browDown > 0.35).length / samples.length,
    browRaiseMean: mean(samples.map((s) => s.browUp)), blinkCount: blinks, blinkPerMin: dur >= 8 ? (blinks / dur) * 60 : null,
    eyesClosedShare: samples.filter((s) => s.blink > 0.6).length / samples.length,
    expressiveness: sd(samples.map((s) => s.smile + s.browDown + s.browUp + s.jawOpen)),
  };
}
