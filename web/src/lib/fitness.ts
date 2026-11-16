// Fitness sessions and weekly monitoring, stored only in this browser.
import type { Exercise } from "./pose";
export interface FitSession { id: string; when: string; exercise: Exercise; reps: number; seconds: number; tempo: number | null; avgHr: number | null; maxHr: number | null; usable: number }
const KEY = "aegis-fitness-v1";
export const listFit = (): FitSession[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
export function saveFit(s: FitSession) {
  const all = [s, ...listFit()].slice(0, 200);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event("aegis-fitness"));
  return all;
}
export const clearFit = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } window.dispatchEvent(new Event("aegis-fitness")); };

/** Last 7 days. WHO guideline for adults: at least 150 minutes of moderate activity per week. */
export function weekly(sessions: FitSession[], now = Date.now()) {
  const wk = sessions.filter((s) => now - Date.parse(s.when) < 7 * 864e5);
  const minutes = wk.reduce((a, s) => a + s.seconds, 0) / 60;
  const byEx: Record<string, number> = {};
  for (const s of wk) byEx[s.exercise] = (byEx[s.exercise] || 0) + s.reps;
  const days = new Set(wk.map((s) => s.when.slice(0, 10))).size;
  return { sessions: wk.length, minutes, reps: wk.reduce((a, s) => a + s.reps, 0), byEx, activeDays: days, whoPct: Math.min(100, Math.round((minutes / 150) * 100)) };
}
/** Rough heart-rate zone from age-predicted max (220 - age). A population estimate, not your measured maximum. */
export function hrZone(hr: number, age: number) {
  const max = 220 - age, pct = hr / max;
  return { pct: Math.round(pct * 100), zone: pct < 0.5 ? "very light" : pct < 0.64 ? "light" : pct < 0.77 ? "moderate" : pct < 0.93 ? "vigorous" : "near maximum", max };
}
