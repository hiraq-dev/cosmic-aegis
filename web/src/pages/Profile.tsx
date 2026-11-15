import { useState } from "react";
import { History, User } from "lucide-react";
import { useStore } from "../lib/store";
import { FAMILY_HISTORY_OPTIONS } from "../lib/seed";
import { recentActivity } from "../lib/chartData";
import { overall, STATUS_LABEL } from "../lib/assess";
import { btnPrimary, DemoBadge, Disclaimer, Panel, StatusPill } from "../components/ui";

export default function Profile() {
  const { data, updateProfile } = useStore();
  const o = overall(data);
  const [concerns, setConcerns] = useState(data.profile.concerns);
  const [saved, setSaved] = useState(false);
  const all = recentActivity(data, 60);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <User className="text-aegis-cyan" aria-hidden="true" /> Personal health profile
        </h1>
        <DemoBadge text="FICTIONAL PROFILE" />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Profile">
          <p className="text-lg font-semibold text-white">{data.profile.name}</p>
          <p className="text-sm text-slate-300">{data.profile.role}</p>
          <p className="mt-1 text-sm text-slate-400">Age {data.profile.age}</p>
          <p className="mt-3 text-sm text-slate-300">{data.profile.missionName}</p>
        </Panel>
        <Panel title="Health summary">
          <StatusPill status={o.status} />
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            <li>Mental: {STATUS_LABEL[o.mental.status]}</li>
            <li>Muscle &amp; bone: {STATUS_LABEL[o.msk.status]}</li>
            <li>Cardiovascular: {STATUS_LABEL[o.cardio.status]}</li>
          </ul>
        </Panel>
        <Panel title="Optional family health history">
          <fieldset>
            <legend className="sr-only">Family health history</legend>
            <div className="space-y-2">
              {FAMILY_HISTORY_OPTIONS.map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-cyan-400"
                    checked={!!data.profile.familyHistory[opt]}
                    onChange={(e) => updateProfile({ familyHistory: { ...data.profile.familyHistory, [opt]: e.target.checked } })}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-3 text-xs text-slate-400">Optional and stored only in this browser. It does not change any score.</p>
        </Panel>
      </div>

      <Panel title="Personal health concerns">
        <label htmlFor="concerns" className="sr-only">
          Personal health concerns
        </label>
        <textarea
          id="concerns"
          rows={3}
          className="w-full rounded-lg border border-white/15 bg-space-900/80 p-3 text-sm text-white focus:border-aegis-cyan focus:outline-none"
          value={concerns}
          onChange={(e) => {
            setConcerns(e.target.value);
            setSaved(false);
          }}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            className={btnPrimary}
            onClick={() => {
              updateProfile({ concerns });
              setSaved(true);
            }}
          >
            Save concerns
          </button>
          {saved && (
            <span role="status" className="text-sm text-ok">
              Saved. You can bring this to your next medical review.
            </span>
          )}
        </div>
      </Panel>

      <Panel title="Personal health history" icon={<History size={16} aria-hidden="true" />} action={<DemoBadge />}>
        <ul className="max-h-96 space-y-1 overflow-auto text-sm">
          {all.map((a) => (
            <li key={a.id} className="flex gap-3 border-b border-white/5 py-1.5 text-slate-300">
              <span className="w-24 shrink-0 text-slate-500">{a.date}</span>
              <span>{a.text}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Disclaimer />
    </div>
  );
}
