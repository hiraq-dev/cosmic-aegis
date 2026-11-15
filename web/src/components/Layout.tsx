import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, BookOpen, Brain, Dumbbell, HeartPulse, LayoutDashboard, Menu, Radio, RotateCcw, Smile, User, X } from "lucide-react";
import { Logo, btnGhost } from "./ui";
import Assistant from "./Assistant";
import { useStore } from "../lib/store";
import { REPO_URL, TEAM_MEMBERS, TEAM_NAME } from "../lib/team";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/mental", label: "Mental health", icon: Brain },
  { to: "/musculoskeletal", label: "Muscle & bone", icon: Dumbbell },
  { to: "/cardiovascular", label: "Cardiovascular", icon: HeartPulse },
  { to: "/companion", label: "Companion", icon: Smile },
  { to: "/comms", label: "Comms & SOS", icon: Radio },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/sources", label: "Sources & status", icon: BookOpen },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { resetDemo } = useStore();
  useLocation(); // re-render on navigation so the mobile menu closes via the links below

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-aegis-cyan/15 text-aegis-cyan" : "text-slate-300 hover:bg-white/5"}`;

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-aegis-cyan focus:px-3 focus:py-2 focus:text-space-950">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-space-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-3" aria-label="C.O.S.M.I.C. AEGIS home">
            <Logo />
            <span className="leading-tight">
              <span className="block text-sm font-bold tracking-widest text-white">C.O.S.M.I.C. AEGIS</span>
              <span className="hidden text-[11px] text-slate-400 sm:block">Understand Your Health Beyond Earth</span>
            </span>
          </NavLink>
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={link}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <button className="rounded-lg p-2 text-slate-200 hover:bg-white/10 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
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

      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-slate-400">
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
