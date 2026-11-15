import { HeartPulse, Phone, Siren } from "lucide-react";
import { useStore } from "../lib/store";
import { buildAlerts, cardioSummary, vitalStatus } from "../lib/assess";
import { vitalRows } from "../lib/chartData";
import { VitalsForm } from "../components/forms";
import { AlertsList } from "../components/AlertsList";
import { TrendLines } from "../components/charts";
import { DemoBadge, Disclaimer, Panel, Stat, StatusPill } from "../components/ui";

export default function Cardiovascular() {
  const { data } = useStore();
  const c = cardioSummary(data.vitals);
  const rows = vitalRows(data.vitals);
  const alerts = buildAlerts(data).filter((a) => a.module === "cardiovascular");
  const history = [...data.vitals].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <HeartPulse className="text-review" aria-hidden="true" /> Cardiovascular health &amp; risk awareness
          </h1>
          <DemoBadge />
        </div>
        <p className="mt-1 max-w-3xl text-slate-300">
          Spaceflight can change how the heart and blood vessels behave. Logging a few simple readings each day helps you spot changes from your own baseline and decide when to ask for medical review.
        </p>
        <div className="mt-3">
          <Disclaimer />
        </div>
      </header>

      {c.status === "review" && (
        <div role="alert" className="flex gap-3 rounded-xl border border-review/50 bg-review/10 p-4 text-sm text-slate-100">
          <Phone size={20} className="mt-0.5 shrink-0 text-review" aria-hidden="true" />
          <div>
            <strong className="text-white">Medical review suggested.</strong> One or more of your latest readings is outside the demo range. Recheck your measurement, and consider contacting the crew medical officer or a flight surgeon. If you have chest pain or severe symptoms, follow your emergency procedures immediately.
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {c.items.map((i) => (
          <Stat key={i.key} label={i.label} value={i.value} sub={i.note} status={i.status} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Enter today's readings">
          <VitalsForm />
        </Panel>
        <div className="space-y-4">
          <Panel title="Heart rate and blood pressure" action={<DemoBadge />}>
            <TrendLines
              data={rows}
              label="Line chart of heart rate and blood pressure over the last 14 days"
              series={[
                { key: "hr", label: "Heart rate (bpm)", color: "#fb7185" },
                { key: "sys", label: "Systolic (mmHg)", color: "#22d3ee", yAxisId: "right" },
                { key: "dia", label: "Diastolic (mmHg)", color: "#3b82f6", yAxisId: "right" },
              ]}
            />
          </Panel>
          <Panel title="Oxygen saturation (SpO2)">
            <TrendLines data={rows} domain={[88, 100]} height={150} label="Line chart of oxygen saturation over the last 14 days" series={[{ key: "spo2", label: "SpO2 (%)", color: "#34d399" }]} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Indicators needing attention" action={<StatusPill status={c.status} />}>
          <AlertsList alerts={alerts} empty="All of your latest readings are within the demo range." />
        </Panel>
        <Panel title="Know the warning signs" icon={<Siren size={16} aria-hidden="true" />}>
          <p className="text-sm text-slate-300">This is general awareness, not a prediction. Seek urgent medical help immediately if you notice:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
            <li>Chest pain, pressure or tightness</li>
            <li>Shortness of breath or feeling faint</li>
            <li>Pain spreading to the arm, jaw or back</li>
            <li>Cold sweat, nausea or sudden unusual fatigue</li>
          </ul>
          <p className="mt-3 text-xs text-slate-400">AEGIS cannot diagnose a heart attack or any other condition and cannot predict or prevent one.</p>
        </Panel>
      </div>

      <Panel title="Historical readings" action={<DemoBadge />}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Historical vital sign readings</caption>
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th scope="col" className="py-2 pr-4">Date</th>
                <th scope="col" className="pr-4">HR</th>
                <th scope="col" className="pr-4">BP</th>
                <th scope="col" className="pr-4">SpO2</th>
                <th scope="col" className="pr-4">Temp</th>
                <th scope="col" className="pr-4">Glucose</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 14).map((v) => (
                <tr key={v.id} className="border-t border-white/5 text-slate-200">
                  <td className="py-2 pr-4">{v.date}</td>
                  <td className="pr-4">{v.heartRate}</td>
                  <td className="pr-4">
                    {v.systolic}/{v.diastolic}
                  </td>
                  <td className="pr-4">{v.spo2}%</td>
                  <td className="pr-4">{v.tempC ? `${v.tempC.toFixed(1)} C` : "-"}</td>
                  <td className="pr-4">{v.glucose ?? "-"}</td>
                  <td>
                    <StatusPill status={vitalStatus(v)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
