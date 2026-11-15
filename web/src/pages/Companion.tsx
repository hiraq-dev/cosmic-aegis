import { useEffect, useRef, useState } from "react";
import { Brain, Lightbulb, MessageCircle, Moon, Smile, Sparkles, Timer, Wind, Zap } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, DemoBadge, Disclaimer, btnGhost, btnPrimary } from "../components/ui";
import { useStore } from "../lib/store";
import { mentalSummary } from "../lib/assess";
import { shortDate } from "../lib/dates";

type Mood = "happy" | "analyze" | "zen" | "alert";
const SPEECH: Record<Mood, string[]> = {
  happy: ["Hello crew! Your demo data looks steady. How is your mental orbit today?", "Great to see you! Tell me how today feels."],
  analyze: ["Scanning your recent check-ins...", "Looking for patterns in your sleep and stress entries."],
  zen: ["Breathe with me. In... and out.", "Let the day float by for a moment."],
  alert: ["I noticed several high-stress days. Let us check in together.", "Please consider talking to your crew medical officer."],
};
const JOKES = [
  "How do astronauts organize a party? They planet!",
  "Why did the sun go to school? To get a little brighter!",
  "In zero-g you do not drop things, you just place them in low habitat orbit!",
  "Why did the cow go to space? To see the Milky Way!",
];

