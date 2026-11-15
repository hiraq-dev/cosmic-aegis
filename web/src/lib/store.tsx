import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppData, ExerciseEntry, MoodEntry, Profile, VitalEntry } from "./types";
import { createSeedData } from "./seed";
import { makeId } from "./dates";

const KEY = "cosmic-aegis-demo-v1";

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.version === 1 && Array.isArray(parsed.moods)) return parsed;
    }
  } catch {
    /* storage unavailable or corrupted: fall back to seed data */
  }
  return createSeedData();
}

interface Store {
  data: AppData;
  addMood: (e: Omit<MoodEntry, "id">) => void;
  addVital: (e: Omit<VitalEntry, "id">) => void;
  addExercise: (e: Omit<ExerciseEntry, "id">) => void;
  updateProfile: (p: Partial<Profile>) => void;
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore: the demo still works without persistence */
    }
  }, [data]);

  // One check-in per day for mood and vitals: a new submission replaces that day's entry.
  const addMood = useCallback(
    (e: Omit<MoodEntry, "id">) => setData((d) => ({ ...d, moods: [...d.moods.filter((m) => m.date !== e.date), { ...e, id: makeId() }] })),
    [],
  );
  const addVital = useCallback(
    (e: Omit<VitalEntry, "id">) => setData((d) => ({ ...d, vitals: [...d.vitals.filter((v) => v.date !== e.date), { ...e, id: makeId() }] })),
    [],
  );
  const addExercise = useCallback((e: Omit<ExerciseEntry, "id">) => setData((d) => ({ ...d, exercise: [...d.exercise, { ...e, id: makeId() }] })), []);
  const updateProfile = useCallback((p: Partial<Profile>) => setData((d) => ({ ...d, profile: { ...d.profile, ...p } })), []);
  const resetDemo = useCallback(() => setData(createSeedData()), []);

  const value = useMemo(() => ({ data, addMood, addVital, addExercise, updateProfile, resetDemo }), [data, addMood, addVital, addExercise, updateProfile, resetDemo]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
