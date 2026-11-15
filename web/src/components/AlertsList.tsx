import { AlertTriangle, Bell, CheckCircle2, Eye } from "lucide-react";
import type { Alert } from "../lib/types";
import { DemoBadge } from "./ui";

const ICON = { nominal: CheckCircle2, watch: Eye, review: AlertTriangle } as const;
const COLOR = { nominal: "text-ok", watch: "text-watch", review: "text-review" } as const;

export function AlertsList({ alerts, empty = "No alerts right now." }: { alerts: Alert[]; empty?: string }) {
  if (!alerts.length)
    return (
      <p className="flex items-center gap-2 text-sm text-slate-300">
        <Bell size={16} aria-hidden="true" /> {empty}
      </p>
    );
  return (
    <ul className="space-y-3">
      {alerts.map((a) => {
        const Icon = ICON[a.level];
        return (
          <li key={a.id} className="flex gap-3 rounded-xl border border-white/10 bg-space-900/60 p-3">
            <Icon size={20} className={`mt-0.5 shrink-0 ${COLOR[a.level]}`} aria-label={a.level === "review" ? "Medical review suggested" : a.level === "watch" ? "Watch" : "Information"} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-white">{a.title}</span>
                {a.simulated && <DemoBadge text="SIMULATED" />}
              </div>
              <p className="mt-0.5 text-sm text-slate-300">{a.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