function Astro({ mood, float, wave }: { mood: Mood; float: boolean; wave: boolean }) {
  return (
    <svg viewBox="0 0 200 240" className={`h-52 w-44 ${float ? "animate-[float_2s_ease-in-out_infinite]" : "animate-[float_4s_ease-in-out_infinite]"}`} role="img" aria-label={`AI-generated illustration of the AEGIS astronaut companion, mood ${mood}`}>
      <defs>
        <linearGradient id="suitGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".7" stopColor="#d8e2ec" />
          <stop offset="1" stopColor="#9ba8b7" />
        </linearGradient>
        <linearGradient id="visorGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00f0ff" />
          <stop offset=".4" stopColor="#0066ff" />
          <stop offset="1" stopColor="#0b1333" />
        </linearGradient>
      </defs>
      <rect x="52" y="85" width="96" height="100" rx="20" fill="#48596e" stroke="#253243" strokeWidth="3" />
      <rect x="66" y="95" width="28" height="40" rx="8" fill="#1c2735" />
      <rect x="106" y="95" width="28" height="40" rx="8" fill="#1c2735" />
      <circle cx="80" cy="115" r="9" fill="#00ff9d" opacity=".8" />
      <circle cx="120" cy="115" r="9" fill="#00f0ff" opacity=".8" />
      <ellipse className="thruster" cx="70" cy="190" rx="5" ry="12" fill="#00f0ff" opacity=".7" />
      <ellipse className="thruster" cx="130" cy="190" rx="5" ry="12" fill="#00f0ff" opacity=".7" />
      <rect x="62" y="95" width="76" height="85" rx="24" fill="url(#suitGrad)" stroke="#7b8d9f" strokeWidth="2.5" />
      <circle cx="82" cy="120" r="7" fill="#22d3ee" />
      <path d="M78 122 L82 116 L86 122 Z" fill="#8b5cf6" />
      <rect x="95" y="112" width="32" height="18" rx="4" fill="#09101e" stroke="#00f0ff" strokeWidth="1.2" />
      <text x="99" y="124" fill="#00ff9d" fontFamily="Space Mono, monospace" fontSize="7">SIM OK</text>
      <rect x="62" y="158" width="76" height="12" rx="3" fill="#3a485a" />
      <rect x="92" y="156" width="16" height="16" rx="4" fill="#00f0ff" opacity=".9" />
      <g className={wave ? "arm-wave" : ""}>
        <path d="M64 105 Q30 90 28 65 Q25 50 38 48 Q50 48 52 70 Q54 90 64 112" fill="url(#suitGrad)" stroke="#7b8d9f" strokeWidth="2" />
        <circle cx="33" cy="54" r="11" fill="#4b5e74" />
      </g>
      <path d="M136 105 Q168 125 162 145 Q158 158 145 155 Q135 152 140 135 Q145 120 136 112" fill="url(#suitGrad)" stroke="#7b8d9f" strokeWidth="2" />
      <circle cx="152" cy="150" r="10" fill="#4b5e74" />
      <circle cx="100" cy="62" r="48" fill="url(#suitGrad)" stroke="#8fa0b2" strokeWidth="3" />
      <rect x="68" y="98" width="64" height="10" rx="5" fill="#3d4e61" />
      <rect x="65" y="32" width="70" height="52" rx="20" fill="url(#visorGrad)" stroke="#00f0ff" strokeWidth="2" />
      {mood === "happy" && (
        <>
          <path d="M78 54 Q86 46 94 54" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M106 54 Q114 46 122 54" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M94 65 Q100 71 106 65" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {mood === "analyze" && (
        <>
          <circle cx="86" cy="54" r="5" fill="#fff" />
          <circle cx="114" cy="54" r="5" fill="#fff" />
          <path d="M94 67 H106" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {mood === "zen" && (
        <>
          <path d="M78 52 Q86 58 94 52" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M106 52 Q114 58 122 52" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M94 66 Q100 69 106 66" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {mood === "alert" && (
        <>
          <circle cx="86" cy="54" r="6" fill="#fff" />
          <circle cx="114" cy="54" r="6" fill="#fff" />
          <circle cx="86" cy="54" r="2.5" fill="#0b1333" />
          <circle cx="114" cy="54" r="2.5" fill="#0b1333" />
          <path d="M93 70 Q100 63 107 70" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      <ellipse cx="82" cy="42" rx="14" ry="5" fill="#fff" opacity=".35" transform="rotate(-18 82 42)" />
    </svg>
  );
}

function Mod01({ ms, setZenExt }: { ms: ReturnType<typeof mentalSummary>; setZenExt: (z: boolean) => void }) {
  const auto: Mood = ms.stressAlert ? "alert" : ms.score >= 65 ? "happy" : "analyze";
  const [pick, setPick] = useState<Mood | null>(null);
  const [text, setText] = useState(SPEECH[auto][0]);
  const [float, setFloat] = useState(false);
  const mood = pick ?? auto;
  const say = (m: Mood) => setText(SPEECH[m][Math.floor(Math.random() * SPEECH[m].length)]);
  const choose = (m: Mood) => {
    setPick(m);
    setZenExt(m === "zen");
    say(m);
  };
  const moods: [Mood, string][] = [["happy", "Happy"], ["analyze", "Scan"], ["zen", "Zen"], ["alert", "Alert"]];
  return (
    <div className="flex flex-col items-center">
      <p className="relative mb-3 max-w-[92%] rounded-xl border border-aegis-cyan bg-[rgba(14,25,52,.95)] px-4 py-2.5 text-center text-[15px] font-medium shadow-[0_4px_20px_rgba(0,240,255,.2)]" aria-live="polite">
        {text}
      </p>
      <button onClick={() => say(mood)} aria-label="Click the astronaut to hear a message" className="rounded-xl">
        <Astro mood={mood} float={float} wave={mood === "happy"} />
      </button>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Astronaut state">
        <span className="hud-mono text-[11px] text-slate-400">ASTRO STATE:</span>
        {moods.map(([m, l]) => (
          <button key={m} aria-pressed={mood === m} onClick={() => choose(m)} className={`rounded-md border px-3 py-1 text-sm font-semibold ${mood === m ? "border-aegis-cyan bg-cyan-400/20 text-white" : "border-white/15 text-slate-300 hover:bg-white/10"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button className={btnGhost} onClick={() => say(mood)}><MessageCircle size={14} /> Talk to Astro</button>
        <button className={btnGhost} onClick={() => setText(JOKES[Math.floor(Math.random() * JOKES.length)])}><Smile size={14} /> Space joke</button>
        <button className={btnGhost} aria-pressed={float} onClick={() => setFloat((f) => !f)}><Sparkles size={14} /> Zero-G float</button>
      </div>
    </div>
  );
}

function Mod02() {
  const [pt, setPt] = useState({ x: 0.68, y: 0.32 });
  const [res, setRes] = useState(70);
  const [load, setLoad] = useState(40);
  const val = (pt.x - 0.5) * 2;
  const aro = (0.5 - pt.y) * 2;
  const state = val >= 0 ? (aro >= 0 ? "FOCUSED" : "TRANQUIL") : aro >= 0 ? "STRESSED" : "FATIGUED";
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPt({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
  };
  const key = (e: React.KeyboardEvent) => {
    const s = 0.08;
    setPt((p) => ({ x: Math.min(1, Math.max(0, p.x + (e.key === "ArrowRight" ? s : e.key === "ArrowLeft" ? -s : 0))), y: Math.min(1, Math.max(0, p.y + (e.key === "ArrowDown" ? s : e.key === "ArrowUp" ? -s : 0))) }));
  };
  return (
    <div>
      <div role="slider" tabIndex={0} aria-label="Feeling pad. Arrow keys move. Horizontal: challenged to positive. Vertical: calm to high energy." aria-valuetext={state} onPointerDown={move} onPointerMove={(e) => e.buttons === 1 && move(e)} onKeyDown={key} className="relative h-52 w-full cursor-crosshair touch-none rounded-lg border border-cyan-400/30 bg-[rgba(9,16,34,.8)]">
        <span className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
        <span className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
        <span className="hud-mono absolute right-2 top-1.5 text-[10px] text-hud-emerald/60">FOCUSED</span>
        <span className="hud-mono absolute left-2 top-1.5 text-[10px] text-hud-amber/60">STRESSED</span>
        <span className="hud-mono absolute bottom-1.5 left-2 text-[10px] text-hud-crimson/60">FATIGUED</span>
        <span className="hud-mono absolute bottom-1.5 right-2 text-[10px] text-cyan-300/60">TRANQUIL</span>
        <span className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-aegis-cyan shadow-[0_0_14px_#00f0ff]" style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }} />
      </div>
      <p className="hud-mono mt-2 flex flex-wrap gap-x-4 text-xs text-slate-300">
        <span>Valence: <strong>{val >= 0 ? "+" : ""}{val.toFixed(2)}</strong></span>
        <span>Arousal: <strong>{aro >= 0 ? "+" : ""}{aro.toFixed(2)}</strong></span>
        <span>State: <strong className="text-hud-emerald">{state}</strong></span>
      </p>
      <div className="mt-3 space-y-3">
        <label className="block text-sm">Isolation and confinement resilience: <strong>{res}%</strong>
          <input type="range" min={0} max={100} value={res} onChange={(e) => setRes(+e.target.value)} className="mt-1 w-full accent-cyan-400" />
        </label>
        <label className="block text-sm">Cognitive workload: <strong>{load}%</strong>
          <input type="range" min={0} max={100} value={load} onChange={(e) => setLoad(+e.target.value)} className="mt-1 w-full accent-cyan-400" />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-400">Reflection aid only, not saved. To log a check-in, use the Mental page.</p>
    </div>
  );
}

const QUIZ = [
  { q: "Which snack survives a six-month mission?", a: ["Space cookies", "Freeze-dried ice cream", "Anything with hot sauce"] },
  { q: "The airlock could talk. What would it say?", a: ["Knock first!", "Wipe your boots", "...(holds its breath)"] },
  { q: "Best name for the crew plant?", a: ["Groot Jr.", "Sir Leafs-a-Lot", "Dinner"] },
  { q: "What would you bring to a zero-g dance floor?", a: ["Velcro shoes", "A tether", "Moves in 3D"] },
];
function Mod03() {
  const [i, setI] = useState(0);
  const [humor, setHumor] = useState(25);
  const [feed, setFeed] = useState<string[]>(["Crew chat (scripted): 'Who ate the last tube of peanut butter?'"]);
  const q = QUIZ[i % QUIZ.length];
  return (
    <div>
      <p className="font-medium text-white">{q.q}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {q.a.map((a) => (
          <button key={a} className={btnGhost} onClick={() => { setHumor((h) => Math.min(100, h + 12)); setFeed((f) => [`You: ${a}`, ...f].slice(0, 4)); setI((n) => n + 1); }}>{a}</button>
        ))}
      </div>
      <div className="mt-4">
        <div className="hud-mono mb-1 flex justify-between text-[11px] text-slate-400"><span>MORALE GAUGE (fun only)</span><span>{humor}%</span></div>
        <div className="h-2.5 rounded bg-white/10"><div className="h-full rounded bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${humor}%` }} /></div>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-slate-300">{feed.map((f, k) => <li key={k}>{f}</li>)}</ul>
    </div>
  );
}

function Mod04() {
  const { data } = useStore();
  const s = mentalSummary(data.moods);
  const last = s.latest;
  const [state, setState] = useState<"idle" | "wait" | "go" | "early">("idle");
  const [times, setTimes] = useState<number[]>([]);
  const t0 = useRef(0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = () => {
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
  const tile = (l: string, v: string) => (
    <div className="rounded-lg border border-white/10 bg-[rgba(9,16,34,.7)] p-3"><div className="hud-mono text-[10px] text-slate-400">{l}</div><div className="font-display text-xl text-white">{v}</div></div>
  );
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {tile("LAST SLEEP", last ? `${last.sleepHours} h` : "-")}
        {tile("7-DAY AVG", `${s.avgSleep.toFixed(1)} h`)}
        {tile("FATIGUE", `${s.avgFatigue.toFixed(1)}/5`)}
      </div>
      <p className="hud-mono mt-4 text-[11px] text-slate-400">1-TAP REACTION GAME (vigilance-style, not a medical test)</p>
      <button onClick={tap} className={`mt-1 h-24 w-full rounded-xl border font-display text-sm font-bold ${state === "go" ? "border-ok bg-ok/30 text-white" : state === "wait" ? "border-review/50 bg-review/20 text-white" : "border-white/20 bg-[rgba(9,16,34,.7)] text-slate-100"}`}>
        {state === "idle" ? "TAP TO START" : state === "wait" ? "WAIT FOR GREEN..." : state === "go" ? "TAP NOW" : "TOO EARLY - TAP TO RETRY"}
      </button>
      <p className="mt-2 text-sm" aria-live="polite">{times.length ? `Last ${times[times.length - 1]} ms. Average of ${times.length}: ${avg} ms.` : "Try 3 to 5 taps."}</p>
    </div>
  );
}

function Mod05() {
  const { data } = useStore();
  const rows = [...data.moods].sort((a, b) => a.date.localeCompare(b.date)).slice(-7).map((m) => ({ d: shortDate(m.date), sleep: m.sleepHours, fatigue: m.fatigue }));
  return (
    <div>
      <div className="h-56" role="img" aria-label="Line chart of sleep hours and fatigue for the last 7 demo entries">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,.08)" />
            <XAxis dataKey="d" />
            <YAxis domain={[0, 10]} />
            <Tooltip contentStyle={{ background: "#0a1230", border: "1px solid #22d3ee" }} />
            <ReferenceLine y={6.5} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: "6.5 h demo line", fill: "#fbbf24", fontSize: 10, position: "insideTopRight" }} />
            <Line type="monotone" dataKey="sleep" name="Sleep (h)" stroke="#22d3ee" strokeWidth={2.5} dot />
            <Line type="monotone" dataKey="fatigue" name="Fatigue (1-5)" stroke="#fb7185" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-400">Your last 7 demo entries. The 6.5 h line is an illustrative threshold, not a NASA limit.</p>
    </div>
  );
}

function Mod06({ ms }: { ms: ReturnType<typeof mentalSummary> }) {
  const bars = [
    { l: "Stress days (last 5)", v: ms.highStress * 20, c: "bg-hud-amber" },
    { l: "Sleep shortfall vs 7.5 h", v: Math.max(0, Math.min(100, (7.5 - ms.avgSleep) * 40)), c: "bg-hud-crimson" },
    { l: "Fatigue level", v: ms.avgFatigue * 20, c: "bg-aegis-violet" },
  ];
  return (
    <div className="space-y-3">
      {bars.map((b) => (
        <div key={b.l}>
          <div className="hud-mono mb-1 flex justify-between text-[11px] text-slate-400"><span>{b.l}</span><span>{Math.round(b.v)}%</span></div>
          <div className="h-2 rounded bg-white/10"><div className={`h-full rounded ${b.c}`} style={{ width: `${b.v}%` }} /></div>
        </div>
      ))}
      <p className="text-sm text-slate-200">
        {ms.stressAlert ? "Pattern: repeated high stress with short sleep. Consider a break and talking to your crew medical officer." : ms.avgSleep < 6.5 ? "Pattern: sleep is running short. Protect your next sleep period." : "No concerning pattern in your recent entries."}
      </p>
      <p className="text-xs text-slate-400">Scripted rule over your own demo entries. Not a machine-learning model and not a diagnosis.</p>
    </div>
  );
}

function Breathing({ onZen }: { onZen: (z: boolean) => void }) {
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState("Breathe in");
  const [round, setRound] = useState(0);
  useEffect(() => {
    onZen(on);
    if (!on) return;
    const seq: [string, number][] = [["Breathe in", 4000], ["Hold", 7000], ["Breathe out", 8000]];
    let step = 0;
    let rounds = 0;
    let dead = false;
    let t = 0;
    const run = () => {
      if (dead) return;
      setPhase(seq[step][0]);
      t = window.setTimeout(() => {
        step = (step + 1) % 3;
        if (step === 0) { rounds++; setRound(rounds); if (rounds >= 4) { setOn(false); return; } }
        run();
      }, seq[step][1]);
    };
    run();
    return () => { dead = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  const big = on && phase !== "Breathe out";
  return (
    <div className="text-center">
      <div className="mx-auto flex h-36 items-center justify-center">
        <div className="flex items-center justify-center rounded-full border-2 border-aegis-cyan bg-cyan-400/10 text-xs text-white shadow-[0_0_20px_rgba(0,240,255,.3)] transition-all ease-in-out" style={{ width: big ? 130 : 70, height: big ? 130 : 70, transitionDuration: phase === "Hold" ? "0ms" : phase === "Breathe in" ? "4s" : "8s" }}>{on ? phase : "Ready"}</div>
      </div>
      <p className="my-2 text-xs text-slate-400" aria-live="polite">{on ? `Round ${round + 1} of 4` : round >= 4 ? "Done. Well done." : "4-7-8 pacer, 4 rounds"}</p>
      <button className={btnPrimary} onClick={() => { setRound(0); setOn((o) => !o); }}>{on ? "Stop" : "Start"}</button>
    </div>
  );
}

function Tools() {
  const [light, setLight] = useState<null | "warm" | "cool">(null);
  const [tone, setTone] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!tone) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const merge = ctx.createChannelMerger(2);
    [432, 438].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(merge, 0, i);
      o.start();
    });
    merge.connect(g).connect(ctx.destination);
    return () => { void ctx.close(); };
  }, [tone]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button className={btnGhost} onClick={() => setLight("warm")}><Lightbulb size={14} /> Warm wind-down light</button>
        <button className={btnGhost} onClick={() => setLight("cool")}><Lightbulb size={14} /> Cool wake-up light</button>
        <button className={tone ? btnPrimary : btnGhost} aria-pressed={tone} onClick={() => setTone((t) => !t)}>{tone ? "Stop tone" : "Play calm tone (432/438 Hz)"}</button>
      </div>
      <p className="text-xs text-slate-400">The two-tone sound is a gentle relaxation sound for headphones. It is not therapy, and no health effect is claimed. Keep the volume low.</p>
      {light && (
        <div role="dialog" aria-label="Screen light" onClick={() => setLight(null)} className="fixed inset-0 z-[60] flex cursor-pointer items-end justify-center p-6" style={{ background: light === "warm" ? "rgba(255,150,60,.55)" : "rgba(120,200,255,.5)" }}>
          <button className={btnPrimary}>Close light</button>
        </div>
      )}
    </div>
  );
}

export default function Companion() {
  const { data } = useStore();
  const ms = mentalSummary(data.moods);
  const [, setZen] = useState(false);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Habitat console</h1>
        <p className="text-slate-300">Astronaut-side tools for mood, morale, sleep, calm and alertness. Team AEGIS prototype. <DemoBadge text="SIMULATED" /></p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <Panel mod="MOD-01" title="Astro companion" icon={<Smile size={16} />}><Mod01 ms={ms} setZenExt={setZen} /></Panel>
          <Panel mod="MOD-03" title="Morale break" icon={<Smile size={16} />}><Mod03 /></Panel>
        </div>
        <div className="space-y-5">
          <Panel mod="MOD-02" title="Daily wellbeing pad" icon={<Brain size={16} />}><Mod02 /></Panel>
          <Panel mod="MOD-06" title="Pattern detection" icon={<Zap size={16} />}><Mod06 ms={ms} /></Panel>
        </div>
        <div className="space-y-5">
          <Panel mod="MOD-04" title="Sleep and fatigue" icon={<Moon size={16} />}><Mod04 /></Panel>
          <Panel mod="MOD-05" title="7-day sleep trend" icon={<Timer size={16} />}><Mod05 /></Panel>
        </div>
      </div>
      <Panel mod="MOD-07" title="Prevention tools" icon={<Wind size={16} />}>
        <div className="grid gap-6 md:grid-cols-2">
          <Breathing onZen={setZen} />
          <Tools />
        </div>
      </Panel>
      <Disclaimer />
    </div>
  );
}
