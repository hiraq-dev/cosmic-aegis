import { BookOpen, ExternalLink } from "lucide-react";
import { CHALLENGE_URL, REPO_URL, SOURCES, TEAM_MEMBERS, TEAM_NAME } from "../lib/team";
import { DemoBadge, Disclaimer, Panel } from "../components/ui";

export default function Sources() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <BookOpen className="text-aegis-cyan" aria-hidden="true" /> Sources &amp; prototype status
        </h1>
        <p className="mt-1 max-w-3xl text-slate-300">
          Built by {TEAM_NAME} ({TEAM_MEMBERS}) for the{" "}
          <a className="text-aegis-cyan underline" href={CHALLENGE_URL} target="_blank" rel="noreferrer">
            2026 NASA Space Apps Challenge: Create Health Monitoring Software for Astronauts on Space Missions
          </a>
          .
        </p>
      </header>

      <Panel title="NASA and CSA resources referenced">
        <p className="mb-4 text-sm text-slate-300">
          These public resources shaped the topics, indicators and explanations. <strong>No NASA or CSA dataset, API or live feed is connected.</strong> Every number you see in the dashboard is demo data. NASA and CSA do not endorse this project, and this
          prototype is not affiliated with them.
        </p>
        <ul className="space-y-4">
          {SOURCES.map((s) => (
            <li key={s.url} className="rounded-xl border border-white/10 bg-space-900/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-aegis-blue/20 px-2 py-0.5 text-[11px] font-semibold text-blue-200">{s.org}</span>
                <a className="inline-flex items-center gap-1 text-sm font-medium text-aegis-cyan hover:underline" href={s.url} target="_blank" rel="noreferrer">
                  {s.name} <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
              <p className="mt-1 break-all text-xs text-slate-500">{s.url}</p>
              <p className="mt-2 text-sm text-slate-300">
                <strong className="text-slate-100">How it is used:</strong> {s.usedFor}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Real versus simulated" action={<DemoBadge />}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Which parts of the prototype are implemented, simulated or future work</caption>
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th scope="col" className="py-2 pr-4">Feature</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {[
                ["Check-in, vitals and exercise forms with validation", "Implemented"],
                ["Charts, trends and rule-based alerts", "Implemented (illustrative thresholds)"],
                ["Saving entries in your browser", "Implemented (localStorage, no server)"],
                ["Astronaut profile, mission, 14-day history", "Simulated demo data"],
                ["Radiation, CO2 and cabin temperature", "Simulated demo data"],
                ["Bone monitoring status", "Simulated (derived from exercise, not measured)"],
                ["Computer-vision exercise analysis", "Future integration (see src/integrations)"],
                ["Machine-learning health analysis", "Future integration"],
                ["Wearable and sensor data", "Future integration"],
                ["Clinical validation and flight-surgeon workflows", "Future work with medical teams"],
              ].map(([f, s]) => (
                <tr key={f} className="border-t border-white/5">
                  <td className="py-2 pr-4">{f}</td>
                  <td>{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="AI assistance and attribution">
        <p className="text-sm text-slate-300">
          This website's code, text and illustrations were created with AI assistance (Claude by Anthropic). The astronaut illustration is original AI-assisted vector artwork and contains no NASA or other agency logos, flags or insignia. Source code:{" "}
          <a className="text-aegis-cyan underline" href={REPO_URL} target="_blank" rel="noreferrer">
            {REPO_URL}
          </a>
          .
        </p>
      </Panel>
      <Disclaimer />
    </div>
  );
}
