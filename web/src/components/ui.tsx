import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Eye, FlaskConical, Info } from "lucide-react";
import type { Status } from "../lib/types";
import { STATUS_LABEL } from "../lib/assess";

export function Logo({ size = 36 }: { size?: number }) {
  return <img src="/logo.png" width={size} height={size} alt="C.O.S.M.I.C. AEGIS logo" className="rounded-full shadow-[0_0_14px_rgba(0,240,255,.35)]" />;
}

export function Panel({ title, icon, action, children, className = "", mod }: { title?: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; mod?: string }) {
  const ACC = ["#00f0ff", "#00ff9d", "#a78bfa", "#ffb020", "#ff6b8b", "#38bdf8"];
  const n = mod ? parseInt(mod.replace(/\D/g, ""), 10) || 0 : 0;
  const accent = ACC[n % ACC.length];
  return (
    <section className={`glass p-5 ${className}`} style={mod ? { borderTop: `2px solid ${accent}`, boxShadow: `0 8px 32px rgba(0,0,0,.65), 0 -6px 24px -12px ${accent}` } : undefined}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            {mod && <span className="mod-id">{mod}</span>}
            <span className="text-aegis-cyan">{icon}</span>
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  nominal: "bg-ok/15 text-ok border-ok/40",
  watch: "bg-watch/15 text-watch border-watch/40",
  review: "bg-review/15 text-review border-review/40",
};

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const Icon = status === "nominal" ? CheckCircle2 : status === "watch" ? Eye : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>
      <Icon size={14} aria-hidden="true" />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

export function DemoBadge({ text = "DEMO DATA" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-aegis-violet/50 bg-aegis-violet/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-violet-200">
      <FlaskConical size={12} aria-hidden="true" />
      {text}
    </span>
  );
}

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p role="note" className={`flex gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-slate-300 ${className}`}>
      <Info size={16} className="mt-0.5 shrink-0 text-aegis-cyan" aria-hidden="true" />
      <span>
        <strong>Prototype for demonstration only.</strong> C.O.S.M.I.C. AEGIS is not a medical device. It does not diagnose, predict or prevent any condition. All values are
        sample data, and thresholds are illustrative. In a real situation follow your mission medical procedures and contact a flight surgeon.
      </span>
    </p>
  );
}

export function Stat({ label, value, sub, status }: { label: string; value: string; sub?: string; status?: Status }) {
  return (
    <div className="rounded-xl border border-white/10 bg-space-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
      {status && (
        <div className="mt-2">
          <StatusPill status={status} />
        </div>
      )}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-review">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-white/15 bg-space-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-aegis-cyan focus:outline-none";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-aegis-cyan px-4 py-2 text-sm font-semibold text-space-950 transition hover:bg-cyan-300 focus-visible:outline-offset-2 disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10";

export function ResultBox({ title, status, children }: { title: string; status: Status; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={`mt-4 rounded-xl border p-4 ${STATUS_STYLE[status]}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <strong className="text-sm text-white">{title}</strong>
        <StatusPill status={status} />
      </div>
      <div className="space-y-1 text-sm text-slate-200">{children}</div>
    </div>
  );
}
