import { useEffect, useState } from "react";
import { Radio, Siren, Wifi, WifiOff } from "lucide-react";
import { Panel, DemoBadge, Disclaimer, btnGhost, btnPrimary } from "../components/ui";
import { useStore } from "../lib/store";
import { missionStatus, overall } from "../lib/assess";

interface Pkt {
  id: number;
  kind: string;
  bytes: string;
  sent: boolean;
}

function Queue() {
  const { data } = useStore();
  const ms = missionStatus(data);
  const [blackout, setBlackout] = useState(false);
  const [q, setQ] = useState<Pkt[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  const add = (kind: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const bytes = Array.from({ length: 12 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join(" ");
    setQ((p) => [{ id, kind, bytes, sent: false }, ...p].slice(0, 8));
  };
  useEffect(() => {
    if (blackout || !q.some((p) => !p.sent)) return;
    const t = setTimeout(() => setQ((p) => p.map((x) => ({ ...x, sent: true }))), 1500);
    return () => clearTimeout(t);
  }, [blackout, q]);

  return (
    <div>
      <p className="text-sm text-slate-300">Simulated one-way delay about <strong className="text-white">{ms.oneWayMin} min</strong> at {ms.distanceMkm} million km. Nothing is sent anywhere. Packets are random placeholder bytes, not real telemetry.</p>
      <div className="my-3 flex flex-wrap gap-2">
        <button className={btnGhost} onClick={() => add("Check-in summary")}>Queue check-in</button>
        <button className={btnGhost} onClick={() => add("Vitals reading")}>Queue vitals</button>
        <button className={blackout ? btnPrimary : btnGhost} aria-pressed={blackout} onClick={() => setBlackout((b) => !b)}>
          {blackout ? <WifiOff size={14} /> : <Wifi size={14} />} {blackout ? "Blackout on" : "Simulate blackout"}
        </button>
      </div>
      <ul className="space-y-2" aria-live="polite">
        {q.length === 0 && <li className="text-sm text-slate-400">Queue is empty.</li>}
        {q.map((p) => (
          <li key={p.id} className="rounded-lg border border-white/10 bg-space-900/60 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-100">{p.kind}</span>
              <span className={p.sent ? "text-ok" : "text-watch"}>{p.sent ? "Delivered (simulated)" : blackout ? "Held: blackout" : "Sending..."}</span>
            </div>
            <button className="mt-1 text-xs text-aegis-cyan underline" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Hide" : "Inspect"} bytes</button>
            {open === p.id && <code className="mt-1 block break-all text-xs text-slate-300">{p.bytes}</code>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ground() {
  const { data } = useStore();
  const o = overall(data);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 120);
    return () => clearInterval(t);
  }, []);
  const pts = Array.from({ length: 80 }, (_, i) => {
    const k = (i + tick) % 40;
    const y = k === 18 ? -26 : k === 19 ? 14 : k === 20 ? -4 : k > 26 && k < 31 ? -5 : 0;
    return `${i * 5},${30 + y}`;
  }).join(" ");
  return (
    <div>
      <svg viewBox="0 0 400 60" className="h-20 w-full rounded-lg bg-space-900/70" role="img" aria-label="Synthetic ECG-like line drawn by a script. Not real data.">
        <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
      </svg>
      <p className="mt-1 text-xs text-slate-400">Synthetic wave drawn by a script. It is not an ECG and not a measurement.</p>
      <p className="mt-2 text-sm text-slate-200">Mock ground view of the same demo data: overall {o.score}/100, mental {o.mental.score}, muscle and bone {o.msk.score}, cardiovascular {o.cardio.score}.</p>
    </div>
  );
}

function Sos() {
  const [n, setN] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (n === null) return;
    if (n <= 0) { setN(null); setDone(true); return; }
    const t = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div>
      <p className="text-sm text-slate-300">A practice screen for how an alert flow could feel. <strong className="text-white">It does not contact anyone.</strong> In a real emergency use your mission procedures.</p>
      {n !== null ? (
        <div role="alertdialog" aria-label="Simulated SOS countdown" className="mt-3 rounded-xl border border-review bg-review/20 p-5 text-center">
          <div className="text-5xl font-bold text-white" aria-live="assertive">{n}</div>
          <p className="my-2 text-sm text-slate-100">Practice alert will "send" when this reaches 0. Nothing is transmitted.</p>
          <button className={btnPrimary} autoFocus onClick={() => setN(null)}>Cancel</button>
        </div>
      ) : (
        <div className="mt-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-review px-4 py-2 text-sm font-semibold text-white" onClick={() => { setDone(false); setN(10); }}>
            <Siren size={16} aria-hidden="true" /> Practice SOS (simulated)
          </button>
          {done && <p role="status" className="mt-2 text-sm text-slate-200">Practice finished. No message was sent.</p>}
        </div>
      )}
    </div>
  );
}

export default function Comms() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Comms & SOS</h1>
        <p className="text-sm text-slate-300">Simulated delay-tolerant queue, mock ground view and a practice alert screen. <DemoBadge text="SIMULATED" /></p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel mod="MOD-09" title="Delay-tolerant queue" icon={<Radio size={16} />}><Queue /></Panel>
        <Panel mod="MOD-10" title="Mock ground console" icon={<Radio size={16} />}><Ground /></Panel>
        <div id="sos" className="scroll-mt-40 lg:col-span-2"><Panel mod="MOD-08" title="Practice SOS" icon={<Siren size={16} />}><Sos /></Panel></div>
      </div>
      <Disclaimer />
    </div>
  );
}
