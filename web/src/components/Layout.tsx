import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Activity, RotateCcw, TriangleAlert } from "lucide-react";
import { Logo, btnGhost } from "./ui";
import Starfield from "./Starfield";
import AstraRobot from "./AstraRobot";
import { useStore } from "../lib/store";
import { missionStatus, simulatedEnvironment } from "../lib/assess";
import { today } from "../lib/dates";
import { REPO_URL, TEAM_MEMBERS, TEAM_NAME } from "../lib/team";


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

// Simulated "live" strip: base values come from the demo model and wobble every 2 s. Nothing is measured.
function Ticker() {
  const tick = useTick(2000);
  const { data } = useStore();
  const env = simulatedEnvironment(today());
  const j = (k: number, amp: number) => Math.sin(tick * 0.9 + k) * amp;
  const latest = [...data.vitals].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const items = [
    { l: "HEART RATE", v: `${Math.round((latest?.heartRate ?? 72) + j(1, 2.5))}`, u: "bpm", c: "#ff6b8b" },
    { l: "OXYGEN", v: `${Math.min(100, Math.round((latest?.spo2 ?? 98) + j(2, 0.6)))}`, u: "%", c: "#00f0ff" },
    { l: "CABIN CO2", v: `${Math.round(env.co2Ppm + j(3, 40))}`, u: "ppm", c: "#ffb020" },
    { l: "CABIN TEMP", v: (env.tempC + j(4, 0.15)).toFixed(1), u: "C", c: "#38bdf8" },
    { l: "RADIATION", v: (env.radiationMsvDay + j(5, 0.01)).toFixed(2), u: "mSv/day", c: "#a78bfa" },
  ];
  return (
    <div className="border-b border-white/5 bg-[rgba(4,8,20,.85)]" role="status" aria-label="Simulated live readings">
      <div className="mx-auto flex max-w-[1720px] items-center gap-x-6 gap-y-1 overflow-x-auto px-4 py-1.5 text-xs">
        <span className="hud-mono flex shrink-0 items-center gap-1.5 text-[10px] font-bold tracking-widest text-hud-emerald"><span className="pulse-dot" /> SIMULATED LIVE</span>
        {items.map((i) => (
          <span key={i.l} className="hud-mono flex shrink-0 items-baseline gap-1.5">
            <span className="text-[9.5px] text-slate-500">{i.l}</span>
            <strong className="text-[13px] tabular-nums" style={{ color: i.c, textShadow: `0 0 8px ${i.c}66` }}>{i.v}</strong>
            <span className="text-[9px] text-slate-500">{i.u}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Layout() {
    const { resetDemo, data } = useStore();
  const ms = missionStatus(data);

  return (
    <div id="top" className="relative min-h-screen">
      <Starfield />
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
      <Ticker />

      <main id="main" className="relative z-10 mx-auto max-w-[1720px] px-4 py-6">
        <Outlet />
      </main>

      <AstraRobot />
      <footer className="relative z-10 mx-auto max-w-[1720px] px-4 pb-24 pt-4 text-xs text-slate-400">
        <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl">
            <Activity size={12} className="mr-1 inline" aria-hidden="true" />
            {TEAM_NAME} ({TEAM_MEMBERS}) - NASA Space Apps Challenge 2026 prototype. Demo data only, not a medical device. Not affiliated with or endorsed by NASA. Code and visuals created with AI assistance.{" "}
            <a className="underline hover:text-aegis-cyan" href={REPO_URL} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
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
