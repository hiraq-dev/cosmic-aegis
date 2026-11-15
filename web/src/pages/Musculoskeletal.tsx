import { Bone, Dumbbell } from "lucide-react";
import { useStore } from "../lib/store";
import { buildAlerts, mskSummary, STATUS_LABEL, worst } from "../lib/assess";
import { exerciseRows } from "../lib/chartData";
import { ExerciseForm } from "../components/forms";
import { BodyFigure, type RegionId } from "../components/BodyFigure";
import { AlertsList } from "../components/AlertsList";
import { TrendBars, TrendLines } from "../components/charts";
import { DemoBadge, Disclaimer, Panel, Stat, StatusPill } from "../components/ui";
import type { Status } from "../lib/types";

export default function Musculoskeletal() {
  const { data } = useStore();
  const s = mskSummary(data.exercise);
  const rows = exerciseRows(data.exercise);
  const alerts = buildAlerts(data).filter((a) => a.module === "musculoskeletal");

  // Illustrative mapping from logged exercise to body regions (not a measurement).
  const light: Status = s.consistency < 55 ? "watch" : "nominal";
  const statuses: Record<RegionId, Status> = {
    upper: light,
    core: light,
    hips: s.boneStatus,
    thighs: s.muscleStatus,
    calves: worst(s.muscleStatus, light) === "review" ? "watch" : s.muscleStatus,
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Dumbbell className="text-aegis-cyan" aria-hidden="true" /> Musculoskeletal degradation
          </h1>
          <DemoBadge text="ILLUSTRATIVE PROTOTYPE DATA" />
        </div>
        <p className="mt-1 max-w-3xl text-slate-300">
          In microgravity, muscles and bones carry far less load than on Earth, which is why daily exercise is part of mission routine. Log your sessions to see consistency and strength trends, and tap the body figure to learn what each area does.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Exercise consistency" value={`${s.consistency}%`} sub={`${s.daysActive} of the last 7 days`} status={s.consistency < 55 ? "watch" : "nominal"} />
        <Stat label="Minutes this week" value={`${s.minutes7}`} sub="Last 7 days" />
        <Stat label="Strength trend (demo)" value={`${s.strengthTrend >= 0 ? "+" : ""}${s.strengthTrend.toFixed(0)}%`} sub="Recent vs earlier sessions" status={s.muscleStatus} />
        <Stat label="Bone monitoring (demo)" value={STATUS_LABEL[s.boneStatus]} sub="Derived from exercise consistency, not a bone scan" status={s.boneStatus} />
      </div>

      <Panel title="Body view" icon={<Bone size={16} aria-hidden="true" />} action={<DemoBadge />}>
        <BodyFigure statuses={statuses} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Log an exercise session">
          <ExerciseForm />
        </Panel>
        <div className="space-y-4">
          <Panel title="Strength tracking (peak load, kg)" action={<DemoBadge />}>
            <TrendLines data={rows} label="Line chart of peak load lifted per day over recent sessions" series={[{ key: "strength", label: "Peak load (kg)", color: "#22d3ee" }]} />
          </Panel>
          <Panel title="Daily exercise minutes">
            <TrendBars data={rows} dataKey="minutes" name="Minutes" color="#3b82f6" label="Bar chart of exercise minutes per day" height={150} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Degradation warning (simulated)" action={<StatusPill status={s.status} />}>
          <AlertsList alerts={alerts} empty="No degradation warning. Your demo strength and consistency look steady." />
          <p className="mt-3 text-xs text-slate-400">This warning is generated from your logged demo entries to illustrate how a warning could look. It does not measure muscle or bone.</p>
        </Panel>
        <Panel title="Physical activity history">
          <ul className="max-h-64 space-y-2 overflow-auto text-sm text-slate-300">
            {[...data.exercise]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 12)
              .map((e) => (
                <li key={e.id} className="flex justify-between gap-3 border-b border-white/5 pb-1">
                  <span>{e.date}</span>
                  <span className="text-right">
                    {e.kind}, {e.minutes} min{e.strengthKg ? `, ${e.strengthKg} kg` : ""}
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>
      <Disclaimer />
    </div>
  );
}
