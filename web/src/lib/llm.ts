// Client for the optional language-model assistant (serverless /api/chat). Falls back to the scripted assistant.
import type { AppData } from "./types";
import { STATUS_LABEL, buildAlerts, overall } from "./assess";
import { buildSeries, readiness } from "./analytics";

export const CRISIS_RE = /suicid|kill myself|hurt myself|self.?harm|end my life|chest pain|can'?t breathe|cannot breathe|faint|unconscious|emergency|overdose/i;

export async function aiAvailable(): Promise<boolean> {
  try {
    const r = await fetch("/api/chat", { cache: "no-store" });
    if (!r.ok) return false;
    const j = await r.json();
    return j.enabled === true;
  } catch {
    return false;
  }
}

// Compact, anonymous summary of the (simulated) readings. No name, no free-text notes.
export function buildContext(data: AppData): string {
  const o = overall(data);
  const series = buildSeries(data);
  const rd = readiness(series);
  const lines = [
    `Overall: ${STATUS_LABEL[o.status]} (score ${o.score}/100). Readiness index ${rd.index}/100 (${rd.band}).`,
    `Mental: ${STATUS_LABEL[o.mental.status]}, avg sleep ${o.mental.avgSleep.toFixed(1)} h, high-stress check-ins ${o.mental.highStress} of last 5.`,
    `Muscle and bone: ${STATUS_LABEL[o.msk.status]}, active ${o.msk.daysActive} of last 7 days, strength trend ${o.msk.strengthTrend.toFixed(0)}%.`,
    `Cardiovascular: ${STATUS_LABEL[o.cardio.status]}${o.cardio.latest ? `, latest HR ${o.cardio.latest.heartRate} bpm, BP ${o.cardio.latest.systolic}/${o.cardio.latest.diastolic}, SpO2 ${o.cardio.latest.spo2}%` : ", no readings"}.`,
  ];
  const alerts = buildAlerts(data).filter((a) => a.level !== "nominal").map((a) => a.title);
  if (alerts.length) lines.push(`Open alerts: ${alerts.join("; ")}.`);
  const flagged = series.filter((s) => s.anomaly || s.worsening).map((s) => `${s.label} ${s.z >= 0 ? "+" : ""}${s.z.toFixed(1)} SD`);
  if (flagged.length) lines.push(`Flagged vs personal baseline: ${flagged.join(", ")}.`);
  return lines.join("\n");
}

export async function askAI(history: { role: "user" | "assistant"; content: string }[], data: AppData): Promise<{ text: string; safety?: boolean }> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: history, context: buildContext(data) }),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
