import { useEffect, useRef, useState } from "react";
import { Bot, Brain, Dumbbell, HeartPulse, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { speakLines, speechSupported, stopSpeech } from "../lib/speech";

// A 30-second animated explainer for first-time visitors. Narration uses the browser's built-in voice;
// captions are always shown, so it also works muted.
const SCENES = [
  { dur: 6, tag: "THE PROBLEM", text: "On long space missions, help can be many minutes away." },
  { dur: 6, tag: "WHY IT MATTERS", text: "Space changes the mind, the muscles, the bones and the heart. Crews need early, calm awareness." },
  { dur: 5, tag: "OUR IDEA", text: "Our answer is C.O.S.M.I.C. AEGIS, one calm console for astronaut health." },
  { dur: 8, tag: "WHAT WE BUILT", text: "Log how you feel, follow your trends, get gentle alerts, calm down with the companion, and hear personal guidance from me." },
  { dur: 5, tag: "GOOD TO KNOW", text: "Everything here is simulated, and it is not a medical device. Explore, or ask me anything. Team AEGIS." },
];
const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);

function Visual({ i }: { i: number }) {
  if (i === 0)
    return (
      <div className="relative h-full w-full">
        <div className="absolute left-[8%] top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-gradient-to-br from-sky-300 via-blue-500 to-blue-900 shadow-[0_0_40px_rgba(56,189,248,.6)] sm:h-32 sm:w-32" />
        <span className="hud-mono absolute left-[8%] top-[calc(50%+4.5rem)] text-[10px] text-sky-300 sm:top-[calc(50%+5rem)]">EARTH</span>
        <div className="absolute left-[26%] top-1/2 h-px w-[60%] border-t-2 border-dashed border-cyan-400/50" />
        <img src="/logo.png" alt="" width={56} height={56} className="absolute top-1/2 h-14 w-14 -translate-y-1/2 rounded-full shadow-[0_0_20px_rgba(0,240,255,.6)] [animation:flyAway_5.5s_ease-in-out_forwards]" />
        <div className="hud-mono absolute right-[6%] top-[14%] rounded-md border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-center">
          <p className="text-[9px] text-amber-300">SIGNAL DELAY (ILLUSTRATION)</p>
          <p className="font-display text-2xl font-black text-hud-amber [animation:blink_1s_steps(2)_infinite]">00:14 min</p>
        </div>
      </div>
    );
  if (i === 1)
    return (
      <div className="flex h-full w-full items-center justify-center gap-5 sm:gap-10">
        {[
          { Icon: Brain, c: "#a78bfa", l: "MIND", d: "0s" },
          { Icon: Dumbbell, c: "#ffb020", l: "MUSCLE & BONE", d: ".5s" },
          { Icon: HeartPulse, c: "#ff6b8b", l: "HEART", d: "1s" },
        ].map(({ Icon, c, l, d }) => (
          <div key={l} className="flex flex-col items-center gap-2 [animation:popIn_.6s_both]" style={{ animationDelay: d }}>
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 sm:h-24 sm:w-24" style={{ borderColor: c, color: c, boxShadow: `0 0 28px ${c}88`, animation: "pulseRing 1.6s ease-in-out infinite" }}>
              <Icon size={38} />
            </span>
            <span className="hud-mono text-[10px] font-bold tracking-wider sm:text-xs" style={{ color: c }}>{l}</span>
          </div>
        ))}
      </div>
    );
  if (i === 2)
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
        <img src="/logo.png" alt="" width={110} height={110} className="rounded-full shadow-[0_0_45px_rgba(0,240,255,.6)] [animation:zoomIn_1s_both]" />
        <p className="font-display text-2xl font-black text-white [animation:fadeUp_.8s_.5s_both] sm:text-3xl">C.O.S.M.I.C. <span className="hud-glow">AEGIS</span></p>
        <p className="text-sm text-slate-300 [animation:fadeUp_.8s_1s_both]">Understand your health beyond Earth</p>
      </div>
    );
  if (i === 3) {
    const cards = [
      ["Daily check-in", "#a78bfa"], ["Trend charts", "#38bdf8"], ["Gentle alerts", "#ffb020"],
      ["Astro companion", "#00ff9d"], ["SOS practice", "#ff6b8b"], ["Voice guidance", "#00f0ff"],
    ];
    return (
      <div className="grid h-full w-full grid-cols-2 content-center gap-2.5 px-2 sm:grid-cols-3 sm:gap-3 sm:px-6">
        {cards.map(([t, c], k) => (
          <div key={t} className="rounded-lg border bg-black/30 px-3 py-3 text-center [animation:slideIn_.5s_both]" style={{ borderColor: `${c}88`, animationDelay: `${k * 0.45}s`, boxShadow: `0 0 16px ${c}33` }}>
            <p className="font-display text-xs font-bold sm:text-sm" style={{ color: c }}>{t}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex flex-wrap justify-center gap-2 [animation:fadeUp_.7s_both]">
        {["SIMULATED DATA", "NOT A MEDICAL DEVICE", "NOT NASA-ENDORSED"].map((t) => (
          <span key={t} className="hud-mono rounded-full border border-emerald-400/50 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold text-hud-emerald sm:text-xs">{t}</span>
        ))}
      </div>
      <p className="font-display text-xl font-black text-white [animation:fadeUp_.8s_.6s_both] sm:text-2xl">Team <span className="hud-glow">AEGIS</span></p>
      <p className="flex items-center gap-2 text-sm text-slate-300 [animation:fadeUp_.8s_1.1s_both]"><Bot size={16} className="text-aegis-cyan" /> Ask the assistant anything</p>
    </div>
  );
}

export default function Story() {
  const [phase, setPhase] = useState<"idle" | "playing" | "paused" | "done">("idle");
  const [scene, setScene] = useState(0);
  const [t, setT] = useState(0); // ms into the current scene
  const [voice, setVoice] = useState(speechSupported);
  const speechDone = useRef(true);

  // start narration whenever a scene starts playing
  useEffect(() => {
    if (phase !== "playing") return;
    if (voice && speechSupported) {
      speechDone.current = false;
      speakLines([SCENES[scene].text], undefined, () => { speechDone.current = true; });
    } else speechDone.current = true;
    return () => stopSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const i = setInterval(() => {
      setT((x) => {
        const n = x + 100;
        if (n >= SCENES[scene].dur * 1000 && speechDone.current) {
          if (scene >= SCENES.length - 1) setPhase("done");
          else setScene(scene + 1);
          return 0;
        }
        return n;
      });
    }, 100);
    return () => clearInterval(i);
  }, [phase, scene]);

  useEffect(() => () => stopSpeech(), []);

  const start = () => { setScene(0); setT(0); setPhase("playing"); };
  const elapsed = SCENES.slice(0, scene).reduce((a, s) => a + s.dur, 0) * 1000 + Math.min(t, SCENES[scene].dur * 1000);
  const pct = phase === "done" ? 100 : phase === "idle" ? 0 : Math.min(100, (elapsed / (TOTAL * 1000)) * 100);
  const s = SCENES[scene];

  return (
    <section className="glass overflow-hidden !border-t-2 !border-t-violet-400 p-0" aria-label="30-second story">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
        <h2 className="font-display flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white"><Play size={15} className="text-violet-300" /> New here? Watch the 30-second story</h2>
        <div className="flex items-center gap-2">
          {speechSupported && (
            <button onClick={() => { if (voice) stopSpeech(); setVoice((v) => !v); }} aria-pressed={voice} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${voice ? "border-aegis-cyan bg-cyan-400/15 text-white" : "border-white/15 text-slate-400"}`}>
              {voice ? <Volume2 size={14} /> : <VolumeX size={14} />} Voice {voice ? "on" : "off"}
            </button>
          )}
        </div>
      </div>

      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#0d1f4a,#050814_70%)] sm:aspect-video">
        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
            <img src="/logo.png" alt="" width={90} height={90} className="rounded-full shadow-[0_0_35px_rgba(0,240,255,.5)]" />
            <p className="max-w-md px-4 text-slate-200">The problem, our idea and what we built, explained by the AEGIS assistant in 30 seconds.</p>
            <button onClick={start} className="font-display flex items-center gap-2 rounded-full border border-cyan-300 bg-gradient-to-r from-[#00b4d8] to-[#7c3aed] px-6 py-3 text-sm font-bold tracking-wider text-white shadow-[0_0_24px_rgba(0,180,216,.5)] hover:scale-105"><Play size={18} /> PLAY STORY</button>
          </div>
        )}
        {phase !== "idle" && phase !== "done" && (
          <>
            <div key={scene} className="absolute inset-0 pb-24"><Visual i={scene} /></div>
            <p className="hud-mono absolute left-4 top-3 rounded border border-violet-400/50 bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-violet-200">{scene + 1}/5 &bull; {s.tag}</p>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-8">
              <p key={`c${scene}`} className="mx-auto max-w-2xl text-center text-[15px] font-semibold leading-snug text-white [animation:fadeUp_.5s_both] sm:text-lg" aria-live="polite">{s.text}</p>
            </div>
          </>
        )}
        {phase === "done" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
            <p className="font-display text-xl font-black text-white">That is the idea. Now try it.</p>
            <p className="max-w-md px-4 text-sm text-slate-300">Scroll down to the console, press the assistant button, or open the dashboard.</p>
            <button onClick={start} className="flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-400/15 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-400/30"><RotateCcw size={16} /> Watch again</button>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-200" style={{ width: `${pct}%` }} /></div>
      </div>

      {(phase === "playing" || phase === "paused") && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2">
          <button onClick={() => { if (phase === "playing") { stopSpeech(); setT(0); setPhase("paused"); } else setPhase("playing"); }} className="flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/10">
            {phase === "playing" ? <Pause size={14} /> : <Play size={14} />} {phase === "playing" ? "Pause" : "Resume scene"}
          </button>
          <p className="hud-mono text-[10px] text-slate-400">{Math.round(elapsed / 1000)}s / ~{TOTAL}s</p>
        </div>
      )}
    </section>
  );
}
