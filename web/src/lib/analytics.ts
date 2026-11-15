// AEGIS analytics engine: transparent statistical algorithms that run in the browser on the user's own entries.
// EWMA smoothing, ordinary least-squares trend, personal-baseline z-score anomaly detection, short-horizon forecast
// and a logistic readiness fusion. Awareness only: this is not a clinical model and does not diagnose or predict disease.
import type { AppData } from "./types";

export interface SeriesPoint { x: number; y: number; date: string }

export interface SeriesStats {
  key: string;
  label: string;
  unit: string;
  goodHigh: boolean; // true if higher is healthier
  n: number;
  latest: number;
  baselineMean: number;
  baselineSd: number;
  z: number; // latest vs personal baseline
  ewma: number;
  slopePerDay: number;
  r2: number;
  forecast: number[]; // next 7 days
  anomaly: boolean;
  worsening: boolean;
  points: { date: string; value: number; ewma: number }[];
}

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

export function ewmaSeries(v: number[], alpha = 0.4): number[] {
  const out: number[] = [];
  v.forEach((y, i) => out.push(i === 0 ? y : alpha * y + (1 - alpha) * out[i - 1]));
  return out;
}

// Ordinary least squares y = a + b x, with R^2.
export function ols(ys: number[]): { a: number; b: number; r2: number } {
  const n = ys.length;
  if (n < 2) return { a: ys[0] ?? 0, b: 0, r2: 0 };
  const xs = ys.map((_, i) => i);
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const b = sxx ? sxy / sxx : 0;
  const a = my - b * mx;
  return { a, b, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0 };
}

const SD_FLOOR: Record<string, number> = { stress: 0.6, sleep: 0.6, fatigue: 0.6, hr: 3, sys: 4, spo2: 0.7, strength: 3 };
const Z_CLAMP = 4;

function analyse(key: string, label: string, unit: string, goodHigh: boolean, rows: { date: string; v: number }[]): SeriesStats | null {
  if (rows.length < 4) return null;
  const vals = rows.map((r) => r.v);
  const split = Math.max(3, Math.floor(vals.length * 0.6));
  const base = vals.slice(0, split); // earlier days form the personal baseline
  const bMean = mean(base);
  const bSd = Math.max(sd(base), SD_FLOOR[key] ?? 0.5); // floor avoids absurd z-scores when the baseline is very steady
  const latest = vals[vals.length - 1];
  const z = Math.max(-Z_CLAMP, Math.min(Z_CLAMP, (latest - bMean) / bSd));
  const smooth = ewmaSeries(vals);
  const recent = vals.slice(-10);
  const fit = ols(recent);
  const forecast = Array.from({ length: 7 }, (_, i) => fit.a + fit.b * (recent.length + i));
  const dirBad = goodHigh ? z < 0 : z > 0;
  const trendBad = goodHigh ? fit.b < 0 : fit.b > 0;
  return {
    key, label, unit, goodHigh, n: vals.length, latest, baselineMean: bMean, baselineSd: bSd, z,
    ewma: smooth[smooth.length - 1], slopePerDay: fit.b, r2: fit.r2, forecast,
    anomaly: Math.abs(z) >= 2 && dirBad,
    worsening: trendBad && fit.r2 > 0.3 && Math.abs(fit.b) > bSd * 0.08,
    points: rows.map((r, i) => ({ date: r.date, value: r.v, ewma: smooth[i] })),
  };
}

const byDate = <T extends { date: string }>(a: T[]) => [...a].sort((x, y) => x.date.localeCompare(y.date));

export function buildSeries(data: AppData): SeriesStats[] {
  const m = byDate(data.moods), v = byDate(data.vitals), e = byDate(data.exercise);
  const list = [
    analyse("stress", "Stress", "/5", false, m.map((x) => ({ date: x.date, v: x.stress }))),
    analyse("sleep", "Sleep", "h", true, m.map((x) => ({ date: x.date, v: x.sleepHours }))),
    analyse("fatigue", "Fatigue", "/5", false, m.map((x) => ({ date: x.date, v: x.fatigue }))),
    analyse("hr", "Heart rate", "bpm", false, v.map((x) => ({ date: x.date, v: x.heartRate }))),
    analyse("sys", "Systolic BP", "mmHg", false, v.map((x) => ({ date: x.date, v: x.systolic }))),
    analyse("spo2", "SpO2", "%", true, v.map((x) => ({ date: x.date, v: x.spo2 }))),
    analyse("strength", "Strength load", "kg", true, e.map((x) => ({ date: x.date, v: x.strengthKg }))),
  ];
  return list.filter((s): s is SeriesStats => s !== null);
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export interface Readiness {
  index: number; // 0-100, higher = better
  band: "high" | "moderate" | "low";
  contributions: { label: string; weight: number; effect: number }[]; // effect: negative hurts readiness (points)
}

// Logistic fusion of standardised signals into one explainable readiness index.
export function readiness(series: SeriesStats[]): Readiness {
  const W: Record<string, number> = { stress: 0.9, sleep: 0.9, fatigue: 0.7, hr: 0.5, sys: 0.5, spo2: 0.6, strength: 0.5 };
  const wSum = series.reduce((t, x) => t + (W[x.key] ?? 0.4), 0) || 1;
  const terms = series.map((x) => {
    const w = W[x.key] ?? 0.4;
    const signed = x.goodHigh ? x.z : -x.z; // positive = healthier than own baseline
    const trend = (x.goodHigh ? 1 : -1) * (x.slopePerDay / x.baselineSd) * Math.min(1, x.r2 + 0.2) * 3;
    return { x, w, t: Math.max(-3, Math.min(3, signed * 0.6 + trend * 0.4)) };
  });
  const logit = 0.6 + (0.9 * terms.reduce((t, o) => t + o.w * o.t, 0)) / wSum;
  const contributions: Readiness["contributions"] = terms.map((o) => {
    const part = (0.9 * o.w * o.t) / wSum;
    return { label: o.x.label, weight: o.w, effect: Math.round((sigmoid(logit) - sigmoid(logit - part)) * 100) };
  });
  const index = Math.round(sigmoid(logit) * 100);
  return { index, band: index >= 70 ? "high" : index >= 45 ? "moderate" : "low", contributions: contributions.sort((a, b) => a.effect - b.effect) };
}

export function explain(s: SeriesStats): string {
  const dir = s.slopePerDay > 0 ? "rising" : "falling";
  const bits = [`${s.label} is ${s.latest.toFixed(1)}${s.unit} (your baseline ${s.baselineMean.toFixed(1)}, ${s.z >= 0 ? "+" : ""}${s.z.toFixed(1)} SD).`];
  if (Math.abs(s.slopePerDay) > s.baselineSd * 0.05) bits.push(`Trend ${dir} about ${Math.abs(s.slopePerDay).toFixed(2)} per day (fit R2 ${s.r2.toFixed(2)}).`);
  bits.push(`7-day projection: ${s.forecast[6].toFixed(1)}${s.unit}.`);
  return bits.join(" ");
}
