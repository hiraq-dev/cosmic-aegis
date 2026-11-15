import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Panel, DemoBadge, Disclaimer } from "../components/ui";

const MODS = [
  ["MOD-01", "Animated astro companion", "Illustrated astronaut with four moods and scripted speech", "/companion"],
  ["MOD-02", "Daily wellbeing pad", "Feeling pad and sliders (reflection aid, not saved)", "/companion"],
  ["MOD-03", "Morale break", "Icebreaker quiz, jokes and a fun morale gauge", "/companion"],
  ["MOD-04", "Sleep and fatigue", "Tiles from your entries plus a 1-tap reaction game", "/companion"],
  ["MOD-05", "7-day sleep trend", "Chart of your last 7 entries against a demo line", "/companion"],
  ["MOD-06", "Pattern detection", "Scripted rules over your own entries (no ML)", "/companion"],
  ["MOD-07", "Prevention tools", "Screen light, calm tone, 4-7-8 breathing pacer", "/companion"],
  ["MOD-08", "Practice SOS", "10-second countdown screen. Sends nothing", "/comms#sos"],
  ["MOD-09", "Delay-tolerant queue", "Simulated packet queue, blackout toggle, byte inspector", "/comms"],
  ["MOD-10", "Mock ground console", "Same demo data in a ground-style view with a script-drawn wave", "/comms"],
];

export default function Checklist() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Module checklist</h1>
        <p className="text-slate-300">10 of 10 prototype modules are built and working in this demo. <DemoBadge text="SIMULATED" /></p>
      </div>
      <Panel title="Build status (not a certification)">
        <div className="mb-4 h-2.5 rounded bg-white/10"><div className="h-full w-full rounded bg-gradient-to-r from-cyan-400 to-emerald-300 shadow-[0_0_10px_#00ff9d]" /></div>
        <ul className="grid gap-3 md:grid-cols-2">
          {MODS.map(([id, t, d, to]) => (
            <li key={id}>
              <Link to={to} className="flex gap-3 rounded-lg border border-white/10 bg-[rgba(9,16,34,.6)] p-3 hover:border-aegis-cyan">
                <CheckCircle2 className="mt-0.5 shrink-0 text-hud-emerald" size={18} aria-hidden="true" />
                <span>
                  <span className="mod-id mr-2">{id}</span>
                  <strong className="text-white">{t}</strong>
                  <span className="block text-sm text-slate-300">{d}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-300">"Built" means the screen exists and works in the browser with simulated data. It does not mean tested with astronauts, validated, certified or endorsed by any agency. Not a medical device.</p>
      </Panel>
      <Disclaimer />
    </div>
  );
}
