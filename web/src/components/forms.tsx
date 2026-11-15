import { useState, type FormEvent } from "react";
import { Dumbbell, HeartPulse, Send, Smile } from "lucide-react";
import { useStore } from "../lib/store";
import { today } from "../lib/dates";
import { assessVital, mentalRecommendations, MOOD_LABEL, wellbeingScore } from "../lib/assess";
import type { ExerciseKind, MoodEntry, VitalEntry } from "../lib/types";
import { btnPrimary, Field, inputCls, ResultBox } from "./ui";
import { worst } from "../lib/assess";

// ---------- Mood check-in ----------
export function MoodCheckIn({ compact = false }: { compact?: boolean }) {
  const { addMood } = useStore();
  const [mood, setMood] = useState<MoodEntry["mood"] | null>(null);
  const [stress, setStress] = useState<MoodEntry["stress"]>(3);
  const [fatigue, setFatigue] = useState<MoodEntry["fatigue"]>(3);
  const [sleep, setSleep] = useState("7");
  const [error, setError] = useState("");
  const [result, setResult] = useState<MoodEntry | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const s = Number(sleep);
    if (mood === null) return setError("Choose how you are feeling today.");
    if (!Number.isFinite(s) || s < 0 || s > 16) return setError("Sleep hours must be between 0 and 16.");
    setError("");
    const entry = { date: today(), mood, stress, fatigue, sleepHours: s };
    addMood(entry);
    setResult({ ...entry, id: "new" });
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Daily mood check-in">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-200">How are you feeling today?</legend>
        <div className="grid grid-cols-5 gap-2">
          {([5, 4, 3, 2, 1] as const).map((v) => (
            <label key={v} className={`cursor-pointer rounded-lg border px-1 py-2 text-center text-xs font-medium transition ${mood === v ? "border-aegis-cyan bg-aegis-cyan/20 text-white" : "border-white/15 text-slate-300 hover:bg-white/5"}`}>
              <input type="radio" name="mood" value={v} checked={mood === v} onChange={() => setMood(v)} className="sr-only" />
              {MOOD_LABEL[v]}
            </label>
          ))}
        </div>
      </fieldset>
      {!compact && (
        <>
          <Field label={`Stress level: ${stress} of 5`} htmlFor="stress" hint="1 = calm, 5 = very high">
            <input id="stress" type="range" min={1} max={5} value={stress} onChange={(e) => setStress(Number(e.target.value) as 1)} className="w-full accent-cyan-400" />
          </Field>
          <Field label={`Fatigue: ${fatigue} of 5`} htmlFor="fatigue" hint="1 = rested, 5 = exhausted">
            <input id="fatigue" type="range" min={1} max={5} value={fatigue} onChange={(e) => setFatigue(Number(e.target.value) as 1)} className="w-full accent-cyan-400" />
          </Field>
        </>
      )}
      <Field label="Hours slept last night" htmlFor="sleep" error={error && error.includes("Sleep") ? error : undefined}>
        <input id="sleep" inputMode="decimal" className={inputCls} value={sleep} onChange={(e) => setSleep(e.target.value)} />
      </Field>
      {error && !error.includes("Sleep") && (
        <p role="alert" className="text-xs text-review">
          {error}
        </p>
      )}
      <button type="submit" className={btnPrimary}>
        <Smile size={16} aria-hidden="true" /> Submit check-in
      </button>
      {result && (
        <ResultBox title={`Wellbeing score (demo): ${wellbeingScore(result)} / 100`} status={result.stress >= 4 || wellbeingScore(result) < 50 ? "watch" : "nominal"}>
          {mentalRecommendations(result).map((r) => (
            <p key={r}>- {r}</p>
          ))}
        </ResultBox>
      )}
    </form>
  );
}

// ---------- Vitals ----------
const RANGES = {
  heartRate: [30, 220, "Heart rate (bpm)"],
  systolic: [60, 250, "Systolic (mmHg)"],
  diastolic: [30, 150, "Diastolic (mmHg)"],
  spo2: [70, 100, "SpO2 (%)"],
  tempC: [34, 42, "Body temperature (C), optional"],
  glucose: [40, 400, "Blood glucose (mg/dL), optional"],
} as const;
type VKey = keyof typeof RANGES;

