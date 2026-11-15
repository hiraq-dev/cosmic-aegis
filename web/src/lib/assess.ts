// Rule-based assessments for the DEMO prototype.
// FUTURE INTEGRATION: ML Health Analysis - replace or augment these rules (see src/integrations).
// All thresholds below are ILLUSTRATIVE demonstration values. They are not NASA limits and not medical advice.
import type { Alert, AppData, ExerciseEntry, MoodEntry, Status, VitalEntry } from "./types";
import { addDays, daysBetween, today } from "./dates";

export const worst = (...s: Status[]): Status =>
  s.includes("review") ? "review" : s.includes("watch") ? "watch" : "nominal";

export const STATUS_LABEL: Record<Status, string> = {
  nominal: "Within demo range",
  watch: "Keep an eye on this",
  review: "Medical review suggested",
};

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const byDate = <T extends { date: string }>(xs: T[]): T[] => [...xs].sort((a, b) => a.date.localeCompare(b.date));

// ---------- Vitals ----------
export type VitalKey = "heartRate" | "bloodPressure" | "spo2" | "tempC" | "glucose";

export interface VitalAssessment {
  key: VitalKey;
  label: string;
  value: string;
  status: Status;
  note: string;
}

export function assessVital(v: VitalEntry): VitalAssessment[] {
  const out: VitalAssessment[] = [];
  const hr = v.heartRate;
  out.push({
    key: "heartRate",
    label: "Heart rate",
    value: `${hr} bpm`,
    status: hr < 40 || hr > 120 ? "review" : hr < 50 || hr > 100 ? "watch" : "nominal",
    note: "Resting rate. A sustained change from your own baseline matters more than one reading.",
  });
  const { systolic: s, diastolic: d } = v;
  out.push({
    key: "bloodPressure",
    label: "Blood pressure",
    value: `${s}/${d} mmHg`,
    status:
      s >= 160 || d >= 100 || s < 90 || d < 55
        ? "review"
        : s >= 130 || d >= 85
          ? "watch"
          : "nominal",
    note: "Fluid shifts and stress can move blood pressure in space. Repeat readings help.",
  });
  out.push({
    key: "spo2",
    label: "Oxygen saturation",
    value: `${v.spo2}%`,
    status: v.spo2 < 92 ? "review" : v.spo2 < 95 ? "watch" : "nominal",
    note: "Reflects how well oxygen is carried in the blood. Also check the cabin atmosphere.",
  });
  if (v.tempC !== undefined) {
    out.push({
      key: "tempC",
      label: "Body temperature",
      value: `${v.tempC.toFixed(1)} C`,
      status: v.tempC >= 38 || v.tempC < 35.5 ? "review" : v.tempC >= 37.6 || v.tempC < 36 ? "watch" : "nominal",
      note: "Fever can signal infection or immune changes.",
    });
  }
  if (v.glucose !== undefined) {
    out.push({
      key: "glucose",
      label: "Blood glucose",
      value: `${v.glucose} mg/dL`,
      status: v.glucose >= 200 || v.glucose < 60 ? "review" : v.glucose >= 140 || v.glucose < 70 ? "watch" : "nominal",
      note: "Diet, stress and activity all affect glucose. Log whether you had eaten.",
    });
  }
  return out;
}

export function vitalStatus(v: VitalEntry): Status {
  return worst(...assessVital(v).map((a) => a.status));
}

export function cardioSummary(vitals: VitalEntry[]) {
  const sorted = byDate(vitals);
  const latest = sorted[sorted.length - 1];
  const items = latest ? assessVital(latest) : [];
  const status = worst(...items.map((i) => i.status));
  const recent = sorted.slice(-7);
  const earlier = sorted.slice(-14, -7);
  const sysDelta = recent.length && earlier.length ? avg(recent.map((r) => r.systolic)) - avg(earlier.map((r) => r.systolic)) : 0;
  const hrDelta = recent.length && earlier.length ? avg(recent.map((r) => r.heartRate)) - avg(earlier.map((r) => r.heartRate)) : 0;
  const score = status === "nominal" ? 90 : status === "watch" ? 68 : 40;
  return { latest, items, status, sysDelta, hrDelta, score, sorted };
}

// ---------- Mental ----------
export const MOOD_LABEL = ["", "Exhausted", "Stressed", "Neutral", "Good", "Excellent"] as const;

export function wellbeingScore(m: MoodEntry): number {
  // DEMO formula: mood 40%, low stress 30%, sleep 20%, low fatigue 10%
  const mood = (m.mood - 1) / 4;
  const stress = (5 - m.stress) / 4;
  const sleep = Math.min(m.sleepHours / 8, 1);
  const fatigue = (5 - m.fatigue) / 4;
  return Math.round((mood * 0.4 + stress * 0.3 + sleep * 0.2 + fatigue * 0.1) * 100);
}

export function mentalSummary(moods: MoodEntry[]) {
  const sorted = byDate(moods);
  const latest = sorted[sorted.length - 1];
  const last5 = sorted.slice(-5);
  const highStress = last5.filter((m) => m.stress >= 4).length;
  const stressAlert = highStress >= 3;
  const last7 = sorted.slice(-7);
  const avgSleep = avg(last7.map((m) => m.sleepHours));
  const avgFatigue = avg(last7.map((m) => m.fatigue));
  const score = latest ? Math.round(avg(sorted.slice(-3).map(wellbeingScore))) : 0;
  const status: Status = stressAlert ? "review" : score < 60 || avgSleep < 6.5 ? "watch" : "nominal";
  return { sorted, latest, highStress, stressAlert, avgSleep, avgFatigue, score, status };
}

