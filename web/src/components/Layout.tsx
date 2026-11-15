import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Activity, BookOpen, Brain, ClipboardCheck, Dumbbell, HeartPulse, LayoutDashboard, Menu, Radio, RotateCcw, Smile, TriangleAlert, User, X } from "lucide-react";
import { Logo, btnGhost } from "./ui";
import Assistant from "./Assistant";
import Starfield from "./Starfield";
import { useStore } from "../lib/store";
import { missionStatus } from "../lib/assess";
import { REPO_URL, TEAM_MEMBERS, TEAM_NAME } from "../lib/team";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/companion", label: "Habitat console", icon: Smile },
  { to: "/mental", label: "Mental", icon: Brain },
  { to: "/musculoskeletal", label: "Muscle & bone", icon: Dumbbell },
  { to: "/cardiovascular", label: "Cardio", icon: HeartPulse },
  { to: "/comms", label: "Comms & ground", icon: Radio },
  { to: "/checklist", label: "Module checklist", icon: ClipboardCheck },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/sources", label: "Sources", icon: BookOpen },
];

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="hud-mono">{t.toISOString().slice(11, 19)} UTC</span>;
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { resetDemo, data } = useStore();
  const ms = missionStatus(data);

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold tracking-wide transition ${
      isActive ? "border-aegis-cyan bg-gradient-to-r from-cyan-400/20 to-blue-800/40 text-white shadow-[0_0_14px_rgba(0,240,255,.25)]" : "border-white/10 text-slate-400 hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-white"
    }`;

  return (
    <div className="relative min-h-screen">
      <Starfield />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-aegis-cyan focus:px-3 focus:py-2 focus:text-space-950">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-cyan-400/20 bg-[rgba(6,11,24,0.88)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-3" aria-label="C.O.S.M.I.C. AEGIS home">
            <Logo size={38} />
            <span className="leading-tight">
              <span className="hud-mono block text-[10px] tracking-[0.2em] text-slate-400">{TEAM_NAME.toUpperCase()} &bull; DEMO PROTOTYPE</span>
              <span className="font-display text-lg font-extrabold tracking-wider text-white">
                C.O.S.M.I.C. <span className="hud-glow">AEGIS</span>
              </span>
            </span>
          </NavLink>

          <Link to="/checklist" title="Open the module checklist" className="relative hidden min-w-[280px] overflow-hidden rounded-lg border border-emerald-400/50 bg-gradient-to-br from-emerald-400/10 to-cyan-400/5 px-4 py-1.5 shadow-[0_0_15px_rgba(0,255,157,.2)] hover:border-emerald-300 md:block">
            <span className="absolute inset-x-0 top-0 h-0.5 animate-[ribbonGlow_3s_linear_infinite] bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-300" />
            <span className="font-display flex items-center justify-between gap-3 text-[11px]">
              <span className="tracking-wider text-slate-400">PROTOTYPE MODULES</span>
              <span className="font-bold text-white">10 / 10 BUILT</span>
              <span className="font-extrabold text-hud-emerald">SIMULATED</span>
            </span>
            <span className="mt-1 block h-1.5 rounded bg-white/10">
              <span className="block h-full w-full rounded bg-gradient-to-r from-cyan-400 to-emerald-300 shadow-[0_0_10px_#00ff9d]" />
            </span>
            <span className="hud-mono mt-0.5 flex justify-between text-[9.5px] text-hud-emerald">
              <span>&#10003; DEMO ONLY - NOT CERTIFIED OR VALIDATED</span>
              <span className="text-aegis-cyan">VIEW &#9660;</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hud-mono hidden items-center gap-2.5 rounded-md border border-cyan-400/25 bg-[rgba(14,23,49,0.75)] px-3 py-1.5 text-xs sm:flex">
              <span className="pulse-dot" />
              <span>
                SIM DAY <strong>{ms.day}</strong>
              </span>
              <Clock />
            </div>
            <Link to="/comms#sos" className="font-display inline-flex items-center gap-1.5 rounded-md border border-red-400 bg-gradient-to-br from-red-900 to-hud-crimson px-3.5 py-1.5 text-[11px] font-bold tracking-wider text-white shadow-[0_0_12px_rgba(255,42,85,.4)] hover:shadow-[0_0_20px_rgba(255,42,85,.8)]">
              <TriangleAlert size={14} aria-hidden="true" /> SOS PRACTICE
            </Link>
            <button className="rounded-lg p-2 text-slate-200 hover:bg-white/10 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <nav aria-label="Main" className="hidden border-t border-white/5 bg-[rgba(9,15,33,0.6)] px-4 py-2 lg:block">
          <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={link}>
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
            <div className="hud-mono hidden text-[11px] text-slate-400 xl:block">
              SIMULATED LINK <span className="text-amber-400">ONE-WAY DELAY ~{ms.oneWayMin} MIN</span>
            </div>
          </div>
        </nav>
        {open && (
          <nav id="mobile-nav" aria-label="Main mobile" className="space-y-1 border-t border-white/10 px-4 py-3 lg:hidden">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={link} onClick={() => setOpen(false)}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main id="main" className="relative z-10 mx-auto max-w-[1720px] px-4 py-6">
        <Outlet />
      </main>

      <footer className="relative z-10 mx-auto max-w-[1720px] px-4 pb-10 pt-4 text-xs text-slate-400">
        <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl">
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
      <Assistant />
    </div>
  );
}
