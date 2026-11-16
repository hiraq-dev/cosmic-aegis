// ASTRA: a consultation-style assistant. It is rule-based (no language model) and works only from data in this browser.
// It never diagnoses, never names medicines or doses, and always lists when to seek real care.
export interface HrStats { n: number; latest: number | null; ageS: number | null; min: number | null; max: number | null; mean: number | null; state: string }
export interface ScanSummary { when: string; impression: string; flagged: string[]; postureScore: number; quality: number; recommendations: string[] }
export interface AstraCtx { hr: HrStats; scan: ScanSummary | null; kp: number | null; kpLive: boolean; sleepH: number | null; mood: number | null; fit?: { sessions: number; minutes: number; reps: number; whoPct: number; activeDays: number } | null; face?: string | null }
export interface AstraReply { safety?: boolean; concern: string; findings: string[]; assessment: string; plan: string[]; seekCare: string[]; missing: string[] }

export const URGENT = /suicid|kill myself|hurt myself|self.?harm|end my life|chest pain|can'?t breathe|cannot breathe|faint|unconscious|overdose|stroke|seizure|severe bleeding/i;
const SEEK = ["Chest pain or pressure, fainting, trouble breathing, or a racing heartbeat that does not settle.", "Symptoms that are severe, sudden, or getting worse.", "Any thought of harming yourself: contact your crew medical officer or local emergency number immediately."];

