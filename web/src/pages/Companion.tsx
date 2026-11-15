import { useEffect, useRef, useState } from "react";
import { Smile, Timer, Wind, Zap } from "lucide-react";
import { Panel, DemoBadge, Disclaimer, btnPrimary, btnGhost } from "../components/ui";
import { useStore } from "../lib/store";
import { mentalSummary } from "../lib/assess";

type Mood = "happy" | "analyze" | "zen" | "alert";

function Astro({ mood }: { mood: Mood }) {
  const mouth = mood === "happy" ? "M24 36 Q32 44 40 36" : mood === "alert" ? "M26 40 Q32 34 38 40" : mood === "zen" ? "M26 38 H38" : "M27 38 H37";
  return (
    <svg viewBox="0 0 64 64" className="h-32 w-32 animate-[float_4s_ease-in-out_infinite]" role="img" aria-label={`AI-generated illustration of the AEGIS companion, mood ${mood}`}>
      <circle cx="32" cy="32" r="26" fill="#e2e8f0" />
      <circle cx="32" cy="32" r="20" fill="#0b1230" stroke="#22d3ee" strokeWidth="2" />
      {mood === "zen" ? (
        <>
          <path d="M23 29 Q26 32 29 29" stroke="#22d3ee" strokeWidth="2" fill="none" />
          <path d="M35 29 Q38 32 41 29" stroke="#22d3ee" strokeWidth="2" fill="none" />
        </>
      ) : (
        <>
          <circle cx="26" cy="29" r={mood === "alert" ? 3.5 : 2.5} fill="#22d3ee" />
          <circle cx="38" cy="29" r={mood === "alert" ? 3.5 : 2.5} fill="#22d3ee" />
        </>
      )}
      <path d={mouth} stroke="#22d3ee" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const SPEECH: Record<Mood, string> = {
  happy: "Great to see you! Tell me how today feels.",
  analyze: "Looking at your recent check-ins...",
  zen: "Breathe with me. In... and out.",
  alert: "I noticed something. Let us check in together.",
};

const JOKES = [
  { q: "Which sandwich would you take on a long mission?", a: ["Peanut butter, forever", "Something that floats", "Whatever is not rehydrated"] },
  { q: "If the airlock could talk, what would it say?", a: ["Knock first!", "Please wipe your boots", "Nothing, it holds its breath"] },
  { q: "What is the best name for a crew plant?", a: ["Groot Jr.", "Sir Leafs-a-Lot", "Dinner"] },
];

function Pad() {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
  const label = !pt ? "Tap the pad to place how you feel." : pt.x >= 0.5 ? (pt.y < 0.5 ? "Energised and positive" : "Calm and content") : pt.y < 0.5 ? "Tense or stressed" : "Low and tired";
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Feeling pad: horizontal is unpleasant to pleasant, vertical is calm to energised"
        className="relative h-44 w-full cursor-crosshair rounded-xl border border-white/15 bg-space-900/70"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPt({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        }}
        onKeyDown={(e) => {
          const s = 0.1;
          const p = pt ?? { x: 0.5, y: 0.5 };
          if (e.key === "ArrowRight") setPt({ ...p, x: Math.min(1, p.x + s) });
          if (e.key === "ArrowLeft") setPt({ ...p, x: Math.max(0, p.x - s) });
          if (e.key === "ArrowUp") setPt({ ...p, y: Math.max(0, p.y - s) });
          if (e.key === "ArrowDown") setPt({ ...p, y: Math.min(1, p.y + s) });
        }}
      >
        <span className="absolute left-2 top-1 text-[10px] text-slate-400">Tense</span>
        <span className="absolute right-2 top-1 text-[10px] text-slate-400">Energised</span>
        <span className="absolute bottom-1 left-2 text-[10px] text-slate-400">Low</span>
        <span className="absolute bottom-1 right-2 text-[10px] text-slate-400">Calm</span>
        {pt && <span className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-aegis-cyan" style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }} />}
      </div>
      <p className="mt-2 text-sm text-slate-200" aria-live="polite">{label}</p>
      <p className="text-xs text-slate-400">This pad is a reflection aid only. To save a check-in, use the Mental health page.</p>
    </div>
  );
}

function Morale() {
  const [i, setI] = useState(0);
  const [humor, setHumor] = useState(20);
  const j = JOKES[i % JOKES.length];
  return (
    <div>
      <p className="text-sm font-medium text-white">{j.q}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {j.a.map((a) => (
          <button key={a} className={btnGhost} onClick={() => { setHumor((h) => Math.min(100, h + 15)); setI((n) => n + 1); }}>
            {a}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Morale meter (just for fun)</span><span>{humor}%</span></div>
        <div className="h-2 rounded bg-white/10"><div className="h-2 rounded bg-aegis-cyan" style={{ width: `${humor}%` }} /></div>
      </div>
    </div>
  );
}

function Breathing({ onPhase }: { onPhase: (zen: boolean) => void }) {
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState<"Breathe in" | "Hold" | "Breathe out">("Breathe in");
  const [round, setRound] = useState(0);
  useEffect(() => {
    onPhase(on);
    if (!on) return;
    let cancelled = false;
    const seq: [typeof phase, number][] = [["Breathe in", 4000], ["Hold", 7000], ["Breathe out", 8000]];
    let step = 0;
    let rounds = 0;
    let t: number;
    const run = () => {
      if (cancelled) return;
      setPhase(seq[step][0]);
      t = window.setTimeout(() => {
        step = (step + 1) % 3;
        if (step === 0) { rounds++; setRound(rounds); if (rounds >= 4) { setOn(false); return; } }
        run();
      }, seq[step][1]);
    };
    run();
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  const big = on && phase !== "Breathe out";
  return (
    <div className="text-center">
      <div className="mx-auto flex h-36 items-center justify-center">
        <div className="flex items-center justify-center rounded-full border-2 border-aegis-cyan bg-aegis-cyan/10 text-xs text-white transition-all ease-in-out" style={{ width: big ? 130 : 70, height: big ? 130 : 70, transitionDuration: phase === "Hold" ? "0ms" : phase === "Breathe in" ? "4s" : "8s" }}>
          {on ? phase : "Ready"}
        </div>
      </div>
      <p className="my-2 text-xs text-slate-400" aria-live="polite">{on ? `Round ${round + 1} of 4` : round >= 4 ? "Done. Well done." : "4-7-8 breathing, 4 rounds"}</p>
      <button className={btnPrimary} onClick={() => { setRound(0); setOn((o) => !o); }}>{on ? "Stop" : "Start"}</button>
    </div>
  );
}

function Reaction() {
  const [state, setState] = useState<"idle" | "wait" | "go" | "early">("idle");
  const [times, setTimes] = useState<number[]>([]);
  const t0 = useRef(0);
  const timer = useRef<number>(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const click = () => {
    if (state === "idle" || state === "early") {
      setState("wait");
      timer.current = window.setTimeout(() => { t0.current = performance.now(); setState("go"); }, 1500 + Math.random() * 2500);
    } else if (state === "wait") {
      clearTimeout(timer.current);
      setState("early");
    } else {
      setTimes((t) => [...t, Math.round(performance.now() - t0.current)].slice(-5));
      setState("idle");
    }
  };
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  return (
    <div>
      <button onClick={click} className={`h-28 w-full rounded-xl border text-sm font-semibold ${state === "go" ? "border-ok bg-ok/30 text-white" : state === "wait" ? "border-review/50 bg-review/20 text-white" : "border-white/20 bg-space-900/70 text-slate-100"}`}>
        {state === "idle" ? "Tap to start" : state === "wait" ? "Wait for green..." : state === "go" ? "TAP NOW" : "Too early. Tap to retry"}
      </button>
      <p className="mt-2 text-sm text-slate-200" aria-live="polite">{times.length ? `Last: ${times[times.length - 1]} ms. Average of ${times.length}: ${avg} ms.` : "Take 3 to 5 taps."}</p>
      <p className="text-xs text-slate-400">A simple reaction game inspired by vigilance tests. It is not a medical or fitness-for-duty test, and the numbers are not compared to any standard.</p>
    </div>
  );
}

export default function Companion() {
  const { data } = useStore();
  const ms = mentalSummary(data.moods);
  const [zen, setZen] = useState(false);
  const mood: Mood = zen ? "zen" : ms.stressAlert ? "alert" : ms.score >= 65 ? "happy" : "analyze";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Companion</h1>
        <p className="text-sm text-slate-300">Small tools for mood, morale, calm and alertness. Prototype interactions from Team AEGIS. <DemoBadge text="SIMULATED" /></p>
      </div>
      <Panel title="Your companion" icon={<Smile size={16} />}>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Astro mood={mood} />
          <p className="rounded-xl bg-white/10 px-4 py-3 text-sm text-slate-100">{SPEECH[mood]} <span className="block text-xs text-slate-400">Mood follows your latest demo check-ins: stress alert = alert, good wellbeing = happy.</span></p>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="How do you feel?" icon={<Smile size={16} />}><Pad /></Panel>
        <Panel title="Morale break" icon={<Smile size={16} />}><Morale /></Panel>
        <Panel title="Breathing pacer" icon={<Wind size={16} />}><Breathing onPhase={setZen} /></Panel>
        <Panel title="Reaction check" icon={<Timer size={16} />}><Reaction /></Panel>
      </div>
      <Panel title="Pattern note (scripted)" icon={<Zap size={16} />}>
        <p className="text-sm text-slate-200">
          {ms.stressAlert ? `${ms.highStress} of your last 5 check-ins reported high stress and average sleep is ${ms.avgSleep.toFixed(1)} h.` : `Average sleep is ${ms.avgSleep.toFixed(1)} h and fatigue ${ms.avgFatigue.toFixed(1)}/5.`} This note comes from a simple rule on your own demo entries, not from a machine-learning model.
        </p>
      </Panel>
      <Disclaimer />
    </div>
  );
}
