import { useEffect, useRef, useState } from "react";

/** Floating anime-style robot. It glides down the page as you scroll, tilts toward the scroll direction,
 *  blinks, and jumps to the ASTRA consultation panel when clicked. Motion is skipped for reduced-motion users. */
export default function AstraRobot() {
  const [y, setY] = useState(0), [tilt, setTilt] = useState(0), [wave, setWave] = useState(false);
  const last = useRef(0), reduce = useRef(false);
  useEffect(() => {
    reduce.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let t = 0;
    const onScroll = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1), sy = window.scrollY;
      setY((sy / max) * (window.innerHeight - 220)); // glide from top to bottom of the viewport with page progress (eased by CSS)
      const v = Math.max(-1, Math.min(1, (sy - last.current) / 40)); last.current = sy;
      setTilt(reduce.current ? 0 : v * 18);
      setWave(true); clearTimeout(t); t = window.setTimeout(() => { setWave(false); setTilt(0); }, 400);
    };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, []);
  return (
    <button aria-label="Open ASTRA, the health assistant" title="ASTRA — click to talk"
      onClick={() => document.getElementById("astra")?.scrollIntoView({ behavior: reduce.current ? "auto" : "smooth", block: "center" })}
      className="fixed right-3 z-40 select-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      style={{ top: 90, transform: `translateY(${y}px) rotate(${tilt}deg)`, transition: reduce.current ? "none" : "transform .7s cubic-bezier(.2,.8,.2,1)" }}>
      <svg width="86" height="104" viewBox="0 0 86 104" aria-hidden="true">
        <style>{`@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}@keyframes wv{0%,100%{transform:rotate(0)}50%{transform:rotate(-28deg)}}
          .rb{animation:bob 2.4s ease-in-out infinite}.ey{transform-box:fill-box;transform-origin:center;animation:blink 4s infinite}.arm{transform-box:fill-box;transform-origin:top center}@media (prefers-reduced-motion:reduce){.rb,.ey{animation:none}}`}</style>
        <g className="rb">
          <line x1="43" y1="6" x2="43" y2="16" stroke="#7dd3fc" strokeWidth="3" /><circle cx="43" cy="5" r="4" fill="#ff6b8b" />
          <rect x="14" y="16" width="58" height="44" rx="20" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="3" />
          <rect x="22" y="26" width="42" height="26" rx="13" fill="#0b1b3a" />
          <ellipse className="ey" cx="34" cy="39" rx="5" ry="6.5" fill="#00f0ff" /><ellipse className="ey" cx="52" cy="39" rx="5" ry="6.5" fill="#00f0ff" />
          <circle cx="32.5" cy="36.5" r="1.6" fill="#fff" /><circle cx="50.5" cy="36.5" r="1.6" fill="#fff" />
          <path d="M38 47 Q43 51 48 47" stroke="#00f0ff" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="24" cy="46" r="3" fill="#ff9fb8" opacity=".7" /><circle cx="62" cy="46" r="3" fill="#ff9fb8" opacity=".7" />
          <rect x="24" y="62" width="38" height="30" rx="12" fill="#bae6fd" stroke="#38bdf8" strokeWidth="3" />
          <path d="M43 70 l-5 6 h4 l-2 6 8-8 h-4 z" fill="#ff6b8b" />
          <g className="arm" style={wave && !reduce.current ? { animation: "wv .4s ease-in-out" } : undefined}><rect x="64" y="64" width="9" height="22" rx="4.5" fill="#7dd3fc" /></g>
          <rect x="13" y="64" width="9" height="22" rx="4.5" fill="#7dd3fc" />
          <rect x="29" y="92" width="10" height="9" rx="4" fill="#38bdf8" /><rect x="47" y="92" width="10" height="9" rx="4" fill="#38bdf8" />
        </g>
      </svg>
      <span className="absolute -left-14 top-2 rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow">ASTRA</span>
    </button>
  );
}
