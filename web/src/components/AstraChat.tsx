import { useEffect, useState, useSyncExternalStore } from "react";
import { Send } from "lucide-react";
import { localApi } from "../lib/local";
import { astra, type AstraCtx, type AstraReply } from "../lib/astra";
import { listReports } from "../lib/history";
import { overall } from "../lib/assess";
import { useStore } from "../lib/store";

type Turn = { me?: string; a?: AstraReply };
// One shared conversation, so the robot's pop-up and the page panel show the same chat.
let log: Turn[] = [];
const subs = new Set<() => void>();
const push = (...t: Turn[]) => { log = [...log, ...t]; subs.forEach(f => f()); };
const useLog = () => useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb); }; }, () => log);

const STATE: Record<string, string> = { receiving: "receiving", connected_waiting: "connected, waiting", stale: "stale", disconnected: "disconnected", unavailable: "no sensor", historical_replay: "replay" };

function useCtx(): () => AstraCtx {
  const { data } = useStore();
  const [live, setLive] = useState<{ hr: any[]; card: any; kp: number | null; kpLive: boolean }>({ hr: [], card: {}, kp: null, kpLive: false });
  useEffect(() => {
    const load = async () => {
      const [rows, cards, n] = await Promise.all([localApi("/measurements?metric=heart_rate&since_hours=1"), localApi("/cards"), localApi("/context/nasa")]);
      setLive({ hr: rows, card: cards.cardiovascular?.heart_rate || {}, kp: n.noaa_kp?.data?.current?.kp ?? null, kpLive: !!n.noaa_kp?.live });
    };
    load(); const t = setInterval(load, 3000); return () => clearInterval(t);
  }, []);
  return () => {
    const o = overall(data), rep = listReports()[0], v = live.hr.map((r: any) => r.value as number);
    return {
      hr: { n: v.length, latest: live.card.value ?? null, ageS: live.card.age_s ?? null, min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, mean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, state: STATE[live.card.state] || "no sensor" },
      scan: rep ? { when: rep.when.toLocaleString(), impression: rep.impression, flagged: rep.flagged, postureScore: rep.postureScore, quality: rep.quality, recommendations: rep.recommendations } : null,
      kp: live.kp, kpLive: live.kpLive, sleepH: o.mental.avgSleep, mood: o.mental.score,
    };
  };
}

export default function AstraChat({ maxH = "max-h-72" }: { maxH?: string }) {
  const turns = useLog(), ctx = useCtx(), [q, setQ] = useState("");
  const ask = (text: string) => { const m = text.trim(); if (!m) return; setQ(""); push({ me: m }, { a: astra(m, ctx()) }); };
  return (
    <div>
      <p className="text-xs text-amber-200">ASTRA is a rule-based assistant, not an AI model and not a doctor. It reads your sensor, scan and logs in this browser, and never diagnoses or prescribes.</p>
      <div className={`my-2 ${maxH} space-y-3 overflow-auto text-sm`} aria-live="polite">
        {!turns.length && <p className="text-slate-400">Hi, I'm ASTRA. Tell me what you feel, or ask about your heart rate, stress, sleep, posture or space weather.</p>}
        {turns.map((m, i) => m.me ? <p key={i} className="text-slate-300">You: {m.me}</p> : (
          <div key={i} className={`rounded-lg border p-2 ${m.a!.safety ? "border-red-400/60 bg-red-900/20" : "border-white/10 bg-white/5"}`}>
            <p className="font-semibold text-white">{m.a!.concern}</p>
            {m.a!.findings.length > 0 && <><p className="mt-1 text-xs font-semibold text-cyan-300">What your data shows</p><ul className="list-disc pl-4 text-xs text-slate-200">{m.a!.findings.map((f, j) => <li key={j}>{f}</li>)}</ul></>}
            <p className="mt-1 text-xs font-semibold text-cyan-300">Assessment (wellness level)</p><p className="text-xs text-slate-200">{m.a!.assessment}</p>
            {m.a!.plan.length > 0 && <><p className="mt-1 text-xs font-semibold text-cyan-300">Suggested next steps</p><ul className="list-disc pl-4 text-xs text-slate-200">{m.a!.plan.map((f, j) => <li key={j}>{f}</li>)}</ul></>}
            {m.a!.missing.length > 0 && <p className="mt-1 text-xs text-slate-400">Missing: {m.a!.missing.join(" ")}</p>}
            <p className="mt-1 text-xs font-semibold text-amber-300">Get real care if</p><ul className="list-disc pl-4 text-xs text-slate-300">{m.a!.seekCare.map((f, j) => <li key={j}>{f}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1">{["How is my heart rate?", "I feel stressed", "I am tired", "Review my posture scan", "Space weather today"].map(c => <button key={c} className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-slate-200 hover:bg-white/10" onClick={() => ask(c)}>{c}</button>)}</div>
      <form onSubmit={e => { e.preventDefault(); ask(q); }} className="flex gap-2">
        <input aria-label="Ask ASTRA" className="flex-1 rounded bg-slate-800 p-2 text-sm text-white" value={q} onChange={e => setQ(e.target.value)} placeholder="Describe what you feel or ask about your data" />
        <button className="rounded bg-cyan-500 px-3 text-slate-950" aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}
