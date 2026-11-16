import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
const AstraChat = lazy(() => import("./AstraChat"));

const GREETINGS = ["Hi! I'm ASTRA 👋", "Need a health check?", "Ask me about your heart rate", "Try the body scan!", "Space weather today?", "Click me to chat"];

/** Floating anime-style robot: glides with scroll, tilts and spins on fast scrolls, eyes follow the pointer,
 *  blinks, waves, hovers on a thruster flame, chirps speech bubbles, hops when clicked. Opens the ASTRA chat.
 *  All motion is switched off for reduced-motion users. */
export default function AstraRobot() {
  const [open, setOpen] = useState(false), [y, setY] = useState(0), [tilt, setTilt] = useState(0), [spin, setSpin] = useState(0), [wave, setWave] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 }), [bubble, setBubble] = useState<string | null>(GREETINGS[0]), [hop, setHop] = useState(false), [hover, setHover] = useState(false);
  const last = useRef(0), reduce = useRef(false), box = useRef<HTMLButtonElement>(null), gi = useRef(0), spinDeg = useRef(0);

  useEffect(() => {
    reduce.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let t = 0, idle = 0;
    const onScroll = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1), sy = window.scrollY;
      setY(Math.max(0, (sy / max) * (window.innerHeight - 240)));
      const dv = sy - last.current; last.current = sy;
      const v = Math.max(-1, Math.min(1, dv / 40));
      if (!reduce.current) {
        setTilt(v * 20);
        if (Math.abs(dv) > 160) { spinDeg.current += dv > 0 ? 360 : -360; setSpin(spinDeg.current); } // barrel roll on a fast scroll
        setWave(true); clearTimeout(t); t = window.setTimeout(() => { setWave(false); setTilt(0); }, 450);
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = box.current?.getBoundingClientRect(); if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
      setLook({ x: (dx / d) * 2.6, y: (dy / d) * 2.6 });     // pupils track the pointer
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    if (!reduce.current) window.addEventListener("pointermove", onMove, { passive: true });
    // chirp a new speech bubble every few seconds when idle
    idle = window.setInterval(() => { if (document.hidden) return; gi.current = (gi.current + 1) % GREETINGS.length; setBubble(GREETINGS[gi.current]); setWave(true); window.setTimeout(() => { setBubble(null); setWave(false); }, 3200); }, 9000);
    const first = window.setTimeout(() => setBubble(null), 4000);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("pointermove", onMove); clearTimeout(t); clearInterval(idle); clearTimeout(first); };
  }, []);

  const moving = !reduce.current;
  return (
    <>
      {open && (
        <div role="dialog" aria-label="ASTRA chat" className="fixed bottom-4 right-4 z-50 w-[min(92vw,26rem)] rounded-2xl border border-cyan-400/40 bg-[rgba(6,11,24,0.96)] p-4 shadow-[0_10px_40px_rgba(0,0,0,.7)] backdrop-blur">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-sm font-bold text-white">ASTRA · health assistant</h2><button aria-label="Close chat" className="rounded p-1 text-slate-300 hover:bg-white/10" onClick={() => setOpen(false)}><X size={16} /></button></div>
          <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}><AstraChat maxH="max-h-[45vh]" /></Suspense>
        </div>
      )}
      <button ref={box} aria-label="Open ASTRA, the health assistant" title="ASTRA: click to chat" aria-expanded={open}
        onClick={() => { setOpen(o => !o); if (moving) { setHop(true); setTimeout(() => setHop(false), 600); } setBubble(null); }}
        onPointerEnter={() => { setHover(true); setBubble("Hello! Click to chat 💬"); }} onPointerLeave={() => { setHover(false); setBubble(null); }}
        className="fixed right-3 z-40 select-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        style={{ top: 90, transform: `translateY(${y}px)`, transition: moving ? "transform .8s cubic-bezier(.2,.8,.2,1)" : "none" }}>
        <style>{`
          @keyframes ar-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
          @keyframes ar-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
          @keyframes ar-wave{0%,100%{transform:rotate(0)}25%{transform:rotate(-55deg)}75%{transform:rotate(-20deg)}}
          @keyframes ar-flame{0%,100%{transform:scaleY(1);opacity:.9}50%{transform:scaleY(1.7);opacity:.55}}
          @keyframes ar-ant{0%,100%{fill:#ff6b8b;r:4}50%{fill:#fff;r:6}}
          @keyframes ar-beat{0%,100%{transform:scale(1)}15%{transform:scale(1.35)}30%{transform:scale(1)}}
          @keyframes ar-hop{0%{transform:translateY(0)}40%{transform:translateY(-26px) rotate(-8deg)}100%{transform:translateY(0)}}
          @keyframes ar-ring{0%{transform:scale(.6);opacity:.7}100%{transform:scale(1.5);opacity:0}}
          @keyframes ar-pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
          .ar-body{animation:ar-bob 2.2s ease-in-out infinite}
          .ar-eye{transform-box:fill-box;transform-origin:center;animation:ar-blink 3.6s infinite}
          .ar-flame{transform-box:fill-box;transform-origin:top center;animation:ar-flame .35s ease-in-out infinite}
          .ar-ant{animation:ar-ant 1.2s ease-in-out infinite}
          .ar-beat{transform-box:fill-box;transform-origin:center;animation:ar-beat 1.1s ease-in-out infinite}
          .ar-ring{transform-box:fill-box;transform-origin:center;animation:ar-ring 2.4s ease-out infinite}
          .ar-arm{transform-box:fill-box;transform-origin:top center}
          @media (prefers-reduced-motion:reduce){.ar-body,.ar-eye,.ar-flame,.ar-ant,.ar-beat,.ar-ring{animation:none}}
        `}</style>
        {bubble && <span key={bubble} className="pointer-events-none absolute -left-44 top-1 w-40 rounded-xl rounded-br-none bg-white px-3 py-1.5 text-[11px] font-semibold leading-tight text-slate-900 shadow-lg" style={{ animation: "ar-pop .25s ease-out" }}>{bubble}</span>}
        <div style={{ transform: `rotate(${tilt + spin}deg)`, transition: moving ? "transform .55s cubic-bezier(.2,.8,.2,1)" : "none" }}>
          <svg width="92" height="124" viewBox="0 0 92 124" aria-hidden="true" style={hop ? { animation: "ar-hop .6s ease-out" } : undefined}>
            <ellipse className="ar-ring" cx="46" cy="116" rx="26" ry="5" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
            <g className="ar-body">
              <line x1="46" y1="8" x2="46" y2="18" stroke="#7dd3fc" strokeWidth="3" /><circle className="ar-ant" cx="46" cy="6" r="4" fill="#ff6b8b" />
              <rect x="16" y="18" width="60" height="46" rx="21" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="3" />
              <rect x="24" y="28" width="44" height="28" rx="14" fill="#0b1b3a" />
              {[[37, 42], [55, 42]].map(([cx, cy], i) => (
                <g key={i}><ellipse className="ar-eye" cx={cx} cy={cy} rx="6" ry="7.5" fill="#00f0ff" />
                  <circle cx={cx + look.x * 0.6} cy={cy + look.y * 0.6} r="2.6" fill="#03203f" /><circle cx={cx + look.x * 0.6 - 1} cy={cy + look.y * 0.6 - 1.2} r="1" fill="#fff" /></g>
              ))}
              <path d={hover || open ? "M38 51 Q46 58 54 51" : "M40 51 Q46 54 52 51"} stroke="#00f0ff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <circle cx="25" cy="50" r="3.2" fill="#ff9fb8" opacity={hover ? 0.95 : 0.65} /><circle cx="67" cy="50" r="3.2" fill="#ff9fb8" opacity={hover ? 0.95 : 0.65} />
              <rect x="26" y="66" width="40" height="32" rx="13" fill="#bae6fd" stroke="#38bdf8" strokeWidth="3" />
              <path className="ar-beat" d="M46 90 C38 84 36 77 41 75 C44 74 46 76 46 78 C46 76 48 74 51 75 C56 77 54 84 46 90Z" fill="#ff6b8b" />
              <g className="ar-arm" style={wave && moving ? { animation: "ar-wave .5s ease-in-out 2" } : undefined}><rect x="68" y="68" width="10" height="24" rx="5" fill="#7dd3fc" /><circle cx="73" cy="93" r="5" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="2" /></g>
              <rect x="14" y="68" width="10" height="24" rx="5" fill="#7dd3fc" /><circle cx="19" cy="93" r="5" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="2" />
              <rect x="31" y="98" width="11" height="8" rx="4" fill="#38bdf8" /><rect x="50" y="98" width="11" height="8" rx="4" fill="#38bdf8" />
              <path className="ar-flame" d="M33 106 Q36.5 120 40 106Z" fill="#fbbf24" /><path className="ar-flame" d="M52 106 Q55.5 120 59 106Z" fill="#fbbf24" />
            </g>
          </svg>
        </div>
        <span className="absolute -left-12 top-2 rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow">ASTRA</span>
      </button>
    </>
  );
}