export function VitalsForm() {
  const { addVital } = useStore();
  const [vals, setVals] = useState<Record<VKey, string>>({ heartRate: "", systolic: "", diastolic: "", spo2: "", tempC: "", glucose: "" });
  const [errors, setErrors] = useState<Partial<Record<VKey, string>>>({});
  const [saved, setSaved] = useState<VitalEntry | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<VKey, string>> = {};
    const num: Partial<Record<VKey, number>> = {};
    (Object.keys(RANGES) as VKey[]).forEach((k) => {
      const [lo, hi] = RANGES[k];
      const raw = vals[k].trim();
      const optional = k === "tempC" || k === "glucose";
      if (!raw) {
        if (!optional) errs[k] = "Required.";
        return;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < lo || n > hi) errs[k] = `Enter a value between ${lo} and ${hi}.`;
      else num[k] = n;
    });
    if (!errs.systolic && !errs.diastolic && num.systolic! <= num.diastolic!) errs.systolic = "Systolic should be higher than diastolic.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const entry = { date: today(), heartRate: num.heartRate!, systolic: num.systolic!, diastolic: num.diastolic!, spo2: num.spo2!, tempC: num.tempC, glucose: num.glucose };
    addVital(entry);
    setSaved({ ...entry, id: "new" });
  };

  const assessed = saved ? assessVital(saved) : [];
  const status = worst(...assessed.map((a) => a.status));

  return (
    <form onSubmit={submit} noValidate className="space-y-3" aria-label="Daily vital signs entry">
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(RANGES) as VKey[]).map((k) => (
          <Field key={k} label={RANGES[k][2]} htmlFor={`v-${k}`} error={errors[k]}>
            <input id={`v-${k}`} inputMode="decimal" className={inputCls} value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} aria-invalid={!!errors[k]} />
          </Field>
        ))}
      </div>
      <button type="submit" className={btnPrimary}>
        <HeartPulse size={16} aria-hidden="true" /> Save readings
      </button>
      {saved && (
        <ResultBox title="Readings saved. Review:" status={status}>
          {assessed.map((a) => (
            <p key={a.key}>
              <strong>{a.label}:</strong> {a.value} - {a.status === "nominal" ? "within demo range" : a.status === "watch" ? "slightly outside the demo range" : "outside the demo range"}.
            </p>
          ))}
          {status === "review" && <p className="pt-1 font-medium text-white">Recommendation: recheck, then consider contacting the crew medical officer or a flight surgeon.</p>}
          {status === "watch" && <p className="pt-1">Recheck later today and note how you feel.</p>}
        </ResultBox>
      )}
    </form>
  );
}

// ---------- Exercise ----------
export function ExerciseForm() {
  const { addExercise } = useStore();
  const [kind, setKind] = useState<ExerciseKind>("Resistive (ARED-style)");
  const [minutes, setMinutes] = useState("");
  const [strength, setStrength] = useState("");
  const [errors, setErrors] = useState<{ minutes?: string; strength?: string }>({});
  const [done, setDone] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = Number(minutes);
    const s = strength.trim() === "" ? 0 : Number(strength);
    const errs: typeof errors = {};
    if (!Number.isFinite(m) || m < 5 || m > 240) errs.minutes = "Enter 5 to 240 minutes.";
    if (!Number.isFinite(s) || s < 0 || s > 500) errs.strength = "Enter 0 to 500 kg (or leave blank).";
    setErrors(errs);
    setDone(false);
    if (Object.keys(errs).length) return;
    addExercise({ date: today(), kind, minutes: m, strengthKg: s });
    setMinutes("");
    setStrength("");
    setDone(true);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3" aria-label="Log exercise session">
      <Field label="Exercise type" htmlFor="ex-kind">
        <select id="ex-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
          <option>Resistive (ARED-style)</option>
          <option>Treadmill</option>
          <option>Cycle ergometer</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (minutes)" htmlFor="ex-min" error={errors.minutes}>
          <input id="ex-min" inputMode="numeric" className={inputCls} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={!!errors.minutes} />
        </Field>
        <Field label="Peak load (kg), optional" htmlFor="ex-str" error={errors.strength} hint="Strength-tracking demo">
          <input id="ex-str" inputMode="decimal" className={inputCls} value={strength} onChange={(e) => setStrength(e.target.value)} aria-invalid={!!errors.strength} />
        </Field>
      </div>
      <button type="submit" className={btnPrimary}>
        <Dumbbell size={16} aria-hidden="true" /> Log session
      </button>
      {done && (
        <p role="status" className="flex items-center gap-2 text-sm text-ok">
          <Send size={14} aria-hidden="true" /> Session logged. Your trends were updated.
        </p>
      )}
    </form>
  );
}
