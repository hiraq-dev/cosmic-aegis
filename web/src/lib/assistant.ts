// Scripted, rule-based assistant for the DEMO prototype. It is NOT an AI model and gives no medical advice.
// It reads the user's own (demo) entries from the store and explains them in plain language.
// FUTURE INTEGRATION: a language-model backend could replace `reply` (see src/integrations).
import type { AppData } from "./types";
import { MOOD_LABEL, STATUS_LABEL, buildAlerts, mentalRecommendations, missionStatus, overall } from "./assess";

export interface BotReply {
  text: string;
  go?: { to: string; label: string };
  chips?: string[];
  speak?: string[]; // lines to read aloud when the user asks for voice guidance
}

// Personal, data-driven guidance as short spoken steps. General wellness pointers only, never a diagnosis.
export function buildGuidance(data: AppData): { headline: string; steps: string[] } {
  const o = overall(data);
  const name = data.profile.name.split(" ")[0] || "there";
  const steps: string[] = [];
  const m = o.mental.latest;

  const headline =
    o.status === "nominal"
      ? `Hello ${name}. Your demo readings look steady, with an overall score of ${o.score} out of 100.`
      : o.status === "watch"
        ? `Hello ${name}. A few of your readings deserve attention. Your overall score is ${o.score} out of 100.`
        : `Hello ${name}. Some of your readings suggest you should talk to someone. Your overall score is ${o.score} out of 100.`;

  if (o.mental.stressAlert) {
    steps.push(`Step one, stress. ${o.mental.highStress} of your last 5 check-ins reported high stress. Pause now and try the four, seven, eight breathing pacer on the console. Then tell your crew medical officer or a trusted crew-mate how you have been feeling.`);
  } else if (m && m.stress >= 4) {
    steps.push("Step one, stress. Your latest check-in shows high stress. Take a five minute breathing break, then check in again.");
  } else {
    steps.push("Step one, stress. Your stress looks manageable. Keep a short daily check-in so changes are easy to spot.");
  }

  if (o.mental.avgSleep < 6.5) {
    steps.push(`Step two, sleep. Your average sleep is ${o.mental.avgSleep.toFixed(1)} hours, below the demo line of six and a half. Protect your next sleep period, dim the lights beforehand, and avoid hard exercise just before bed.`);
  } else {
    steps.push(`Step two, sleep. Your average sleep is ${o.mental.avgSleep.toFixed(1)} hours, which looks steady. Keep a regular sleep schedule.`);
  }

  const bad = o.cardio.items.filter((i) => i.status !== "nominal");
  if (!o.cardio.latest) {
    steps.push("Step three, heart. You have no vital readings yet. Log a reading on the cardiovascular page so I can follow your trend.");
  } else if (bad.length) {
    steps.push(`Step three, heart. ${bad.map((b) => `${b.label} is ${b.value}`).join(", ")}. Rest for a few minutes and measure again. If it stays outside the range, tell your crew medical officer. This is awareness only, not a diagnosis.`);
  } else {
    steps.push("Step three, heart. Your latest readings are within the demo ranges. Keep logging them so trends stay visible.");
  }

  if (o.msk.daysActive < 4) {
    steps.push(`Step four, muscle and bone. You exercised on ${o.msk.daysActive} of the last 7 days. Add a resistance or cardio session today to stay on track.`);
  } else if (o.msk.strengthTrend <= -5) {
    steps.push(`Step four, muscle and bone. Your strength trend is ${o.msk.strengthTrend.toFixed(0)} percent compared with earlier sessions. Keep your sessions consistent and mention it to your medical officer.`);
  } else {
    steps.push(`Step four, muscle and bone. You were active on ${o.msk.daysActive} of the last 7 days. Great consistency, keep it up.`);
  }

  steps.push(
    o.status === "review"
      ? "Finally, because some readings are flagged, please contact your crew medical officer. If you ever feel unwell or unsafe, alert a crew-mate straight away. I am a scripted demo helper and cannot replace medical care."
      : "Finally, remember I am a scripted demo helper using simulated data. For real health concerns, always follow your mission medical procedures.",
  );
  return { headline, steps };
}

export const START_CHIPS = ["Read my guidance aloud", "How am I doing?", "Why is my stress high?", "Help me sleep", "I need a breathing break", "Explain my heart readings", "What is simulated here?"];

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
      go: { to: "/console?view=ground", label: "Open the simulated SOS screen" },
    };

  if (has(q, "guidance", "what should i do", "what do i do", "voice", "read aloud", "speak", "advice", "next step")) {
    const g = buildGuidance(data);
    return { text: [g.headline, ...g.steps].join("\n\n"), speak: [g.headline, ...g.steps], chips: ["Why is my stress high?", "Help me sleep"] };
  }

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
      go: { to: "/console", label: "Try a breathing break" },
      chips: ["I need a breathing break", "Help me sleep"],
    };
  }

  if (has(q, "sleep", "tired", "fatigue", "insomnia", "rest")) {
    const s = o.mental;
    return {
      text: `Your 7-entry average sleep is ${s.avgSleep.toFixed(1)} h and average fatigue ${s.avgFatigue.toFixed(1)}/5. ${s.avgSleep < 6.5 ? "That is below the illustrative 6.5 h line. Dim lights before your sleep period, keep a regular schedule, and avoid hard exercise just before sleep." : "That looks steady. Keep a regular sleep schedule."} The Companion page has a reaction-time test you can use as a rough alertness check (not a medical test).`,
      go: { to: "/console", label: "Open Companion" },
    };
  }

  if (has(q, "breath", "calm", "relax", "panic", "break")) return { text: "Let us slow down together. Open the breathing pacer: breathe in for 4, hold for 7, out for 8. Repeat 4 rounds.", go: { to: "/console", label: "Start breathing pacer" } };

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
    return { text: `Simulated mission: day ${ms.day} of ${ms.len} (${ms.progress}%). Simulated distance ${ms.distanceMkm} million km, one-way signal delay about ${ms.oneWayMin} minutes. These are demo values.`, go: { to: "/console?view=ground", label: "Try the delay-tolerant queue" } };
  }

  if (has(q, "simulat", "real", "fake", "nasa", "data", "medical", "diagnos", "ai ")) {
    return {
      text: "Your health entries are simulated demo data stored only in your browser. The one live part is the NASA DONKI space-weather panel on the dashboard. AEGIS is not a medical device and is not affiliated with or endorsed by NASA. I am a scripted helper, not an AI model. The Sources page has a full real-versus-simulated table.",
      go: { to: "/sources", label: "Sources & status" },
    };
  }

  if (has(q, "who are you", "what can you", "help")) return { text: "I read your logged entries and explain them in plain language, point you to the right page, and offer a breathing break. I cannot diagnose anything.", chips: START_CHIPS };
  if (has(q, "thank")) return { text: `You are welcome, ${name}.` };

  return { text: "I did not quite get that. I can talk about your mood, sleep, heart readings, exercise, alerts or the mission.", chips: START_CHIPS };
}