export function mentalRecommendations(m: MoodEntry): string[] {
  const out: string[] = [];
  if (m.stress >= 4) out.push("Take a short guided breathing or stretching break, then re-check how you feel.");
  if (m.sleepHours < 6.5) out.push("Sleep was short. Protect your next sleep period and dim lights beforehand.");
  if (m.mood <= 2) out.push("Reach out to a crew-mate or schedule a private call with family or a support clinician.");
  if (m.fatigue >= 4) out.push("High fatigue: lighten non-essential tasks today if the schedule allows.");
  if (!out.length) out.push("Nice work. Keep your routine: sleep, exercise, and a moment of connection each day.");
  return out;
}

// ---------- Musculoskeletal ----------
export function mskSummary(exercise: ExerciseEntry[]) {
  const sorted = byDate(exercise);
  const end = today();
  const from7 = addDays(end, -6);
  const last7 = sorted.filter((e) => e.date >= from7);
  const daysActive = new Set(last7.map((e) => e.date)).size;
  const minutes7 = last7.reduce((a, e) => a + e.minutes, 0);
  const consistency = Math.round((daysActive / 7) * 100);

  const strength = sorted.filter((e) => e.strengthKg > 0);
  const recentS = strength.slice(-3);
  const baseS = strength.slice(0, 3);
  const strengthTrend =
    recentS.length && baseS.length ? ((avg(recentS.map((e) => e.strengthKg)) - avg(baseS.map((e) => e.strengthKg))) / avg(baseS.map((e) => e.strengthKg))) * 100 : 0;

  const muscleStatus: Status = strengthTrend <= -15 || consistency < 30 ? "review" : strengthTrend <= -5 || consistency < 55 ? "watch" : "nominal";
  // DEMO ONLY: bone status here is derived from activity consistency, not from any bone measurement.
  const boneStatus: Status = consistency < 30 ? "review" : consistency < 55 ? "watch" : "nominal";
  const status = worst(muscleStatus, boneStatus);
  const score = Math.max(0, Math.min(100, Math.round(consistency * 0.6 + (100 + Math.min(0, strengthTrend) * 3) * 0.4)));
  return { sorted, last7, daysActive, minutes7, consistency, strengthTrend, muscleStatus, boneStatus, status, score };
}

// ---------- Alerts and overall ----------
export function buildAlerts(data: AppData): Alert[] {
  const alerts: Alert[] = [];
  const mental = mentalSummary(data.moods);
  const msk = mskSummary(data.exercise);
  const cardio = cardioSummary(data.vitals);

  if (mental.stressAlert)
    alerts.push({
      id: "a-stress",
      level: "review",
      module: "mental",
      title: "Repeated high stress",
      detail: `${mental.highStress} of your last 5 check-ins reported high stress. Consider a conversation with the crew medical officer or a support clinician.`,
    });
  else if (mental.avgSleep < 6.5)
    alerts.push({ id: "a-sleep", level: "watch", module: "mental", title: "Short sleep this week", detail: `Average ${mental.avgSleep.toFixed(1)} h over the last 7 entries.` });

  if (msk.muscleStatus !== "nominal")
    alerts.push({
      id: "a-msk",
      level: msk.muscleStatus,
      module: "musculoskeletal",
      title: "Possible strength decline (demo)",
      detail: `Strength is ${msk.strengthTrend.toFixed(0)}% versus your earlier sessions and you exercised on ${msk.daysActive} of the last 7 days.`,
      simulated: true,
    });

  cardio.items
    .filter((i) => i.status !== "nominal")
    .forEach((i) =>
      alerts.push({
        id: `a-${i.key}`,
        level: i.status,
        module: "cardiovascular",
        title: `${i.label}: ${i.value}`,
        detail: i.status === "review" ? "Outside the demo range. Recheck and consider medical review." : "Slightly outside the demo range. Recheck later today.",
      }),
    );

  alerts.push({
    id: "a-sample-radiation",
    level: "nominal",
    module: "system",
    title: "Sample notification: radiation dose within demo range",
    detail: "Simulated sensor value. No real radiation instrument is connected.",
    simulated: true,
  });
  return alerts.sort((a, b) => ["review", "watch", "nominal"].indexOf(a.level) - ["review", "watch", "nominal"].indexOf(b.level));
}

export function overall(data: AppData) {
  const m = mentalSummary(data.moods);
  const s = mskSummary(data.exercise);
  const c = cardioSummary(data.vitals);
  return {
    status: worst(m.status, s.status, c.status),
    score: Math.round(avg([m.score, s.score, c.score])),
    mental: m,
    msk: s,
    cardio: c,
  };
}

// ---------- Simulated mission + environment (clearly labelled DEMO in the UI) ----------
export function missionStatus(data: AppData) {
  const day = Math.max(1, daysBetween(data.profile.missionStart, today()) + 1);
  const len = data.profile.missionLengthDays;
  const progress = Math.min(100, Math.round((day / len) * 100));
  const distanceMkm = Math.round((20 + 160 * Math.sin((Math.PI * Math.min(day, len)) / len)) * 10) / 10; // simulated
  const oneWayMin = Math.round(((distanceMkm * 1_000_000) / 299_792.458 / 60) * 10) / 10;
  return { day, len, progress, distanceMkm, oneWayMin };
}

export function simulatedEnvironment(dateISO: string) {
  const n = dateISO.split("-").reduce((a, b) => a + Number(b), 0);
  const wobble = (k: number) => ((Math.sin(n * k) + 1) / 2);
  return {
    co2Ppm: Math.round(2800 + wobble(1.7) * 700), // simulated
    tempC: Math.round((22 + wobble(2.3) * 1.6) * 10) / 10, // simulated
    radiationMsvDay: Math.round((0.45 + wobble(3.1) * 0.2) * 100) / 100, // simulated
  };
}
