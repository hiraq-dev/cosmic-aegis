import { Link } from "react-router-dom";
import { ArrowRight, Atom, Bone, Brain, CloudFog, Dumbbell, HeartPulse, Moon, Rocket, Thermometer, Timer, User } from "lucide-react";
import { useStore } from "../lib/store";
import { buildAlerts, missionStatus, overall, simulatedEnvironment, STATUS_LABEL } from "../lib/assess";
import { moodRows, recentActivity, vitalRows, exerciseRows } from "../lib/chartData";
import { today } from "../lib/dates";
import Story from "../components/Story";
import SpaceWeather from "../components/SpaceWeather";
import RiskEngine from "../components/RiskEngine";
import { AstronautArt } from "../components/AstronautArt";
import { AlertsList } from "../components/AlertsList";
import { MoodCheckIn } from "../components/forms";
import { Sparkline, TrendLines } from "../components/charts";
import { DemoBadge, Disclaimer, Panel, Stat, StatusPill } from "../components/ui";
import type { Status } from "../lib/types";
import { SOURCES } from "../lib/team";

// The five hazards of human spaceflight (NASA Human Research Program) mapped to AEGIS features.
const NASA_HAZARDS = [
  { hazard: "Radiation", feature: "Simulated radiation reading in the live ticker and mission status.", to: "/", color: "#a78bfa" },
  { hazard: "Isolation & confinement", feature: "Daily mood, stress and sleep check-in, companion and breathing pacer.", to: "/mental", color: "#00ff9d" },
  { hazard: "Distance from Earth", feature: "Delay-tolerant message queue and SOS practice with signal delay.", to: "/console?view=ground", color: "#38bdf8" },
  { hazard: "Gravity fields", feature: "Muscle and bone tracking from exercise consistency and strength trend.", to: "/musculoskeletal", color: "#ffb020" },
  { hazard: "Hostile / closed environments", feature: "Cabin CO2 and temperature readings plus cardiovascular vitals.", to: "/cardiovascular", color: "#ff6b8b" },
];

