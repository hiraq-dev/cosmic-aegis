import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Logo, btnGhost } from "./ui";
import Starfield from "./Starfield";
import AstraRobot from "./AstraRobot";
import { lazy, Suspense } from "react";
const Scene3D = lazy(() => import("./Scene3D"));
const gl = (() => { try { return !!document.createElement("canvas").getContext("webgl2") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();

// Pointer-driven 3D tilt for glass panels (skipped for touch, reduced motion, and very tall panels).
function useTilt() {
  useEffect(() => {
    if (!gl || !window.matchMedia("(pointer: fine)").matches) return;
    let cur: HTMLElement | null = null;
    const reset = () => { if (cur) { cur.style.transform = ""; cur = null; } };
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest?.(".glass") as HTMLElement | null;
      if (!el || el.offsetHeight > 520 || el.tagName === "DETAILS") { reset(); return; }
      if (cur && cur !== el) reset();
      cur = el; const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateZ(6px)`;
      el.style.transition = "transform .08s linear";
    };
    document.addEventListener("pointermove", move, { passive: true }); document.addEventListener("pointerleave", reset);
    return () => { document.removeEventListener("pointermove", move); reset(); };
  }, []);
}
import { useStore } from "../lib/store";
import { missionStatus } from "../lib/assess";
import { REPO_URL, TEAM_NAME } from "../lib/team";


function useTick(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
  return n;
}

function Clock() {
  useTick(1000);
  return <span className="hud-mono">{new Date().toISOString().slice(11, 19)} UTC</span>;
}

export default function Layout() {
  useTilt();
    const { resetDemo, data } = useStore();
  const ms = missionStatus(data);

  return (
    <div id="top" className="relative min-h-screen">
      {gl ? <Suspense fallback={<Starfield />}><Scene3D /></Suspense> : <Starfield />}
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-aegis-cyan focus:px-3 focus:py-2 focus:text-space-950">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-cyan-400/20 bg-[rgba(6,11,24,0.9)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-3 px-4 py-2.5">
          <a href="#top" className="flex items-center gap-3" aria-label="C.O.S.M.I.C. AEGIS home">
            <Logo size={44} />
            <span className="leading-tight">
              <span className="hud-mono hidden text-[10px] tracking-[0.2em] text-slate-400 sm:block">{TEAM_NAME.toUpperCase()} &bull; DEMO PROTOTYPE</span>
              <span className="font-display text-base font-extrabold tracking-wider text-white sm:text-lg">
                C.O.S.M.I.C. <span className="hud-glow">AEGIS</span>
              </span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <div className="hud-mono hidden items-center gap-2.5 rounded-md border border-cyan-400/25 bg-[rgba(14,23,49,0.75)] px-3 py-1.5 text-xs md:flex">
              <span className="pulse-dot" />
              <span>SIM DAY <strong>{ms.day}</strong></span>
              <Clock />
            </div>
            <a href="#console" className="font-display inline-flex items-center gap-1.5 rounded-md border border-red-400 bg-gradient-to-br from-red-900 to-hud-crimson px-3 py-1.5 text-[11px] font-bold tracking-wider text-white shadow-[0_0_12px_rgba(255,42,85,.4)] hover:shadow-[0_0_20px_rgba(255,42,85,.8)]">
              <TriangleAlert size={14} aria-hidden="true" /> <span className="hidden sm:inline">SOS PRACTICE</span><span className="sm:hidden">SOS</span>
            </a>
          </div>
        </div>
      </header>

      <main id="main" className="relative z-10 mx-auto max-w-[1720px] px-4 py-6">
        <Outlet />
      </main>

      <AstraRobot />
      <footer className="relative z-10 mx-auto max-w-[1720px] px-4 pb-24 pt-4 text-xs text-slate-400">
        <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl">
            Team AEGIS (Hira Qaiser, Srikant Kavitha Parasuraman, Kishore Kumar Mani Kandan) - NASA Space Apps Challenge 2026.{" "}
            <a className="underline hover:text-aegis-cyan" href={REPO_URL} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
            <span className="mt-1 block text-[10px] text-slate-500">Prototype screening tool, not a medical device. Built with AI assistance. Not endorsed by NASA.</span>
          </p>
          <button
            className={btnGhost}
            onClick={() => {
              if (window.confirm("Reset all demo data to the original sample data? Your entries will be removed.")) resetDemo();
            }}
          >
            <RotateCcw size={14} aria-hidden="true" /> Reset demo data
          </button>
        </div>
      </footer>
      
    </div>
  );
}
