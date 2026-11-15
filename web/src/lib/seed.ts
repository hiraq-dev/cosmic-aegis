// DEMO DATA ONLY. Everything generated here is fictional sample data for the prototype.
import type { AppData, ExerciseEntry, MoodEntry, VitalEntry } from "./types";
import { addDays, today } from "./dates";

// Small deterministic PRNG so the demo story is stable.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FAMILY_HISTORY_OPTIONS = [
  "High blood pressure",
  "Heart disease",
  "Type 2 diabetes",
  "Osteoporosis / bone fractures",
  "Anxiety or depression",
] as const;

export function createSeedData(): AppData {
  const rnd = mulberry32(2026);
  const end = today();
  const moods: MoodEntry[] = [];
  const vitals: VitalEntry[] = [];
  const exercise: ExerciseEntry[] = [];
  const DAYS = 14;

  for (let i = DAYS; i >= 1; i--) {
    const date = addDays(end, -i);
    const late = i <= 4; // story: stress and blood pressure creep up in the last few days
    const stress = Math.min(5, Math.max(1, Math.round((late ? 4 : 2.3) + (rnd() - 0.5) * 1.4))) as 1;
    const mood = Math.min(5, Math.max(1, Math.round((late ? 2.6 : 3.8) + (rnd() - 0.5) * 1.2))) as 1;
    moods.push({
      id: `m${i}`,
      date,
      mood,
      stress,
      sleepHours: Math.round((late ? 5.6 : 7 + (rnd() - 0.5)) * 10) / 10,
      fatigue: Math.min(5, Math.max(1, Math.round((late ? 3.8 : 2.4) + (rnd() - 0.5)))) as 1,
    });

    vitals.push({
      id: `v${i}`,
      date,
      heartRate: Math.round(66 + (late ? 8 : 0) + rnd() * 6),
      systolic: Math.round(118 + (late ? 12 : 0) + rnd() * 6),
      diastolic: Math.round(76 + (late ? 8 : 0) + rnd() * 4),
      spo2: Math.round(97 + rnd() * 2),
      tempC: Math.round((36.6 + rnd() * 0.4) * 10) / 10,
      glucose: Math.round(92 + rnd() * 12),
    });

    // exercise on most days; strength dips slightly in the second half
    if (i % 7 !== 0 && i % 5 !== 0) {
      const kinds = ["Resistive (ARED-style)", "Treadmill", "Cycle ergometer"] as const;
      exercise.push({
        id: `e${i}`,
        date,
        kind: kinds[i % 3],
        minutes: Math.round(45 + rnd() * 20),
        strengthKg: Math.round(80 - (i <= 7 ? 5 : 0) + rnd() * 3), // recent sessions slightly lower
      });
    }
  }

  return {
    version: 1,
    profile: {
      name: "Demo Crew Member",
      role: "Flight Engineer (fictional)",
      age: 41,
      missionName: "DEMO-TRANSIT-01 (fictional)",
      missionStart: addDays(end, -214),
      missionLengthDays: 520,
      familyHistory: { "High blood pressure": true },
      concerns: "Sleep has been shorter than usual and I feel more tense this week.",
    },
    moods,
    vitals,
    exercise,
  };
}
