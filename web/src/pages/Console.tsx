import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Brain, ClipboardCheck, Clock, Globe2, Moon, Radio, Send, Siren, Smile, Sparkles, Volume2, VolumeX, Wind, Zap } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, DemoBadge, Disclaimer } from "../components/ui";
import { Mod01 } from "./Companion";
import { useStore } from "../lib/store";
import { mentalSummary, missionStatus, overall, wellbeingScore, MOOD_LABEL } from "../lib/assess";
import { shortDate, today } from "../lib/dates";

type View = "hab" | "ground" | "checklist";
type Toast = { id: number; text: string; kind: "info" | "success" | "alert" };
interface Pkt { id: number; name: string; size: string; prio: string; status: "queued" | "sent" }

const btn = "rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[13px] font-semibold text-slate-100 transition hover:border-cyan-300 hover:bg-cyan-400/20 hover:shadow-[0_0_10px_rgba(0,240,255,.25)]";
const btnPrime = "font-display flex w-full items-center justify-center gap-2 rounded-md border border-cyan-300 bg-gradient-to-r from-[#00b4d8] to-[#0077b6] px-4 py-2.5 text-[12.5px] font-bold tracking-wider text-white shadow-[0_0_14px_rgba(0,180,216,.3)] transition hover:shadow-[0_0_22px_rgba(0,240,255,.5)] disabled:opacity-50";
const tile = "rounded-lg border border-cyan-400/20 bg-[rgba(6,13,30,.85)] p-3";
const lbl = "hud-mono text-[10px] text-slate-400";
const Pill = ({ children, tone = "emerald" }: { children: ReactNode; tone?: "emerald" | "amber" | "cyan" }) => (
  <span className={`hud-mono rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${tone === "emerald" ? "border-emerald-400/40 bg-emerald-400/10 text-hud-emerald" : tone === "amber" ? "border-amber-400/40 bg-amber-400/10 text-hud-amber" : "border-cyan-400/40 bg-cyan-400/10 text-aegis-cyan"}`}>{children}</span>
);