export function astra(q: string, c: AstraCtx): AstraReply {
  const t = q.toLowerCase();
  if (URGENT.test(q)) return { safety: true, concern: "This may be urgent", findings: [], assessment: "I cannot assess an emergency. Please contact your crew medical officer or the mission emergency channel now, or alert someone next to you. On Earth, call your local emergency number.", plan: [], seekCare: SEEK, missing: [] };
  const findings: string[] = [], plan: string[] = [], missing: string[] = [];
  let concern = "General check-in", assessment = "";
  const hrLine = c.hr.latest != null ? `Heart rate: latest ${c.hr.latest} bpm (${c.hr.state}${c.hr.ageS != null ? `, ${c.hr.ageS < 90 ? c.hr.ageS + " s" : Math.round(c.hr.ageS / 60) + " min"} ago` : ""}); ${c.hr.n} readings, range ${c.hr.min}-${c.hr.max}, mean ${c.hr.mean?.toFixed(0)} bpm.` : null;
  const scanLine = c.scan ? `Latest body scan (${c.scan.when}): posture score ${c.scan.postureScore}/100, capture quality ${c.scan.quality}/100. ${c.scan.flagged.length ? "Flagged: " + c.scan.flagged.join(", ") + "." : "Nothing flagged."}` : null;
  const has = (...w: string[]) => w.some(x => t.includes(x));

  if (has("fitness", "exercise", "workout", "squat", "reps", "training", "active", "gym")) {
    concern = "Fitness and exercise";
    if (c.fit && c.fit.sessions) findings.push(`Last 7 days: ${c.fit.sessions} camera-counted set(s), ${c.fit.reps} reps, ${c.fit.minutes.toFixed(1)} active minutes on ${c.fit.activeDays} day(s) (${c.fit.whoPct}% of the 150-minute weekly guideline, camera sets only).`); else missing.push("No counted exercise sets yet. Use the camera counter in the crew panel.");
    if (hrLine) findings.push(hrLine);
    assessment = c.fit && c.fit.whoPct >= 100 ? "You have reached the weekly activity guideline from counted sets. Keep variety: strength and cardio both matter." : "Adults are advised to get about 150 minutes of moderate activity a week plus strength work twice a week. Counted camera sets only cover part of what you do.";
    plan.push("Add short daily sets (squats, arm raises, jumping jacks) and save each one.", "Warm up first and stop if you feel pain, dizziness or chest tightness.");
    missing.push("Resistance-load data (the camera counts reps, not weight)");
  } else if (has("face", "expression", "smile", "blink", "look tired", "eyes")) {
    concern = "Facial expression cues";
    findings.push(c.face ? `Latest scan: ${c.face}` : "No facial-expression data yet. Run the body scan with your face visible.");
    assessment = "Expression cues measure visible facial muscle movement (smile, brow furrow, blinking, eye closure). They cannot tell your emotion, pain or health, and they depend on light and camera angle.";
    plan.push("Re-scan in good, even light facing the camera, at the same time of day, to compare.");
  } else if (has("heart", "pulse", "bpm", "palpit", "hr ")) {
    concern = "Heart rate";
    if (hrLine) findings.push(hrLine); else missing.push("No heart-rate sensor readings yet. Pair a sensor above.");
    if (c.hr.latest != null && c.hr.state !== "receiving") findings.push("The sensor is not currently sending, so the last value may be out of date.");
    if (c.hr.mean != null) assessment = c.hr.mean > 100 ? "Your average is above the usual adult resting range of roughly 60-100 bpm. Activity, caffeine, stress, fever or poor sleep can all raise it, and a wrist or chest strap can read wrongly." : c.hr.mean < 50 ? "Your average is below 50 bpm. That is common in very fit people but worth mentioning to a clinician if you also feel dizzy or faint." : "Your average sits in the usual adult resting range of roughly 60-100 bpm. One session cannot show a trend.";
    else assessment = "I cannot comment without readings.";
    plan.push("Sit quietly for five minutes, then compare a resting reading.", "Note caffeine, exercise and sleep before readings so patterns are interpretable.");
  } else if (has("stress", "anx", "mood", "mental", "sad", "overwhelm", "panic", "lonely")) {
    concern = "Stress and mood";
    if (c.mood != null) findings.push(`Wellbeing score: ${c.mood}/100 (from the app's check-in log, which starts with sample demo entries unless you reset it).`); else missing.push("No mood check-ins logged.");
    if (c.sleepH != null) findings.push(`Average logged sleep: ${c.sleepH.toFixed(1)} h (app log, may be demo data).`);
    assessment = "Stress is common on long isolated missions, and it tends to track with sleep and routine. I cannot judge your mental health from numbers or a camera.";
    plan.push("Try slow breathing: in for 4 seconds, out for 6, for two minutes.", "Keep a fixed sleep and meal schedule, and talk to a crew-mate or your support contact.", "Log a daily check-in so a trend can be seen.");
  } else if (has("sleep", "tired", "fatig", "insomn", "rest")) {
    concern = "Sleep and fatigue";
    if (c.sleepH != null) findings.push(`Average logged sleep: ${c.sleepH.toFixed(1)} h.`); else missing.push("No sleep entries logged.");
    if (hrLine) findings.push(hrLine);
    assessment = c.sleepH != null && c.sleepH < 6.5 ? "Your logged sleep is below the 7-9 hours generally advised for adults, which can explain tiredness, low mood and slower reactions." : "Fatigue has many causes. Sleep length is one visible factor.";
    plan.push("Aim for a consistent bedtime and wake time.", "Reduce bright light and screens for an hour before bed.", "Light exercise earlier in the day often helps sleep.");
  } else if (has("posture", "back", "neck", "shoulder", "muscle", "bone", "pain", "stiff", "scan", "report", "body")) {
    concern = "Posture and movement";
    if (scanLine) findings.push(scanLine); else missing.push("No body scan yet. Run the scan above.");
    if (c.scan) findings.push(c.scan.impression);
    assessment = "A camera scan estimates posture and symmetry only. It does not measure bone density or muscle loss, and it cannot diagnose a condition.";
    plan.push(...(c.scan?.recommendations.slice(0, 3) ?? ["Run the scan with your full body in view, side-on and front-on, for comparison."]), "Take movement breaks every 45-60 minutes.");
  } else if (has("radiation", "space weather", "solar", "kp", "storm", "aurora", "geomagnetic")) {
    concern = "Space-weather context";
    findings.push(c.kp != null ? `NOAA planetary Kp is ${c.kp}${c.kpLive ? " (live)" : " (not live: cached or unavailable)"}.` : "Kp is currently unavailable.");
    assessment = "Space-weather indices describe conditions around Earth. They are not a measurement of any person's radiation dose, and I cannot say anything about your exposure unless a dosimeter reports it.";
    plan.push("Follow your mission's official space-weather and radiation procedures.");
    missing.push("Personal dosimeter reading");
  } else {
    findings.push(...[hrLine, scanLine].filter(Boolean) as string[]);
    assessment = "Here is what your data shows so far. Ask me about your heart rate, stress, sleep, posture or space weather for a closer look.";
    if (!findings.length) missing.push("No heart-rate or scan data yet.");
    plan.push("Run the body scan and pair a heart-rate sensor to give me something real to work with.");
  }
  return { concern, findings, assessment, plan, seekCare: SEEK, missing };
}
