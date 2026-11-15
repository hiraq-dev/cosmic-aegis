import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Cpu } from "lucide-react";
import { DemoBadge, Panel } from "./ui";
import { useStore } from "../lib/store";
import { buildSeries, explain, readiness } from "../lib/analytics";
import { addDays } from "../lib/dates";

// AEGIS analytics engine panel: EWMA + OLS trend + personal-baseline z-score + 7-day projection + logistic readiness.
export default function RiskEngine() {
  const { data } = useStore();
  const series = useMemo(() => buildSeries(data), [data]);
  const ready = useMemo(() => readiness(series), [series]);
  const [key, setKey] = useState("stress");
  const sel = series.find((s) => s.key === key) ?? series[0];
  if (!sel) return null;

  const last = sel.points[sel.points.length - 1];
  const rows: { date: string; value?: number; ewma?: number; forecast?: number }[] = sel.points.map((p) => ({ ...p }));
  rows[rows.length - 1] = { ...rows[rows.length - 1], forecast: last.value };
  sel.forecast.forEach((f, i) => rows.push({ date: addDays(last.date, i + 1), forecast: Math.round(f * 100) / 100 }));

  const tone = ready.band === "high" ? "#00ff9d" : ready.band === "moderate" ? "#ffb020" : "#ff2a55";
  const flagged = series.filter((s) => s.anomaly || s.worsening);

  return (
    <Panel title="AEGIS risk engine (on-device analytics)" icon={<Cpu size={16} aria-hidden="true" />} action={<DemoBadge text="ALGORITHM" />}>
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div>
          <div className="relative mx-auto h-36 w-36" role="img" aria-label={`Readiness index ${ready.index} out of 100, ${ready.band}`}>
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="9" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={tone} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(ready.index / 100) * 264} 264`} style={{ filter: `drop-shadow(0 0 6px ${tone})`, transition: "stroke-dasharray .8s" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-3xl font-bold tabular-nums" style={{ color: tone }}>{ready.index}</span>
              <span className="hud-mono text-[10px] tracking-widest text-slate-400">READINESS</span>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-slate-300">
            Band: <strong style={{ color: tone }}>{ready.band.toUpperCase()}</strong>
          </p>
          <h3 className="hud-mono mt-3 text-[10px] tracking-widest text-slate-400">WHAT MOVED THE INDEX</h3>
          <ul className="mt-1 space-y-1">
            {ready.contributions.slice(0, 5).map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-slate-300">{c.label}</span>
                <span className="relative h-2 flex-1 rounded bg-white/10">
                  <span
                    className="absolute top-0 h-2 rounded"
                    style={{ background: c.effect < 0 ? "#ff6b8b" : "#00ff9d", width: `${Math.min(50, Math.abs(c.effect) * 4)}%`, [c.effect < 0 ? "right" : "left"]: "50%" }}
                  />
                </span>
                <span className="w-7 text-right tabular-nums text-slate-400">{c.effect > 0 ? "+" : ""}{c.effect}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Signal">
            {series.map((s) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={s.key === sel.key}
                onClick={() => setKey(s.key)}
                className={`rounded-md border px-2.5 py-1 text-xs ${s.key === sel.key ? "border-aegis-cyan bg-aegis-cyan/15 text-white" : "border-white/10 text-slate-300 hover:bg-white/5"}`}
              >
                {s.label}{s.anomaly ? " !" : ""}
              </button>
            ))}
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="rgba(255,255,255,.07)" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "#0a1226", border: "1px solid rgba(0,240,255,.3)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={sel.baselineMean} stroke="#64748b" strokeDasharray="3 3" label={{ value: "baseline", fill: "#64748b", fontSize: 10 }} />
                <Line type="monotone" dataKey="value" name="Logged" stroke="#38bdf8" dot={{ r: 2 }} connectNulls />
                <Line type="monotone" dataKey="ewma" name="EWMA smooth" stroke="#00ff9d" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="forecast" name="7-day projection" stroke="#ffb020" strokeDasharray="5 4" dot={false} strokeWidth={2} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-sm text-slate-200">{explain(sel)}</p>
          {flagged.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-amber-200">
              {flagged.map((s) => (
                <li key={s.key}>
                  {s.anomaly ? "Anomaly" : "Worsening trend"}: {s.label} ({s.z >= 0 ? "+" : ""}{s.z.toFixed(1)} SD from your baseline). Consider a check-in with your medical officer.
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-ok">No anomalies against your personal baseline.</p>
          )}
        </div>
      </div>
      <details className="mt-3 text-xs text-slate-400">
        <summary className="cursor-pointer text-aegis-cyan">How the algorithm works</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Each signal is split: the earlier 60% of your entries set a personal baseline (mean and standard deviation).</li>
          <li>The latest value gets a z-score against that baseline; |z| of 2 or more in the unhealthy direction is flagged as an anomaly.</li>
          <li>An exponentially weighted moving average (alpha 0.4) smooths noise.</li>
          <li>Ordinary least squares over the last 10 entries gives the trend and R2, then a 7-day projection.</li>
          <li>A logistic fusion of all standardised signals (weights shown) produces the 0-100 readiness index.</li>
        </ol>
        <p className="mt-2">Statistics on simulated demo data, run entirely in your browser. Awareness only; it does not diagnose or predict disease.</p>
      </details>
    </Panel>
  );
}