// ---------- audio (Web Audio, only after a user click) ----------
function useAudio() {
  const [on, setOn] = useState(true);
  const ctx = useRef<AudioContext | null>(null);
  const get = () => {
    if (!ctx.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx.current = new AC();
    }
    if (ctx.current.state === "suspended") void ctx.current.resume();
    return ctx.current;
  };
  const beep = useCallback((f = 440, d = 0.08, type: OscillatorType = "sine") => {
    if (!on) return;
    try {
      const c = get();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.06, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + d);
    } catch {
      /* audio blocked: ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  return { on, setOn, beep };
}

// ---------- modal ----------
function Modal({ label, onClose, children, tone = "cyan" }: { label: string; onClose: () => void; children: ReactNode; tone?: "cyan" | "red" }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className={`max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border bg-[rgba(8,14,32,.97)] p-6 ${tone === "red" ? "border-hud-crimson shadow-[0_0_40px_rgba(255,42,85,.5)]" : "border-aegis-cyan shadow-[0_0_30px_rgba(0,240,255,.3)]"}`}>{children}</div>
    </div>
  );
}

// ---------- MOD-02 ----------
function Mod02({ onCommit }: { onCommit: () => void }) {
  const { data, addMood } = useStore();
  const [pt, setPt] = useState({ x: 0.68, y: 0.32 });
  const [res, setRes] = useState(80);
  const [load, setLoad] = useState(40);
  const [coh, setCoh] = useState(85);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(false);
  const val = (pt.x - 0.5) * 2;
  const aro = (0.5 - pt.y) * 2;
  const state = val >= 0 ? (aro >= 0 ? "ENERGISED & FOCUSED" : "TRANQUIL & STABLE") : aro >= 0 ? "STRESSED" : "FATIGUED";
  const good = val >= 0;
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPt({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
  };
  const key = (e: React.KeyboardEvent) => {
    const s = 0.08;
    setPt((p) => ({ x: Math.min(1, Math.max(0, p.x + (e.key === "ArrowRight" ? s : e.key === "ArrowLeft" ? -s : 0))), y: Math.min(1, Math.max(0, p.y + (e.key === "ArrowDown" ? s : e.key === "ArrowUp" ? -s : 0))) }));
  };
  // Tiny keyword score, shown as such. Not NLP and not a clinical measure.
  const sentiment = useMemo(() => {
    const pos = (text.toLowerCase().match(/good|great|happy|calm|rested|confident|fine|proud|excited|well/g) ?? []).length;
    const neg = (text.toLowerCase().match(/tired|stress|sad|lonely|anxious|angry|bad|worried|exhausted|tense/g) ?? []).length;
    return { pos, neg, label: !text.trim() ? "Nothing written yet" : pos > neg ? "Mostly positive words" : neg > pos ? "Mostly heavy words" : "Mixed or neutral words" };
  }, [text]);
  const commit = () => {
    const last = [...data.moods].sort((a, b) => a.date.localeCompare(b.date)).pop();
    const mood = Math.max(1, Math.min(5, Math.round(1 + ((val + 1) / 2) * 4))) as 1 | 2 | 3 | 4 | 5;
    const stress = Math.max(1, Math.min(5, Math.round(1 + (load / 100) * 2 + (val < 0 ? 1.5 : 0) + Math.max(0, aro)))) as 1 | 2 | 3 | 4 | 5;
    addMood({ date: today(), mood, stress, sleepHours: last?.sleepHours ?? 7, fatigue: last?.fatigue ?? 3, note: text.trim() || undefined });
    onCommit();
  };
  return (
    <div className="space-y-3.5">
      <div className="rounded-lg border border-white/10 bg-[rgba(5,10,24,.9)] p-2.5">
        <p className="hud-mono text-center text-[8.5px] text-slate-500">HIGH ENERGY / ALERT</p>
        <div role="slider" tabIndex={0} aria-label="Feeling pad. Arrow keys move. Left to right: challenged to positive. Bottom to top: calm to high energy." aria-valuetext={state} onPointerDown={move} onPointerMove={(e) => e.buttons === 1 && move(e)} onKeyDown={key} className="relative my-1.5 h-32 w-full cursor-crosshair touch-none rounded-md border border-cyan-400/20 bg-[radial-gradient(circle_at_center,rgba(0,240,255,.07),rgba(5,10,24,.9)_70%)]">
          <span className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
          <span className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
          <span className="hud-mono absolute right-2 top-1.5 text-[9px] text-hud-emerald/60">FOCUSED</span>
          <span className="hud-mono absolute left-2 top-1.5 text-[9px] text-hud-amber/60">STRESSED</span>
          <span className="hud-mono absolute bottom-1.5 left-2 text-[9px] text-hud-crimson/60">FATIGUED</span>
          <span className="hud-mono absolute bottom-1.5 right-2 text-[9px] text-cyan-300/60">TRANQUIL</span>
          <span className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-aegis-cyan shadow-[0_0_12px_#00f0ff]" style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }} />
        </div>
        <div className="hud-mono flex justify-between text-[8.5px] text-slate-500"><span>CHALLENGED / TIRED</span><span>POSITIVE / ENERGISED</span></div>
        <p className="hud-mono mt-1 flex flex-wrap justify-between gap-x-2 text-[10.5px] text-slate-300">
          <span>Valence: <strong>{val >= 0 ? "+" : ""}{val.toFixed(2)}</strong></span>
          <span>Arousal: <strong>{aro >= 0 ? "+" : ""}{aro.toFixed(2)}</strong></span>
          <span>State: <strong className={good ? "text-hud-emerald" : "text-hud-amber"}>{state}</strong></span>
        </p>
      </div>
      {([["Isolation and confinement resilience", res, setRes], ["Cognitive workload perception", load, setLoad], ["Crew social cohesion", coh, setCoh]] as const).map(([l, v, set]) => (
        <label key={l} className="block">
          <span className="hud-mono flex justify-between text-[10px] text-slate-400"><span>{l}</span><span>{v}%</span></span>
          <input type="range" min={0} max={100} value={v} onChange={(e) => set(+e.target.value)} className="mt-1 w-full accent-cyan-400" />
        </label>
      ))}
      <div>
        <label htmlFor="journal" className="hud-mono text-[10px] text-slate-400">PRIVATE LOG (stays in this browser)</label>
        <textarea id="journal" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type how you feel, what went well, what is weighing on you..." className="mt-1 w-full rounded-md border border-cyan-400/25 bg-[rgba(6,12,28,.8)] px-2.5 py-2 text-[14px] text-white outline-none focus:border-aegis-cyan" />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <button className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-cyan-400/15" onClick={() => setText("Rested well, crew breakfast was good, feeling calm and confident about today.")}>Sample log</button>
          <button className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-cyan-400/15" onClick={() => { setVoice(true); setTimeout(() => setVoice(false), 1400); }}>{voice ? "Voice not supported in demo" : "Record voice (not available)"}</button>
        </div>
        <p className="mt-1 flex items-center justify-between text-xs"><span className={lbl}>KEYWORD READ (not NLP):</span><Pill tone={sentiment.neg > sentiment.pos ? "amber" : "emerald"}>{sentiment.label.toUpperCase()}</Pill></p>
      </div>
      <button className={btnPrime} onClick={commit}><Send size={14} /> COMMIT TODAY'S CHECK-IN</button>
      <p className="text-[11px] text-slate-400">Saves a mood entry for today (the same data the Mental page uses) and queues a simulated packet.</p>
    </div>
  );
}

// ---------- MOD-03 ----------
const QUIZ = [
  { q: "A visiting alien asks why we spend 30 minutes looking for a floating pen. Who explains it?", a: ["The Commander, with a tactical briefing", "The pilot, who blames solar wind", "The doctor, who studies the alien's reaction to velcro", "The engineer, who tries to trade for duct tape"], b: "Pilot (fictional): 'In zero-g, pens enter a wormhole behind the air duct!'" },
  { q: "One luxury item is allowed on the way home. What does the crew pick?", a: ["An espresso machine that does not foam sideways", "A zero-g trampoline with pillow anchors", "A 'fresh pine forest' smell machine", "A guitar that never wakes the Commander"], b: "Commander (fictional): 'Approved, but no guitar at 03:00.'" },
  { q: "You wake up floating 3 inches above your bunk. First reaction?", a: ["Swim through the cabin like a majestic space seal", "Panic for 0.4 seconds", "Ask Astro for heroic docking music", "Grab the floating coffee pouch"], b: "Doctor (fictional): 'Reaction time passed. Zero-g elegance.'" },
  { q: "Space dad joke: why couldn't the astronaut book a room on the Moon?", a: ["Because it was full", "Not enough shielding", "The voucher was declined", "Someone took the door for copper"], b: "Engineer (fictional): 'That copper was for science! You're welcome.'" },
];
function Mod03({ beep, toast }: { beep: (f?: number, d?: number) => void; toast: (t: string, k?: Toast["kind"]) => void }) {
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [humor, setHumor] = useState(60);
  const [feed, setFeed] = useState(QUIZ[0].b);
  const q = QUIZ[i];
  const BANTER = ["Engineer (fictional): 'If we stack enough velcro pads, can we sleep on the ceiling? Asking for science.'", "Doctor (fictional): 'Science says the engineer should never be left alone with velcro.'", "Commander (fictional): 'Whoever teaches Astro dad jokes at 02:00 is on filter duty.'"];
  const boost = (n: number) => setHumor((h) => Math.min(100, h + n));
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-cyan-400/20 bg-[rgba(7,14,32,.85)] p-3">
        <p className="hud-mono mb-1.5 text-[9px] tracking-wider text-aegis-cyan">COSMIC ICEBREAKER</p>
        <p className="mb-3 text-[15px] font-semibold leading-snug text-white">{q.q}</p>
        <div className="space-y-1.5">
          {q.a.map((a, k) => (
            <button key={a} onClick={() => { setSel(k); boost(5); beep(580); setFeed(q.b); }} className={`block w-full rounded-md border px-3 py-2 text-left text-[13.5px] transition ${sel === k ? "border-hud-emerald bg-emerald-400/15 text-white" : "border-white/10 bg-white/5 text-slate-200 hover:border-aegis-cyan hover:bg-cyan-400/10"}`}>
              {String.fromCharCode(65 + k)}) {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="hud-mono flex justify-between text-[10px] text-slate-400"><span>MORALE GAUGE (just for fun)</span><span>{humor}%</span></p>
        <div className="mt-1 h-2 rounded bg-white/10"><div className="h-full rounded bg-gradient-to-r from-hud-amber to-hud-emerald transition-all" style={{ width: `${humor}%` }} /></div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button className={btn} onClick={() => { setI((n) => (n + 1) % QUIZ.length); setSel(null); beep(520); }}>Next dilemma</button>
          <button className={btn} onClick={() => { setFeed(BANTER[Math.floor(Math.random() * BANTER.length)]); boost(10); beep(620); }}>Generate crew banter</button>
          <button className="rounded border border-hud-emerald bg-emerald-400/10 px-2.5 py-1.5 text-[12px] font-bold text-hud-emerald hover:bg-emerald-400/25" onClick={() => { boost(15); beep(780, 0.12); toast("Laugh logged: morale gauge +15%", "success"); }}>Log laugh (+15%)</button>
        </div>
      </div>
      <p className="rounded-md border border-dashed border-white/15 bg-black/25 px-3 py-2 text-[13px] text-slate-300">{feed}</p>
    </div>
  );
}

// ---------- MOD-04 ----------
function Mod04({ beep, toast }: { beep: (f?: number, d?: number, t?: OscillatorType) => void; toast: (t: string, k?: Toast["kind"]) => void }) {
  const { data } = useStore();
  const s = mentalSummary(data.moods);
  const last = s.latest;
  const [state, setState] = useState<"idle" | "wait" | "go" | "early" | "done">("idle");
  const [times, setTimes] = useState<number[]>([]);
  const t0 = useRef(0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = () => {
    if (state === "idle" || state === "early" || state === "done") {
      setState("wait");
      beep(400);
      timer.current = window.setTimeout(() => { t0.current = performance.now(); setState("go"); beep(880, 0.1); }, 1500 + Math.random() * 2500);
    } else if (state === "wait") {
      clearTimeout(timer.current);
      setState("early");
      beep(240, 0.2, "sawtooth");
    } else {
      const ms = Math.round(performance.now() - t0.current);
      setTimes((t) => [...t, ms].slice(-8));
      setState("done");
      beep(650, 0.1);
      toast(`Reaction time: ${ms} ms`, "success");
    }
  };
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const lastMs = times[times.length - 1];
  const prev = times.slice(0, -1);
  const prevAvg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
  const grade = !lastMs ? "UNTESTED" : prevAvg && lastMs > prevAvg * 1.25 ? "SLOWER THAN YOUR USUAL" : "IN YOUR USUAL RANGE";
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className={tile}><Moon size={15} className="text-aegis-cyan" /><p className={lbl}>LAST SLEEP</p><p className="font-display text-xl font-bold text-white">{last ? last.sleepHours : "-"}<span className="ml-1 text-[10px] text-slate-400">HRS</span></p><p className="hud-mono text-[9px] text-slate-400">entry {last ? shortDate(last.date) : "-"}</p></div>
        <div className={tile}><Clock size={15} className="text-aegis-cyan" /><p className={lbl}>7-ENTRY AVG</p><p className="font-display text-xl font-bold text-white">{s.avgSleep.toFixed(1)}<span className="ml-1 text-[10px] text-slate-400">HRS</span></p><p className={`hud-mono text-[9px] ${s.avgSleep < 6.5 ? "text-hud-amber" : "text-hud-emerald"}`}>{s.avgSleep < 6.5 ? "below demo 6.5 h line" : "above demo 6.5 h line"}</p></div>
        <div className={tile}><Zap size={15} className="text-aegis-cyan" /><p className={lbl}>FATIGUE</p><p className="font-display text-xl font-bold text-white">{s.avgFatigue.toFixed(1)}<span className="ml-1 text-[10px] text-slate-400">/ 5</span></p><p className="hud-mono text-[9px] text-slate-400">7-entry average</p></div>
        <div className={tile}><Brain size={15} className="text-aegis-cyan" /><p className={lbl}>WELLBEING</p><p className="font-display text-xl font-bold text-white">{s.score}<span className="ml-1 text-[10px] text-slate-400">/ 100</span></p><p className="hud-mono text-[9px] text-slate-400">demo formula</p></div>
      </div>
      <div className="mt-3.5 rounded-lg border border-white/10 bg-[rgba(5,10,24,.9)] p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-xs font-bold text-aegis-cyan">1-TAP REACTION GAME</p>
            <p className="text-[12px] text-slate-400">Inspired by vigilance tests. Compares you only with yourself. Not a medical test and not fitness for duty.</p>
          </div>
          <Pill tone="cyan">{state === "go" ? "TAP!" : state === "wait" ? "STANDBY" : "READY"}</Pill>
        </div>
        <button onClick={tap} className={`font-display h-20 w-full select-none rounded-md border text-sm font-bold transition ${state === "go" ? "border-hud-emerald bg-emerald-400/35 text-white shadow-[0_0_25px_#00ff9d]" : state === "wait" ? "border-hud-amber bg-amber-400/20 text-hud-amber" : state === "done" ? "border-aegis-cyan bg-cyan-400/20 text-aegis-cyan" : "border-dashed border-white/20 bg-white/5 text-slate-300"}`}>
          {state === "idle" ? "CLICK TO START" : state === "wait" ? "WAIT FOR GREEN..." : state === "go" ? "CLICK NOW!" : state === "early" ? "FALSE START - CLICK TO RETRY" : `${lastMs} ms - CLICK TO RETEST`}
        </button>
        <p className="hud-mono mt-2 flex flex-wrap justify-between gap-x-3 text-[11px] text-slate-300" aria-live="polite">
          <span>Last: <strong>{lastMs ? `${lastMs} ms` : "---"}</strong></span>
          <span>Your average: <strong>{avg ? `${avg} ms` : "---"}</strong></span>
          <span>Grade: <strong className={grade.startsWith("SLOWER") ? "text-hud-amber" : "text-hud-emerald"}>{grade}</strong></span>
        </p>
      </div>
    </div>
  );
}

// ---------- MOD-05 ----------
function Mod05() {
  const { data } = useStore();
  const [metric, setMetric] = useState<"sleep" | "fatigue" | "wellbeing">("sleep");
  const rows = [...data.moods].sort((a, b) => a.date.localeCompare(b.date)).slice(-7).map((m) => ({ d: shortDate(m.date), sleep: m.sleepHours, fatigue: m.fatigue, wellbeing: wellbeingScore(m), mood: MOOD_LABEL[m.mood] }));
  const cfg = { sleep: { name: "Sleep (h)", dom: [0, 10], color: "#00f0ff" }, fatigue: { name: "Fatigue (1-5)", dom: [0, 5], color: "#fb7185" }, wellbeing: { name: "Wellbeing (0-100)", dom: [0, 100], color: "#00ff9d" } }[metric];
  const mean = rows.length ? rows.reduce((a, r) => a + r.sleep, 0) / rows.length : 0;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Chart metric">
          {([["sleep", "Sleep (hrs)"], ["fatigue", "Fatigue"], ["wellbeing", "Wellbeing"]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={metric === k} onClick={() => setMetric(k)} className={`rounded border px-2 py-1 text-[12px] ${metric === k ? "border-aegis-cyan bg-cyan-400/20 text-white" : "border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}>{l}</button>
          ))}
        </div>
        <p className="hud-mono text-[10px] text-slate-400"><span className="text-hud-crimson">- -</span> demo line 6.5 h</p>
      </div>
      <div className="h-60 rounded-lg border border-cyan-400/20 bg-[rgba(5,9,22,.85)] p-2" role="img" aria-label={`Line chart of ${cfg.name} for your last 7 entries`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,.08)" />
            <XAxis dataKey="d" />
            <YAxis domain={cfg.dom as [number, number]} />
            <Tooltip contentStyle={{ background: "#0a1230", border: "1px solid #00f0ff", fontFamily: "Space Mono" }} />
            {metric === "sleep" && <ReferenceLine y={6.5} stroke="#ff2a55" strokeDasharray="5 4" />}
            <Line type="monotone" dataKey={metric} name={cfg.name} stroke={cfg.color} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: cfg.color, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="hud-mono mt-2 flex flex-wrap justify-between border-t border-white/10 pt-2 text-[10.5px] text-slate-300"><span>7-entry mean sleep: <strong>{mean.toFixed(2)} h</strong></span><span>Entries: <strong>{rows.length}</strong></span><span>Your own demo entries</span></p>
    </div>
  );
}

// ---------- MOD-06 ----------
function Mod06({ beep, toast }: { beep: (f?: number, d?: number) => void; toast: (t: string, k?: Toast["kind"]) => void }) {
  const { data } = useStore();
  const ms = mentalSummary(data.moods);
  const ref = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState("Rules run on your entries whenever they change");
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const nodes = [[40, 35, 4], [120, 35, 4], [80, 75, 6], [35, 115, 4], [125, 115, 4]];
    let t = 0;
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      t += 0.03;
      ctx.strokeStyle = "rgba(0,240,255,.25)";
      nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }));
      nodes.forEach((n, i) => {
        ctx.fillStyle = `rgba(0,255,157,${Math.sin(t + i) * 0.3 + 0.7})`;
        ctx.beginPath();
        ctx.arc(n[0], n[1], n[2], 0, Math.PI * 2);
        ctx.fill();
      });
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  const insights = [
    { t: "STRESS PATTERN", tone: ms.stressAlert ? "amber" : "emerald", tag: ms.stressAlert ? "REVIEW" : "OK", d: ms.stressAlert ? `${ms.highStress} of your last 5 check-ins reported high stress. Take a break and consider talking to your crew medical officer.` : `${ms.highStress} of your last 5 check-ins reported high stress. No repeating pattern.` },
    { t: "SLEEP PATTERN", tone: ms.avgSleep < 6.5 ? "amber" : "emerald", tag: ms.avgSleep < 6.5 ? "SHORT" : "STEADY", d: `Average sleep ${ms.avgSleep.toFixed(1)} h over your last entries. ${ms.avgSleep < 6.5 ? "Protect your next sleep period." : "Keep a regular schedule."}` },
    { t: "FATIGUE LEVEL", tone: ms.avgFatigue >= 4 ? "amber" : "emerald", tag: ms.avgFatigue >= 4 ? "HIGH" : "OK", d: `Average fatigue ${ms.avgFatigue.toFixed(1)} out of 5.` },
  ] as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-[150px] w-[160px] shrink-0 overflow-hidden rounded-lg border border-cyan-400/25 bg-[rgba(5,9,24,.9)]">
          <canvas ref={ref} width={160} height={150} aria-hidden="true" />
          <span className="absolute inset-x-0 top-0 h-0.5 animate-[scan_2.5s_linear_infinite] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_10px_#00f0ff]" />
          <p className="hud-mono absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1.5 text-[8.5px] text-hud-emerald"><span className="pulse-dot" style={{ width: 6, height: 6 }} />RULE ENGINE (NO ML)</p>
        </div>
        <ul className="flex-1 space-y-2">
          {insights.map((i) => (
            <li key={i.t} className={`rounded-md border border-white/10 bg-[rgba(8,15,34,.75)] px-3 py-2 border-l-[3px] ${i.tone === "amber" ? "border-l-hud-amber" : "border-l-aegis-cyan"}`}>
              <p className="mb-0.5 flex items-center justify-between"><span className="hud-mono text-[9.5px] text-aegis-cyan">{i.t}</span><Pill tone={i.tone}>{i.tag}</Pill></p>
              <p className="text-[13px] leading-snug text-slate-300">{i.d}</p>
            </li>
          ))}
        </ul>
      </div>
      <button className={btnPrime} disabled={busy} onClick={() => { setBusy(true); beep(750, 0.2); setTimeout(() => { setBusy(false); setStamp(`Rules re-run at ${new Date().toLocaleTimeString()}`); toast(ms.stressAlert ? "Pattern check: stress pattern found. See the card." : "Pattern check: nothing concerning in your entries.", ms.stressAlert ? "alert" : "success"); }, 1200); }}>
        <Sparkles size={14} /> {busy ? "RUNNING RULES..." : "RE-RUN PATTERN CHECK"}
      </button>
      <p className="hud-mono text-[10px] text-slate-400">{stamp}. Simple threshold rules over your entries, not a machine-learning model and not a diagnosis.</p>
    </div>
  );
}

// ---------- MOD-07 ----------
function Mod07({ beep, toast }: { beep: (f?: number, d?: number) => void; toast: (t: string, k?: Toast["kind"]) => void }) {
  const [light, setLight] = useState<null | "warm" | "cool">(null);
  const [secs, setSecs] = useState(600);
  const [breath, setBreath] = useState(false);
  const [tone, setTone] = useState(false);
  useEffect(() => {
    if (!light) return;
    setSecs(600);
    const i = setInterval(() => setSecs((s) => (s <= 1 ? (setLight(null), 600) : s - 1)), 1000);
    return () => clearInterval(i);
  }, [light]);
  useEffect(() => {
    if (!tone) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const m = ctx.createChannelMerger(2);
    [432, 438].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(m, 0, i); o.start(); });
    m.connect(g).connect(ctx.destination);
    return () => { void ctx.close(); };
  }, [tone]);
  const row = (icon: ReactNode, glow: string, h: string, p: string, action: ReactNode) => (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[rgba(8,14,30,.7)] p-2.5 transition hover:border-cyan-400/35 hover:bg-[rgba(12,22,48,.85)]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${glow}`}>{icon}</span>
      <span className="flex-1"><span className="block text-[14.5px] font-bold text-white">{h}</span><span className="block text-[12px] leading-snug text-slate-400">{p}</span></span>
      {action}
    </div>
  );
  const act = "whitespace-nowrap rounded border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[12px] font-semibold text-aegis-cyan hover:bg-cyan-400/25 hover:text-white";
  return (
    <div className="space-y-2.5">
      {row(<Sparkles size={18} />, "border-sky-400 bg-sky-400/15 text-sky-200", "Screen light session", "A 10-minute full-screen warm or cool light. A relaxation aid only, no health effect claimed.", <span className="flex flex-col gap-1"><button className={act} onClick={() => { setLight("warm"); beep(650, 0.1); }}>Warm</button><button className={act} onClick={() => { setLight("cool"); beep(650, 0.1); }}>Cool</button></span>)}
      {row(<Volume2 size={18} />, "border-violet-400 bg-violet-400/15 text-violet-200", "Calm two-tone sound (432/438 Hz)", "Gentle relaxation sound for headphones. Not therapy. Keep the volume low.", <button className={act} aria-pressed={tone} onClick={() => setTone((t) => !t)}>{tone ? "Stop" : "Play"}</button>)}
      {row(<Wind size={18} />, "border-hud-emerald bg-emerald-400/15 text-hud-emerald", "4-7-8 breathing pacer", "Breathe in 4, hold 7, out 8, for 4 rounds. A simple calming routine.", <button className={act} onClick={() => setBreath(true)}>Start pacer</button>)}
      {row(<Globe2 size={18} />, "border-cyan-400 bg-cyan-400/15 text-cyan-200", "Look-out-the-window break", "Take 5 minutes to look at something far away. Rest your eyes and your mind.", <button className={act} onClick={() => { beep(780, 0.12); toast("Window break logged (this browser only).", "success"); }}>Log break</button>)}
      {light && (
        <Modal label="Screen light session" onClose={() => setLight(null)}>
          <div className="rounded-xl p-8 text-center text-slate-900" style={{ background: light === "warm" ? "linear-gradient(135deg,#ffb36b,#ff8a3d)" : "linear-gradient(135deg,#9be7ff,#5ab8ff)" }}>
            <h3 className="font-display font-bold">{light === "warm" ? "WARM WIND-DOWN LIGHT" : "COOL WAKE-UP LIGHT"}</h3>
            <p className="font-display my-4 text-4xl font-black">{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</p>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => setLight(null)}>Stop and close</button>
          </div>
        </Modal>
      )}
      {breath && <BreathModal onClose={() => setBreath(false)} beep={beep} />}
    </div>
  );
}

function BreathModal({ onClose, beep }: { onClose: () => void; beep: (f?: number, d?: number) => void }) {
  const [phase, setPhase] = useState<"INHALE" | "HOLD" | "EXHALE">("INHALE");
  const [sec, setSec] = useState(4);
  const [round, setRound] = useState(1);
  const st = useRef({ phase: "INHALE" as "INHALE" | "HOLD" | "EXHALE", sec: 4, round: 1 });
  useEffect(() => {
    const i = setInterval(() => {
      const s = st.current;
      s.sec -= 1;
      if (s.sec <= 0) {
        if (s.phase === "INHALE") { s.phase = "HOLD"; s.sec = 7; beep(440, 0.05); }
        else if (s.phase === "HOLD") { s.phase = "EXHALE"; s.sec = 8; beep(520, 0.05); }
        else if (s.round >= 4) { onClose(); return; }
        else { s.round += 1; s.phase = "INHALE"; s.sec = 4; beep(330, 0.05); }
      }
      setPhase(s.phase); setSec(s.sec); setRound(s.round);
    }, 1000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const big = phase !== "EXHALE";
  return (
    <Modal label="Breathing pacer" onClose={onClose}>
      <h3 className="font-display text-center text-sm font-bold text-white">4-7-8 BREATHING PACER</h3>
      <div className="mx-auto my-5 flex h-44 items-center justify-center">
        <div className="font-display flex items-center justify-center rounded-full border-2 border-aegis-cyan bg-cyan-400/10 text-sm font-bold text-white shadow-[0_0_25px_rgba(0,240,255,.35)] transition-all ease-in-out" style={{ width: big ? 160 : 80, height: big ? 160 : 80, transitionDuration: phase === "HOLD" ? "0s" : phase === "INHALE" ? "4s" : "8s" }}>{phase}</div>
      </div>
      <p className="hud-mono text-center text-sm text-slate-300" aria-live="polite">{sec}s - round {round} of 4</p>
      <button className={`${btnPrime} mt-4`} onClick={onClose}>CLOSE PACER</button>
    </Modal>
  );
}

// ---------- MOD-08 ----------
function SosModal({ onClose, onDone, beep }: { onClose: () => void; onDone: () => void; beep: (f?: number, d?: number, t?: OscillatorType) => void }) {
  const [n, setN] = useState(10);
  useEffect(() => {
    if (n <= 0) { onDone(); return; }
    if (n % 2 === 0) beep(900, 0.25, "sawtooth");
    const t = setTimeout(() => setN((x) => x - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  const C = 314;
  return (
    <Modal label="Practice SOS countdown" onClose={onClose} tone="red">
      <div className="text-center">
        <p className="hud-mono text-[10px] tracking-widest text-hud-crimson">PRACTICE ALERT - NOTHING IS SENT</p>
        <h3 className="font-display my-1 text-base font-black text-white">SOS PRACTICE SCREEN</h3>
        <p className="mx-auto mb-3 max-w-sm rounded-md border border-red-400/60 bg-red-500/15 p-2.5 text-[13px] text-slate-200">This only shows how an alert flow could feel. It does not contact anyone. In a real emergency follow your mission procedures and alert your crew medical officer.</p>
        <div className="relative mx-auto h-[120px] w-[120px]">
          <svg width="120" height="120" className="-rotate-90"><circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="8" /><circle cx="60" cy="60" r="50" fill="none" stroke="#ff2a55" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - n / 10)} style={{ transition: "stroke-dashoffset 1s linear" }} /></svg>
          <span className="font-display absolute inset-0 flex items-center justify-center text-4xl font-black text-white" aria-live="assertive">{n}</span>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button className={`${btnPrime} !from-slate-600 !to-slate-700 !border-slate-400`} autoFocus onClick={onClose}>CANCEL PRACTICE</button>
          <button className={`${btnPrime} !from-red-900 !to-hud-crimson !border-red-300`} onClick={onDone}>FINISH PRACTICE NOW</button>
        </div>
      </div>
    </Modal>
  );
}

function Mod08({ open }: { open: () => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 rounded-lg border border-hud-crimson bg-red-500/10 p-2.5">
        <Siren className="shrink-0 text-hud-crimson" size={24} />
        <div><p className="font-display text-[11px] font-bold text-hud-crimson">CRISIS PRACTICE SCREEN</p><p className="text-[13px] text-slate-300">A rehearsal of a 10-second alert countdown with a calm-down message. It contacts nobody.</p></div>
      </div>
      <button onClick={open} className="font-display flex w-full flex-col items-center gap-1 rounded-lg border-2 border-red-300 bg-gradient-to-br from-red-900 to-[#c41235] p-4 text-white shadow-[0_0_25px_rgba(255,42,85,.5)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,42,85,.85)]">
        <span className="text-[15px] font-black tracking-wider">OPEN SOS PRACTICE SCREEN</span>
        <span className="hud-mono text-[10px] font-normal opacity-90">Simulation only - no message is transmitted</span>
      </button>
      <ul className="hud-mono mt-3 space-y-1 text-[10.5px] text-slate-400">
        <li>- Step 1: loud countdown with a siren tone (audio can be muted)</li>
        <li>- Step 2: warm calming message and a reminder to alert a real person</li>
        <li>- Step 3: the practice is logged as a simulated packet in the queue</li>
      </ul>
    </div>
  );
}

// ---------- MOD-09 ----------
function randHex(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()).join(" ");
}
function Mod09({ q, setQ, blackout, setBlackout, toast, beep }: { q: Pkt[]; setQ: React.Dispatch<React.SetStateAction<Pkt[]>>; blackout: boolean; setBlackout: (b: boolean) => void; toast: (t: string, k?: Toast["kind"]) => void; beep: (f?: number, d?: number) => void }) {
  const { data } = useStore();
  const ms = missionStatus(data);
  const [hex, setHex] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const flush = () => {
    if (blackout) { toast("Held: simulated blackout. Packets stay in the offline queue.", "alert"); return; }
    setBusy(true); beep(800, 0.15);
    setTimeout(() => { setQ((p) => p.map((x) => ({ ...x, status: "sent" }))); setBusy(false); toast("Simulated transmission complete. Nothing left this browser.", "success"); }, 1200);
  };
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 hud-mono text-[10.5px] text-slate-300">
        <span>QUEUE: <strong className="text-aegis-cyan">{q.length} PACKETS</strong> &nbsp; DELAY: <strong className="text-aegis-cyan">~{ms.oneWayMin} MIN</strong></span>
        <button aria-pressed={blackout} onClick={() => { setBlackout(!blackout); toast(blackout ? "Simulated link restored." : "Simulated blackout: packets are buffered offline.", blackout ? "success" : "alert"); beep(blackout ? 700 : 300, 0.1); }} className={`rounded border px-2 py-1 text-[10px] ${blackout ? "border-hud-crimson bg-red-500/20 text-hud-crimson" : "border-white/15 bg-white/5 text-slate-300"}`}>{blackout ? "BLACKOUT ACTIVE" : "TOGGLE BLACKOUT"}</button>
      </div>
      <ul className="mb-3 max-h-56 space-y-1.5 overflow-auto" aria-live="polite">
        {q.map((p) => (
          <li key={p.id} className="hud-mono flex items-center gap-2.5 rounded-md border border-white/10 bg-[rgba(7,13,29,.85)] px-2.5 py-2">
            <Radio size={15} className="shrink-0 text-aegis-cyan" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-white">{p.name}</span><span className="block text-[9px] text-slate-500">Size: {p.size} - Priority: {p.prio} - placeholder data</span></span>
            <Pill tone={p.status === "sent" ? "emerald" : blackout ? "amber" : "cyan"}>{p.status === "sent" ? "SENT (SIM)" : blackout ? "HELD" : "QUEUED"}</Pill>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button className={`${btn} flex-1`} disabled={busy} onClick={flush}>{busy ? "Sending (simulated)..." : "Flush queue (simulated)"}</button>
        <button className={btn} onClick={() => setHex(randHex(16) + "\n" + randHex(16) + "\n" + randHex(16))}>Hex view</button>
      </div>
      {hex && (
        <Modal label="Packet byte viewer" onClose={() => setHex(null)}>
          <h3 className="font-display mb-2 text-sm font-bold text-aegis-cyan">PACKET BYTE VIEWER</h3>
          <pre className="hud-mono overflow-auto rounded-md bg-black/50 p-3 text-[11px] leading-6 text-hud-emerald">{hex}</pre>
          <p className="mt-2 text-xs text-slate-400">Random placeholder bytes. Not real telemetry and not a real packet format.</p>
          <button className={`${btnPrime} mt-3`} onClick={() => setHex(null)}>CLOSE</button>
        </Modal>
      )}
    </div>
  );
}

// ---------- Ground view (MOD-10) ----------
function Ecg() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const pts: number[] = [];
    const max = 220;
    let t = 0;
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      ctx.fillStyle = "#02050e";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "rgba(0,240,255,.12)";
      for (let x = 0; x < c.width; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke(); }
      for (let y = 0; y < c.height; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke(); }
      t += 0.08;
      const b = t % (Math.PI * 2);
      let y = c.height / 2;
      if (b > 1.2 && b < 1.6) y -= Math.sin((b - 1.2) * (Math.PI / 0.4)) * 8;
      else if (b >= 1.8 && b < 2.2) { const q = (b - 1.8) / 0.4; y += q < 0.25 ? 6 : q < 0.6 ? -55 : 16; }
      else if (b > 2.6 && b < 3.2) y -= Math.sin((b - 2.6) * (Math.PI / 0.6)) * 14;
      pts.push(y);
      if (pts.length > max) pts.shift();
      ctx.strokeStyle = "#00ff9d";
      ctx.lineWidth = 2.2;
      ctx.shadowColor = "#00ff9d";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      pts.forEach((v, i) => (i ? ctx.lineTo((i * c.width) / max, v) : ctx.moveTo(0, v)));
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={700} height={130} className="h-[130px] w-full rounded-md border border-cyan-400/25" role="img" aria-label="Synthetic heartbeat-like wave drawn by a script. Not real data." />;
}

function Ground({ toast, beep }: { toast: (t: string, k?: Toast["kind"]) => void; beep: (f?: number, d?: number) => void }) {
  const { data } = useStore();
  const latest = [...data.vitals].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const ms = mentalSummary(data.moods);
  const crew = [
    { name: data.profile.name || "You", role: `${data.profile.role || "Your profile"} - from your entries`, hr: latest?.heartRate ?? 72, spo2: latest?.spo2 ?? 98, idx: ms.score, tag: ms.status === "nominal" ? "WITHIN DEMO RANGE" : ms.status === "watch" ? "KEEP AN EYE" : "REVIEW SUGGESTED", tone: ms.status === "nominal" ? "emerald" : "amber", you: true },
    { name: "Crew A", role: "Fictional crew member", hr: 68, spo2: 99, idx: 96, tag: "WITHIN DEMO RANGE", tone: "emerald", you: false },
    { name: "Crew B", role: "Fictional crew member", hr: 74, spo2: 98, idx: 91, tag: "WITHIN DEMO RANGE", tone: "emerald", you: false },
    { name: "Crew C", role: "Fictional crew member", hr: 82, spo2: 97, idx: 83, tag: "REST SUGGESTED", tone: "amber", you: false },
  ] as const;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-400/30 bg-[rgba(11,22,50,.85)] p-4">
        <div className="flex items-center gap-3.5"><Globe2 size={34} className="text-aegis-cyan" /><div><p className="hud-mono text-[10px] tracking-widest text-aegis-cyan">MOCK GROUND VIEW - FICTIONAL EXAMPLE</p><h2 className="font-display text-lg font-extrabold text-white">GROUND MEDICAL VIEW (SIMULATION)</h2></div></div>
        <div className="flex items-center gap-3"><span className="hud-mono flex items-center gap-2 rounded-md border border-emerald-400/50 bg-emerald-400/10 px-3 py-1 text-[11px] text-hud-emerald"><span className="pulse-dot" /> SIMULATED LINK</span><button className={btn} onClick={() => window.print()}>Print summary</button></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {crew.map((c) => (
          <article key={c.name} className={`glass flex flex-col gap-2.5 p-3.5 ${c.you ? "!border-cyan-400/60 shadow-[0_0_20px_rgba(0,240,255,.2)]" : ""}`}>
            <div className="flex items-center gap-2.5"><Smile size={26} className="text-aegis-cyan" /><div className="flex-1"><h3 className="font-display text-sm font-bold text-white">{c.name}</h3><p className="hud-mono text-[9.5px] text-slate-400">{c.role}</p></div></div>
            <p><Pill tone={c.tone}>{c.tag}</Pill></p>
            <div className="grid grid-cols-2 gap-1.5 rounded-md bg-[rgba(5,9,22,.7)] p-2">
              <p><span className="hud-mono block text-[8.5px] text-slate-500">HEART RATE</span><span className="font-display text-[13.5px] font-bold text-white">{c.hr} <small className="text-[9px] text-slate-400">BPM</small></span></p>
              <p><span className="hud-mono block text-[8.5px] text-slate-500">OXYGEN</span><span className="font-display text-[13.5px] font-bold text-white">{c.spo2}%</span></p>
            </div>
            <div><p className="hud-mono flex justify-between text-[9.5px] text-slate-400"><span>Wellbeing index (demo)</span><strong>{c.idx} / 100</strong></p><div className="mt-1 h-1.5 rounded bg-white/10"><div className={`h-full rounded ${c.tone === "emerald" ? "bg-hud-emerald" : "bg-hud-amber"}`} style={{ width: `${c.idx}%` }} /></div></div>
            <button className="rounded border border-white/15 bg-white/5 py-1 text-[12px] text-slate-300 hover:bg-cyan-400/15 hover:text-white" onClick={() => { beep(620); toast(`Message to ${c.name} drafted (simulated, not sent).`, "info"); }}>Draft message</button>
          </article>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Panel title="Synthetic wave" icon={<Activity size={16} />} action={<span className="hud-mono text-[9.5px] text-slate-500">SCRIPT-DRAWN, NOT REAL</span>}>
          <Ecg />
          <p className="mt-2 text-xs text-slate-400">A decorative wave drawn by a script. No sensor is connected and it is not an ECG.</p>
        </Panel>
        <Panel title="Suggestions (simulated)" icon={<Zap size={16} />}>
          <p className="mb-3 text-[13px] text-slate-300">Examples of ground-to-crew suggestions. Buttons only show a message here. Nothing is transmitted.</p>
          <div className="space-y-2">
            {["Suggest a 1-hour sleep extension", "Suggest a light-schedule change", "Suggest a family call slot"].map((t) => (
              <button key={t} onClick={() => { beep(640); toast(`${t}: simulated, not sent.`, "info"); }} className="block w-full rounded border border-hud-emerald bg-emerald-400/10 px-3 py-2 text-left text-[12.5px] font-bold text-hud-emerald hover:bg-emerald-400/25">{t}</button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------- Checklist view ----------
const MODS: [string, string, string, string][] = [
  ["MOD-01", "Animated astro companion", "Illustrated astronaut with four moods, speech, jokes and a zero-g float.", "hab"],
  ["MOD-02", "Daily wellbeing check-in", "Feeling pad, sliders, private log. Commit saves a real entry in your browser.", "hab"],
  ["MOD-03", "Funny interactive questions", "Icebreakers, crew banter and a fun morale gauge.", "hab"],
  ["MOD-04", "Sleep and fatigue", "Tiles from your entries plus a 1-tap reaction game.", "hab"],
  ["MOD-05", "7-day trend chart", "Sleep, fatigue and wellbeing from your last 7 entries.", "hab"],
  ["MOD-06", "Pattern detection", "Threshold rules over your entries. No machine learning.", "hab"],
  ["MOD-07", "Prevention tools", "Screen light, calm tone and a 4-7-8 breathing pacer.", "hab"],
  ["MOD-08", "SOS practice screen", "10-second countdown rehearsal. Contacts nobody.", "hab"],
  ["MOD-09", "Offline queue", "Simulated delay-tolerant queue, blackout toggle, byte viewer.", "hab"],
  ["MOD-10", "Mock ground view", "Fictional crew cards plus your own, with a script-drawn wave.", "ground"],
];
function Checklist({ go }: { go: (v: View, id?: string) => void }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/25 pb-4">
        <div><p className="hud-mono text-[11px] text-slate-500">TEAM AEGIS - NASA SPACE APPS 2026 PROTOTYPE</p><h2 className="font-display text-xl font-black text-white">C.O.S.M.I.C. AEGIS - MODULE CHECKLIST</h2><p className="text-sm text-slate-300">Which prototype modules are built and working in this demo. Not a certification.</p></div>
        <div className="rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-5 py-3 text-center"><p className="font-display text-2xl font-black sm:text-3xl text-white">10 / 10</p><p className="font-display text-xs font-bold text-hud-emerald">BUILT (SIMULATED)</p></div>
      </div>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {MODS.map(([id, t, d, v], i) => (
          <li key={id} className="flex gap-3 rounded-lg border border-white/10 bg-[rgba(9,16,34,.6)] p-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-hud-emerald bg-emerald-400/15 text-hud-emerald">&#10003;</span>
            <span className="flex-1"><span className="flex items-center justify-between gap-2"><strong className="font-display text-[14px] text-white">{i + 1}. {t}</strong><Pill>BUILT</Pill></span><span className="mt-1 block text-[13.5px] text-slate-300">{d}</span><button className="mt-2 text-xs font-semibold text-aegis-cyan underline" onClick={() => go(v as View, id)}>Jump to module</button></span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm text-slate-300">"Built" means the screen exists and works in the browser with simulated or locally saved data. It does not mean tested with astronauts, validated, certified or endorsed by any agency. AEGIS is not a medical device.</p>
    </Panel>
  );
}

// ---------- page ----------
export default function Console() {
  const [params, setParams] = useSearchParams();
  const view = (["hab", "ground", "checklist"].includes(params.get("view") ?? "") ? params.get("view") : "hab") as View;
  const { on, setOn, beep } = useAudio();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sos, setSos] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [q, setQ] = useState<Pkt[]>([
    { id: 1, name: "SIM_VITALS_STREAM", size: "4.2 MB", prio: "P1", status: "queued" },
    { id: 2, name: "SIM_CHECKIN_SUMMARY", size: "1.1 MB", prio: "P0", status: "queued" },
    { id: 3, name: "SIM_SLEEP_LOG", size: "18.5 MB", prio: "P2", status: "sent" },
  ]);
  const { data } = useStore();
  const ms = mentalSummary(data.moods);
  const [, setZen] = useState(false);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const addPkt = (name: string, size: string, prio: string) => setQ((p) => [{ id: Date.now(), name, size, prio, status: "queued" as const }, ...p].slice(0, 8));
  const go = (v: View, id?: string) => {
    setParams(v === "hab" ? {} : { view: v });
    setTimeout(() => (id ? document.getElementById(id)?.scrollIntoView({ block: "center", behavior: "smooth" }) : window.scrollTo(0, 0)), 100);
  };
  useEffect(() => {
    if (params.get("sos") === "1") {
      setSos(true);
      setParams(params.get("view") ? { view: params.get("view")! } : {}, { replace: true });
    }
  }, [params, setParams]);

  const tabs: [View, string, ReactNode][] = [["hab", "Habitat console", <Smile key="a" size={15} />], ["ground", "Mock ground view", <Globe2 key="b" size={15} />], ["checklist", "Module checklist (10/10)", <ClipboardCheck key="c" size={15} />]];
  const ov = overall(data);
  const stCol = ov.status === "nominal" ? "#00ff9d" : ov.status === "watch" ? "#ffb020" : "#ff6b8b";
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0a1a3d]/90 via-[#0b1230]/90 to-[#2a1050]/80 p-5 sm:p-7">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <img src="/logo.png" alt="C.O.S.M.I.C. AEGIS logo" width={120} height={120} className="animate-[drift_5s_ease-in-out_infinite] rounded-full shadow-[0_0_35px_rgba(0,240,255,.45)]" />
            <div>
              <p className="hud-mono text-[11px] tracking-[0.3em] text-aegis-cyan">TEAM AEGIS &bull; NASA SPACE APPS 2026</p>
              <h1 className="font-display text-2xl font-black sm:text-3xl leading-tight text-white sm:text-4xl">C.O.S.M.I.C. <span className="hud-glow">AEGIS</span></h1>
              <p className="mt-1 text-lg font-medium text-slate-200">Understand your health beyond Earth</p>
              <p className="mt-1 text-sm text-slate-400">Mental health, muscle and bone, and cardiovascular awareness in one calm console. Simulated demo data.</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-3 gap-3 lg:w-auto">
            <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-3 text-center sm:px-4"><p className="hud-mono text-[9.5px] text-slate-400">OVERALL (DEMO)</p><p className="font-display text-2xl font-black sm:text-3xl" style={{ color: stCol, textShadow: `0 0 14px ${stCol}88` }}>{ov.score}</p></div>
            <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-3 text-center sm:px-4"><p className="hud-mono text-[9.5px] text-slate-400">MENTAL</p><p className="font-display text-2xl font-black sm:text-3xl text-violet-300">{ov.mental.score}</p></div>
            <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-3 text-center sm:px-4"><p className="hud-mono text-[9.5px] text-slate-400">MODULES</p><p className="font-display text-2xl font-black sm:text-3xl text-hud-emerald">10/10</p></div>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2.5">
          <Link to="/dashboard" className="rounded-lg border border-aegis-cyan bg-cyan-400/15 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-400/30">Open dashboard</Link>
          <Link to="/mental" className="rounded-lg border border-violet-400/50 bg-violet-400/10 px-4 py-2 text-sm font-bold text-violet-100 hover:bg-violet-400/25">Mental check-in</Link>
          <Link to="/cardiovascular" className="rounded-lg border border-rose-400/50 bg-rose-400/10 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-400/25">Heart readings</Link>
          <button onClick={() => setSos(true)} className="rounded-lg border border-red-400 bg-red-500/15 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-500/30">SOS practice</button>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Console views" className="flex flex-wrap gap-2">
          {tabs.map(([v, l, ic]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => { go(v); beep(520, 0.05); }} className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13.5px] font-semibold tracking-wide transition ${view === v ? "border-aegis-cyan bg-gradient-to-r from-cyan-400/20 to-blue-800/40 text-white shadow-[0_0_14px_rgba(0,240,255,.25)]" : "border-white/10 text-slate-400 hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-white"}`}>{ic}{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <DemoBadge text="SIMULATED PROTOTYPE" />
          <button className={btn} aria-pressed={on} onClick={() => setOn(!on)}>{on ? <Volume2 size={14} className="mr-1 inline" /> : <VolumeX size={14} className="mr-1 inline" />}{on ? "AUDIO ON" : "MUTED"}</button>
        </div>
      </div>

      {view === "hab" && (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_1.35fr_1fr]">
          <div className="space-y-5">
            <div id="MOD-01"><Panel mod="MOD-01" title="Animated astro companion" icon={<Smile size={16} />} action={<Pill>BUILT</Pill>}><Mod01 ms={ms} setZenExt={setZen} /></Panel></div>
            <div id="MOD-02"><Panel mod="MOD-02" title="Daily wellbeing check-in" icon={<Brain size={16} />} action={<Pill>BUILT</Pill>}><Mod02 onCommit={() => { beep(780, 0.12); toast("Check-in saved to this browser and queued as a simulated packet.", "success"); addPkt(`SIM_CHECKIN_${String(Date.now()).slice(-4)}`, "1.3 MB", "P0"); }} /></Panel></div>
            <div id="MOD-03"><Panel mod="MOD-03" title="Funny interactive questions" icon={<Smile size={16} />} action={<Pill>BUILT</Pill>}><Mod03 beep={beep} toast={toast} /></Panel></div>
          </div>
          <div className="space-y-5">
            <div id="MOD-04"><Panel mod="MOD-04" title="Sleep and fatigue" icon={<Moon size={16} />} action={<Pill>BUILT</Pill>}><Mod04 beep={beep} toast={toast} /></Panel></div>
            <div id="MOD-05"><Panel mod="MOD-05" title="7-day trend chart" icon={<Activity size={16} />} action={<Pill>BUILT</Pill>}><Mod05 /></Panel></div>
            <div id="MOD-06"><Panel mod="MOD-06" title="Pattern detection" icon={<Zap size={16} />} action={<Pill>BUILT</Pill>}><Mod06 beep={beep} toast={toast} /></Panel></div>
          </div>
          <div className="space-y-5">
            <div id="MOD-07"><Panel mod="MOD-07" title="Prevention tools" icon={<Wind size={16} />} action={<Pill>BUILT</Pill>}><Mod07 beep={beep} toast={toast} /></Panel></div>
            <div id="MOD-08"><Panel mod="MOD-08" title="SOS practice screen" icon={<Siren size={16} />} action={<Pill>BUILT</Pill>}><Mod08 open={() => setSos(true)} /></Panel></div>
            <div id="MOD-09"><Panel mod="MOD-09" title="Offline queue" icon={<Radio size={16} />} action={<Pill>BUILT</Pill>}><Mod09 q={q} setQ={setQ} blackout={blackout} setBlackout={setBlackout} toast={toast} beep={beep} /></Panel></div>
          </div>
        </div>
      )}
      {view === "ground" && <div id="MOD-10"><Ground toast={toast} beep={beep} /></div>}
      {view === "checklist" && <Checklist go={go} />}

      {sos && <SosModal beep={beep} onClose={() => { setSos(false); toast("Practice cancelled.", "info"); }} onDone={() => { setSos(false); toast("Practice finished. No message was sent to anyone.", "success"); addPkt("SIM_SOS_PRACTICE", "0.4 MB", "P0"); }} />}
      <Disclaimer />
      <div aria-live="polite" className="pointer-events-none fixed bottom-20 right-4 z-[80] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg border px-3.5 py-2.5 text-[13.5px] shadow-lg backdrop-blur ${t.kind === "alert" ? "border-hud-crimson bg-red-950/90 text-red-100" : t.kind === "success" ? "border-hud-emerald bg-emerald-950/90 text-emerald-100" : "border-aegis-cyan bg-slate-900/90 text-slate-100"}`}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
