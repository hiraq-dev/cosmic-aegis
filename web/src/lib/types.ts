export type Status = "nominal" | "watch" | "review";

export interface MoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: 1 | 2 | 3 | 4 | 5; // 1 exhausted ... 5 excellent
  stress: 1 | 2 | 3 | 4 | 5; // 1 low ... 5 very high
  sleepHours: number;
  fatigue: 1 | 2 | 3 | 4 | 5; // 1 rested ... 5 exhausted
  note?: string;
}

export interface VitalEntry {
  id: string;
  date: string;
  heartRate: number; // bpm
  systolic: number; // mmHg
  diastolic: number; // mmHg
  spo2: number; // %
  tempC?: number;
  glucose?: number; // mg/dL
}

export type ExerciseKind = "Resistive (ARED-style)" | "Treadmill" | "Cycle ergometer";

export interface ExerciseEntry {
  id: string;
  date: string;
  kind: ExerciseKind;
  minutes: number;
  strengthKg: number; // peak load lifted (demonstration metric)
}

export interface Profile {
  name: string;
  role: string;
  age: number;
  missionName: string;
  missionStart: string; // YYYY-MM-DD
  missionLengthDays: number;
  familyHistory: Record<string, boolean>;
  concerns: string;
}

export interface AppData {
  version: number;
  profile: Profile;
  moods: MoodEntry[];
  vitals: VitalEntry[];
  exercise: ExerciseEntry[];
}

export interface Alert {
  id: string;
  level: Status;
  module: "mental" | "musculoskeletal" | "cardiovascular" | "system";
  title: string;
  detail: string;
  simulated?: boolean;
}