export default function Dashboard() {
  const { data } = useStore();
  const o = overall(data);
  const alerts = buildAlerts(data);
  const mission = missionStatus(data);
  const env = simulatedEnvironment(today());
  const moods = moodRows(data.moods);
  const vitals = vitalRows(data.vitals);
  const ex = exerciseRows(data.exercise);
  const activity = recentActivity(data);

  const modules: { to: string; title: string; icon: typeof Brain; status: Status; stat: string; spark: React.ReactNode; blurb: string }[] = [
    {
      to: "/mental",
      title: "Mental health",
      icon: Brain,
      status: o.mental.status,
      stat: `Wellbeing ${o.mental.score}/100`,
      spark: <Sparkline data={moods} dataKey="wellbeing" color="#8b5cf6" label="Wellbeing trend, last 14 days" />,
      blurb: "Mood, stress, sleep and fatigue",
    },
    {
      to: "/musculoskeletal",
      title: "Muscle & bone",
      icon: Dumbbell,
      status: o.msk.status,
      stat: `${o.msk.daysActive}/7 active days`,
      spark: <Sparkline data={ex} dataKey="minutes" color="#22d3ee" label="Exercise minutes trend" />,
      blurb: "Exercise, strength and bone-loading",
    },
    {
      to: "/cardiovascular",
      title: "Cardiovascular",
      icon: HeartPulse,
      status: o.cardio.status,
      stat: o.cardio.latest ? `${o.cardio.latest.systolic}/${o.cardio.latest.diastolic} mmHg` : "No readings",
      spark: <Sparkline data={vitals} dataKey="sys" color="#fb7185" label="Systolic blood pressure trend" />,
      blurb: "Heart rate, blood pressure, SpO2",
    },
  ];

  const indicators: { label: string; value: string; sub: string; status?: Status; icon: typeof Brain; simulated?: boolean }[] = [
    { label: "Cardiovascular changes", value: `${o.cardio.sysDelta >= 0 ? "+" : ""}${o.cardio.sysDelta.toFixed(1)} mmHg`, sub: "Systolic, last 7 vs previous 7 days", status: o.cardio.status, icon: HeartPulse },
    { label: "Mental wellbeing", value: `${o.mental.score}/100`, sub: "Average of last 3 check-ins", status: o.mental.status, icon: Brain },
    { label: "Sleep disruption", value: `${o.mental.avgSleep.toFixed(1)} h`, sub: "Average sleep, last 7 entries", status: o.mental.avgSleep < 6.5 ? "watch" : "nominal", icon: Moon },
    { label: "Bone & muscle loss", value: `${o.msk.strengthTrend >= 0 ? "+" : ""}${o.msk.strengthTrend.toFixed(0)}%`, sub: "Strength vs earlier sessions", status: o.msk.status, icon: Bone },
    { label: "Radiation exposure", value: `${env.radiationMsvDay.toFixed(2)} mSv/day`, sub: "Simulated value", icon: Atom, simulated: true },
    { label: "Cabin environment", value: `${env.co2Ppm} ppm CO2 / ${env.tempC.toFixed(1)} C`, sub: "Simulated values", icon: CloudFog, simulated: true },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="glass overflow-hidden p-6 md:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <DemoBadge />
              <span className="text-xs text-slate-400">Prototype - all values below are sample data</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">Understand Your Health Beyond Earth</h1>
            <p className="mt-3 max-w-xl text-slate-300">
              Millions of kilometres from home, your health should never be out of reach. AEGIS brings your daily readings, trends and gentle alerts into one calm place, so you can notice changes early and
              prepare clear information for the people who care for you.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-slate-200">
                <Rocket size={13} aria-hidden="true" /> Mission day {mission.day} of {mission.len}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-slate-200">
                <Timer size={13} aria-hidden="true" /> ~{mission.oneWayMin} min one-way signal delay (simulated)
              </span>
            </div>
          </div>
          <AstronautArt className="mx-auto w-full max-w-sm" />
        </div>
      </section>

      <Story />

      {/* Profile, mission, overall */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Astronaut profile" icon={<User size={16} aria-hidden="true" />} action={<DemoBadge text="FICTIONAL" />}>
          <p className="text-lg font-semibold text-white">{data.profile.name}</p>
          <p className="text-sm text-slate-300">{data.profile.role}</p>
          <p className="mt-1 text-sm text-slate-400">Age {data.profile.age}</p>
          <Link to="/profile" className="mt-3 inline-flex items-center gap-1 text-sm text-aegis-cyan hover:underline">
            Health history <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </Panel>
        <Panel title="Mission status" icon={<Rocket size={16} aria-hidden="true" />} action={<DemoBadge text="SIMULATED" />}>
          <p className="text-sm font-medium text-white">{data.profile.missionName}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={mission.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Mission progress">
            <div className="h-full rounded-full bg-gradient-to-r from-aegis-cyan to-aegis-violet" style={{ width: `${mission.progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Day {mission.day} of {mission.len} ({mission.progress}%) - {mission.distanceMkm} million km from Earth
          </p>
        </Panel>
        <Panel title="Overall health overview" icon={<HeartPulse size={16} aria-hidden="true" />} action={<DemoBadge />}>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-white">{o.score}</span>
            <span className="pb-1 text-sm text-slate-400">/ 100 demo index</span>
          </div>
          <div className="mt-2">
            <StatusPill status={o.status} />
          </div>
          <p className="mt-2 text-xs text-slate-400">{STATUS_LABEL[o.status]}. The index averages the three modules and is for demonstration only.</p>
        </Panel>
      </div>

      {/* Modules */}
      <section aria-labelledby="mods">
        <h2 id="mods" className="mb-3 text-lg font-semibold text-white">
          Your three health areas
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {modules.map(({ to, title, icon: Icon, status, stat, spark, blurb }) => (
            <Link key={to} to={to} className="glass group block p-5 transition hover:border-aegis-cyan/50 hover:bg-space-800/70">
              <div className="flex items-start justify-between">
                <span className="rounded-lg bg-aegis-cyan/10 p-2 text-aegis-cyan">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <StatusPill status={status} />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
              <p className="text-sm text-slate-400">{blurb}</p>
              <p className="mt-3 text-sm font-medium text-slate-100">{stat}</p>
              <div className="mt-1">{spark}</div>
              <span className="mt-2 inline-flex items-center gap-1 text-sm text-aegis-cyan group-hover:underline">
                Open module <ArrowRight size={14} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Check-in + alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Daily health check-in" icon={<Brain size={16} aria-hidden="true" />}>
          <MoodCheckIn compact />
          <p className="mt-3 text-xs text-slate-400">Need to log vitals or exercise? Use the modules above.</p>
        </Panel>
        <Panel title="Alerts & notifications" icon={<Thermometer size={16} aria-hidden="true" />}>
          <AlertsList alerts={alerts} />
        </Panel>
      </div>

      {/* Indicators */}
      <section aria-labelledby="ind">
        <h2 id="ind" className="mb-3 text-lg font-semibold text-white">
          Supporting indicators
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {indicators.map(({ label, value, sub, status, icon: Icon, simulated }) => (
            <div key={label} className="relative">
              <Stat label={label} value={value} sub={sub} status={status} />
              <Icon size={18} className="absolute right-4 top-4 text-slate-500" aria-hidden="true" />
              {simulated && (
                <div className="absolute bottom-3 right-3">
                  <DemoBadge text="SIMULATED" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Trends + activity */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="14-day trends" action={<DemoBadge />}>
          <TrendLines
            data={moods}
            label="Line chart of wellbeing score and sleep hours over the last 14 days"
            series={[
              { key: "wellbeing", label: "Wellbeing (0-100)", color: "#8b5cf6" },
              { key: "sleep", label: "Sleep (h)", color: "#22d3ee", yAxisId: "right" },
            ]}
          />
        </Panel>
        <Panel title="Recent activity" action={<Link to="/profile" className="text-xs text-aegis-cyan hover:underline">All history</Link>}>
          <ul className="space-y-2 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-2 text-slate-300">
                <span className="w-14 shrink-0 text-xs text-slate-500">{a.date.slice(5)}</span>
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <RiskEngine />

      <SpaceWeather />

      <Panel title="Built from NASA Human Research Program resources" icon={<Atom size={16} aria-hidden="true" />} action={<DemoBadge text="NASA HRP" />}>
        <p className="mb-3 text-sm text-slate-300">
          AEGIS is organised around the five hazards of human spaceflight that NASA's Human Research Program describes. Each hazard maps to a feature you can try on this site.
        </p>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {NASA_HAZARDS.map((h) => (
            <Link key={h.hazard} to={h.to} className="rounded-lg border border-white/10 bg-white/5 p-3 transition hover:border-aegis-cyan/50 hover:bg-white/10">
              <div className="hud-mono text-[10px] tracking-widest" style={{ color: h.color }}>{h.hazard.toUpperCase()}</div>
              <p className="mt-1 text-slate-200">{h.feature}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-aegis-cyan">Open <ArrowRight size={12} aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {SOURCES.slice(1, 4).map((s) => (
            <li key={s.url}>
              <a className="text-aegis-cyan underline hover:text-white" href={s.url} target="_blank" rel="noreferrer">{s.name.replace(" (NASA Human Research Program)", "").replace(" (NASA)", "")}</a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">Sources: NASA Human Research Program public pages. Values in AEGIS stay simulated; NASA does not endorse this project.</p>
      </Panel>

      <Panel title="What is real in this prototype">
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <div>
            <h3 className="mb-1 font-semibold text-ok">Implemented</h3>
            <ul className="list-disc space-y-1 pl-5 text-slate-300">
              <li>Daily check-in, vitals and exercise forms with validation</li>
              <li>Charts and trends from your entries</li>
              <li>Rule-based alerts and a medical-review message</li>
              <li>Saved in your browser only (no account, no server)</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-violet-300">Simulated demo data</h3>
            <ul className="list-disc space-y-1 pl-5 text-slate-300">
              <li>The astronaut, mission and 14 days of history</li>
              <li>Radiation, CO2 and cabin temperature</li>
              <li>Distance and signal delay</li>
              <li>Bone status (derived from exercise, not measured)</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-watch">Future integrations</h3>
            <ul className="list-disc space-y-1 pl-5 text-slate-300">
              <li>Computer vision for exercise form</li>
              <li>Machine-learning trend analysis</li>
              <li>Wearable and sensor data</li>
              <li>Clinical validation with medical teams</li>
            </ul>
          </div>
        </div>
      </Panel>
      <Disclaimer />
    </div>
  );
}
