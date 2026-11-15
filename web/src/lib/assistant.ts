// Scripted, rule-based assistant for the DEMO prototype. It is NOT an AI model and gives no medical advice.
// It reads the user's own (demo) entries from the store and explains them in plain language.
// FUTURE INTEGRATION: a language-model backend could replace `reply` (see src/integrations).
import type { AppData } from "./types";
import { MOOD_LABEL, STATUS_LABEL, buildAlerts, mentalRecommendations, missionStatus, overall } from "./assess";

export interface BotReply {
  text: string;
  go?: { to: string; label: string };
  chips?: string[];
}

export const START_CHIPS = ["How am I doing?", "Why is my stress high?", "Help me sleep", "I need a breathing break", "Explain my heart readings", "What is simulated here?"];

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

export function reply(raw: string, data: AppData): BotReply {
  const q = raw.toLowerCase().trim();
  const name = data.profile.name.split(" ")[0] || "there";
  const o = overall(data);
  const m = o.mental.latest;

  if (!q) return { text: "Ask me about your mood, sleep, heart readings, exercise or alerts.", chips: START_CHIPS };

  // Safety first: never handle crisis or emergency symptoms with a scripted answer.
  if (has(q, "suicid", "kill myself", "hurt myself", "self harm", "self-harm", "end my life", "chest pain", "can't breathe", "cannot breathe", "faint", "unconscious", "emergency", "sos"))
    return {
      text:
        "This sounds serious, and I am only a scripted demo, so I cannot help with it. Please contact your crew medical officer or mission emergency channel right now, or alert a crew-mate next to you. On Earth, call your local emergency number. You do not have to handle this alone.",
      go: { to: "/comms", label: "Open the simulated SOS screen" },
    };

  if (has(q, "hello", "hi ", "hey") || q === "hi")
    return { text: `Hello ${name}. I am the AEGIS assistant, a scripted demo helper. I can explain your own logged data. What would you like to look at?`, chips: START_CHIPS };

  if (has(q, "how am i", "overview", "summary", "status", "how is my health")) {
    const parts = [
      `Overall: ${STATUS_LABEL[o.status]} (demo score ${o.score}/100).`,
      `Mental: ${STATUS_LABEL[o.mental.status]}, wellbeing ${o.mental.score}/100.`,
      `Muscle and bone: ${STATUS_LABEL[o.msk.status]}, ${o.msk.daysActive} of the last 7 days active.`,
      `Cardiovascular: ${STATUS_LABEL[o.cardio.status]}.`,
    ];
    const alerts = buildAlerts(data).filter((a) => a.level !== "nominal");
    if (alerts.length) parts.push(`Open alerts: ${alerts.map((a) => a.title).join("; ")}.`);
    return { text: parts.join(" "), go: { to: "/", label: "Open dashboard" }, chips: ["Why is my stress high?", "Explain my heart readings"] };
  }

  if (has(q, "alert", "warning", "worried", "concern")) {
    const a = buildAlerts(data).filter((x) => x.level !== "nominal");
    return a.length
      ? { text: a.map((x) => `${x.title}. ${x.detail}`).join(" "), go: { to: "/", label: "See alerts on dashboard" } }
      : { text: "No alerts need attention right now. Everything you logged is within the illustrative demo ranges." };
  }

  if (has(q, "stress", "anxious", "anxiety", "mood", "sad", "lonely", "feel")) {
    if (!m) return { text: "You have no check-ins yet. Log one and I can talk it through with you.", go: { to: "/mental", label: "Daily check-in" } };
    const recs = mentalRecommendations(m).join(" ");
    return {
      text: `Your latest check-in: mood ${MOOD_LABEL[m.mood]}, stress ${m.stress}/5, sleep ${m.sleepHours} h, fatigue ${m.fatigue}/5. ${o.mental.stressAlert ? `${o.mental.highStress} of your last 5 check-ins reported high stress, so consider talking to your crew medical officer. ` : ""}${recs}`,
      go: { to: "/companion", label: "Try a breathing break" },
      chips: ["I need a breathing break", "Help me sleep"],
    };
  }

  if (has(q, "sleep", "tired", "fatigue", "insomnia", "rest")) {
    const s = o.mental;
    return {
      text: `Your 7-entry average sleep is ${s.avgSleep.toFixed(1)} h and average fatigue ${s.avgFatigue.toFixed(1)}/5. ${s.avgSleep < 6.5 ? "That is below the illustrative 6.5 h line. Dim lights before your sleep period, keep a regular schedule, and avoid hard exercise just before sleep." : "That looks steady. Keep a regular sleep schedule."} The Companion page has a reaction-time test you can use as a rough alertness check (not a medical test).`,
      go: { to: "/companion", label: "Open Companion" },
    };
  }

  if (has(q, "breath", "calm", "relax", "panic", "break")) return { text: "Let us slow down together. Open the breathing pacer: breathe in for 4, hold for 7, out for 8. Repeat 4 rounds.", go: { to: "/companion", label: "Start breathing pacer" } };

  if (has(q, "heart", "blood pressure", "pressure", "oxygen", "spo2", "pulse", "vital", "cardio")) {
    const c = o.cardio;
    if (!c.latest) return { text: "No vital readings are logged yet.", go: { to: "/cardiovascular", label: "Log a reading" } };
    const lines = c.items.map((i) => `${i.label} ${i.value} (${STATUS_LABEL[i.status]})`).join("; ");
    return {
      text: `Latest readings: ${lines}. Over the last week, average systolic changed by ${c.sysDelta.toFixed(1)} mmHg and heart rate by ${c.hrDelta.toFixed(1)} bpm. This raises awareness only. It does not diagnose, predict or prevent any condition.`,
      go: { to: "/cardiovascular", label: "Open cardiovascular" },
    };
  }

  if (has(q, "exercise", "workout", "muscle", "bone", "strength", "gym", "train")) {
    const s = o.msk;
    return {
      text: `You were active on ${s.daysActive} of the last 7 days (${s.minutes7} min). Strength trend versus your early sessions: ${s.strengthTrend.toFixed(0)}%. Bone status here is only derived from activity consistency, not any bone measurement. ${s.status === "nominal" ? "Nice consistency." : "Try to add a session soon."}`,
      go: { to: "/musculoskeletal", label: "Open muscle & bone" },
    };
  }

  if (has(q, "mission", "day", "delay", "distance", "earth")) {
    const ms = missionStatus(data);
    return { text: `Simulated mission: day ${ms.day} of ${ms.len} (${ms.progress}%). Simulated distance ${ms.distanceMkm} million km, one-way signal delay about ${ms.oneWayMin} minutes. These are demo values.`, go: { to: "/comms", label: "Try the delay-tolerant queue" } };
  }

  if (has(q, "simulat", "real", "fake", "nasa", "data", "medical", "diagnos", "ai ")) {
    return {
      text: "Everything is simulated demo data stored only in your browser. AEGIS is not a medical device, is not affiliated with or endorsed by NASA, and uses no real NASA dataset. I am a scripted helper, not an AI model. The Sources page has a full real-versus-simulated table.",
      go: { to: "/sources", label: "Sources & status" },
    };
  }

  if (has(q, "who are you", "what can you", "help")) return { text: "I read your logged entries and explain them in plain language, point you to the right page, and offer a breathing break. I cannot diagnose anything.", chips: START_CHIPS };
  if (has(q, "thank")) return { text: `You are welcome, ${name}.` };

  return { text: "I did not quite get that. I can talk about your mood, sleep, heart readings, exercise, alerts or the mission.", chips: START_CHIPS };
}
