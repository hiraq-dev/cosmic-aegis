import type { AppData, ExerciseEntry, MoodEntry, VitalEntry } from "./types";
import { shortDate } from "./dates";
import { wellbeingScore } from "./assess";

const last = <T,>(xs: T[], n: number): T[] => xs.slice(-n);
const sortBy = <T extends { date: string }>(xs: T[]): T[] => [...xs].sort((a, b) => a.date.localeCompare(b.date));

export const moodRows = (moods: MoodEntry[], n = 14) =>
  last(sortBy(moods), n).map((m) => ({ label: shortDate(m.date), mood: m.mood, stress: m.stress, sleep: m.sleepHours, wellbeing: wellbeingScore(m) }));

export const vitalRows = (vitals: VitalEntry[], n = 14) =>
  last(sortBy(vitals), n).map((v) => ({ label: shortDate(v.date), hr: v.heartRate, sys: v.systolic, dia: v.diastolic, spo2: v.spo2 }));

export const exerciseRows = (exercise: ExerciseEntry[], n = 14) => {
  const byDay = new Map<string, { minutes: number; strength?: number }>();
  sortBy(exercise).forEach((e) => {
    const cur = byDay.get(e.date) ?? { minutes: 0 };
    cur.minutes += e.minutes;
    if (e.strengthKg > 0) cur.strength = Math.max(cur.strength ?? 0, e.strengthKg);
    byDay.set(e.date, cur);
  });
  return last([...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])), n).map(([d, v]) => ({ label: shortDate(d), minutes: v.minutes, strength: v.strength }));
};

export interface ActivityItem {
  id: string;
  date: string;
  text: string;
}

export function recentActivity(data: AppData, n = 8): ActivityItem[] {
  const items: ActivityItem[] = [
    ...data.moods.map((m) => ({ id: m.id, date: m.date, text: `Mood check-in: ${["", "Exhausted", "Stressed", "Neutral", "Good", "Excellent"][m.mood]}, stress ${m.stress}/5, sleep ${m.sleepHours} h` })),
    ...data.vitals.map((v) => ({ id: v.id, date: v.date, text: `Vitals: HR ${v.heartRate}, BP ${v.systolic}/${v.diastolic}, SpO2 ${v.spo2}%` })),
    ...data.exercise.map((e) => ({ id: e.id, date: e.date, text: `Exercise: ${e.kind}, ${e.minutes} min${e.strengthKg ? `, peak ${e.strengthKg} kg` : ""}` })),
  ];
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
}
