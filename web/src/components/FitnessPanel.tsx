import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { Panel } from "./ui";
import { EXERCISES, type Exercise } from "../lib/pose";
import { clearFit, hrZone, listFit, weekly } from "../lib/fitness";
import { useStore } from "../lib/store";

/** Fitness monitor: sessions counted by the camera plus heart-rate effort, summarised against the WHO weekly guideline. */
export default function FitnessPanel() {
  const { data } = useStore();
  const [list, setList] = useState(listFit());
  useEffect(() => { const f = () => setList(listFit()); window.addEventListener("aegis-fitness", f); return () => window.removeEventListener("aegis-fitness", f); }, []);
  const w = weekly(list), age = data.profile.age;
  return (
    <Panel title="Fitness monitor" icon={<Dumbbell size={16} aria-hidden="true" />}>
      <div className="grid gap-3 text-sm sm:grid-cols-4">
        {[["Sessions (7 d)", String(w.sessions)], ["Active minutes (7 d)", w.minutes.toFixed(1)], ["Reps (7 d)", String(w.reps)], ["Active days", `${w.activeDays} / 7`]].map(([l, v]) => <div key={l} className="rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-400">{l}</p><p className="text-2xl font-bold text-white">{v}</p></div>)}
      </div>
      <div className="mt-3"><div className="flex justify-between text-xs text-slate-300"><span>Weekly guideline: 150 min of moderate activity (WHO, adults)</span><span>{w.whoPct}% of target (counted camera sets only)</span></div><div className="mt-1 h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-cyan-400" style={{ width: `${w.whoPct}%` }} /></div></div>
      {Object.keys(w.byEx).length > 0 && <p className="mt-2 text-xs text-slate-300">By exercise: {Object.entries(w.byEx).map(([k, v]) => `${EXERCISES[k as Exercise]?.label ?? k} ${v}`).join(" · ")}</p>}
      <div className="mt-3 max-h-48 overflow-auto">
        {!list.length ? <p className="text-xs text-slate-400">No sets yet. Choose an exercise above, start the camera counter, and save a set. Add a heart-rate sensor to see effort.</p> : (
          <table className="w-full text-left text-xs text-slate-200"><thead><tr className="text-[10px] uppercase tracking-wide text-slate-400"><th className="pb-1">When</th><th>Exercise</th><th>Reps</th><th>Time</th><th>Tempo</th><th>Heart rate</th></tr></thead>
            <tbody>{list.slice(0, 20).map((s) => { const z = s.avgHr ? hrZone(s.avgHr, age) : null; return <tr key={s.id} className="border-t border-white/10"><td className="py-1">{new Date(s.when).toLocaleString()}</td><td>{EXERCISES[s.exercise]?.label}</td><td>{s.reps}</td><td>{s.seconds} s</td><td>{s.tempo ?? "-"}/min</td><td>{s.avgHr ? `avg ${s.avgHr}, max ${s.maxHr} (${z!.pct}% of est. max, ${z!.zone})` : "no sensor"}</td></tr>; })}</tbody></table>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>Effort zones use the rough 220 minus age estimate of maximum heart rate (age {age} from the profile). Rep counts come from camera pose and depend on framing.</span>{list.length > 0 && <button className="underline" onClick={() => { if (window.confirm("Delete all saved fitness sets?")) clearFit(); }}>Clear</button>}</div>
    </Panel>
  );
}
