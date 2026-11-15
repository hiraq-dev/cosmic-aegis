import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Sun } from "lucide-react";
import { DemoBadge, Panel } from "./ui";

// LIVE data: NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) via the NASA Open APIs.
// Read-only, fetched in the visitor's browser. Falls back gracefully if the API is unreachable or rate limited.
const KEY = (import.meta.env.VITE_NASA_API_KEY as string | undefined) || "DEMO_KEY";
const BASE = "https://api.nasa.gov/DONKI";
const CACHE = "aegis-donki-v2";
const TTL = 30 * 60 * 1000;

interface Ev { id: string; time: string; link?: string }
interface Feed { gst: (Ev & { kp: number })[]; sep: Ev[]; cme: Ev[]; rbe: Ev[]; hss: Ev[]; fetchedAt: number; snapshot?: boolean }

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Offline snapshot of real DONKI events (fetched 15 Nov 2026), shown only if the live call fails (e.g. DEMO_KEY rate limit).
const SNAPSHOT: Feed = {
  gst: [{ id: "2026-10-31T18:00:00-GST-001", time: "2026-10-31T18:00Z", kp: 6, link: "https://ccmc.gsfc.nasa.gov/DONKI/view/GST/49348/-1" }],
  sep: [],
  cme: [{ id: "2026-10-16T06:09:00-CME-001", time: "2026-10-16T06:09Z" }],
  rbe: [{ id: "2026-10-16T13:20:00-RBE-001", time: "2026-10-16T13:20Z", link: "https://ccmc.gsfc.nasa.gov/DONKI/view/RBE/49129/-1" }],
  hss: [{ id: "2026-10-21T09:46:00-HSS-001", time: "2026-10-21T09:46Z" }],
  fetchedAt: Date.parse("2026-11-15T15:00:00Z"),
  snapshot: true,
};

// One request only: the DONKI notifications feed contains every event type, which keeps us inside the API's rate limit.
async function load(): Promise<Feed> {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE) || "null") as Feed | null;
    if (c && Date.now() - c.fetchedAt < TTL) return c;
  } catch { /* ignore */ }
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400000);
  const r = await fetch(`${BASE}/notifications?startDate=${iso(start)}&endDate=${iso(end)}&type=all&api_key=${KEY}`);
  if (!r.ok) throw new Error(String(r.status));
  const msgs: any[] = await r.json();
  if (!Array.isArray(msgs)) throw new Error("bad");
  const of = (t: string): Ev[] => msgs.filter((m) => m.messageType === t).map((m) => ({ id: m.messageID, time: m.messageIssueTime, link: m.messageURL }));
  const gst = msgs.filter((m) => m.messageType === "GST").map((m) => {
    const k = /Kp[^0-9]{0,40}(d(?:.d+)?)/i.exec(m.messageBody || "");
    return { id: m.messageID, time: m.messageIssueTime, link: m.messageURL, kp: k ? Number(k[1]) : 0 };
  });
  const feed: Feed = { gst, sep: of("SEP"), cme: of("CME"), rbe: of("RBE"), hss: of("HSS"), fetchedAt: Date.now() };
  try { sessionStorage.setItem(CACHE, JSON.stringify(feed)); } catch { /* ignore */ }
  return feed;
}

// Plain-language radiation awareness from real events (awareness only, not a dose measurement).
function level(f: Feed): { label: string; tone: string; text: string } {
  const maxKp = Math.max(0, ...f.gst.map((g) => g.kp));
  if (f.sep.length > 0 || maxKp >= 7)
    return { label: "ELEVATED", tone: "#ff2a55", text: "Solar energetic particle activity or a strong geomagnetic storm was reported in the last 30 days. Crews would normally be told to shelter in the most shielded area if a storm is ongoing." };
  if (maxKp >= 5 || f.rbe.length > 0)
    return { label: "WATCH", tone: "#ffb020", text: "Geomagnetic storms or radiation belt enhancements occurred recently. Space-weather teams monitor these for crew and satellite safety." };
  return { label: "QUIET", tone: "#00ff9d", text: "No major storms or solar particle events reported in the last 30 days." };
}

export default function SpaceWeather() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(true);

  const run = () => {
    setBusy(true); setErr(false);
    load().then(setFeed).catch(() => { setFeed(SNAPSHOT); setErr(true); }).finally(() => setBusy(false));
  };
  useEffect(run, []);

  const lv = feed ? level(feed) : null;
  const latest = feed
    ? [...feed.gst.map((e) => ({ ...e, t: "Geomagnetic storm", extra: `Kp ${e.kp}` })), ...feed.sep.map((e) => ({ ...e, t: "Solar energetic particle event", extra: "" })), ...feed.rbe.map((e) => ({ ...e, t: "Radiation belt enhancement", extra: "" })), ...feed.cme.map((e) => ({ ...e, t: "Coronal mass ejection", extra: "" })), ...feed.hss.map((e) => ({ ...e, t: "High-speed solar wind stream", extra: "" }))]
        .sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5)
    : [];
  const stat = (l: string, n: number | string, c: string) => (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
      <div className="font-display text-2xl font-bold tabular-nums" style={{ color: c, textShadow: `0 0 10px ${c}66` }}>{n}</div>
      <div className="hud-mono mt-0.5 text-[10px] tracking-wider text-slate-400">{l}</div>
    </div>
  );

  return (
    <Panel
      title="Live NASA space weather (radiation awareness)"
      icon={<Sun size={16} aria-hidden="true" />}
      action={<DemoBadge text="LIVE NASA DATA" />}
    >
      {busy && !feed && <p className="text-sm text-slate-300" role="status">Contacting NASA DONKI...</p>}
      {err && !feed && (
        <p className="text-sm text-slate-300" role="status">
          NASA DONKI could not be reached right now (it may be rate limited). The rest of AEGIS still works.{" "}
          <button className="text-aegis-cyan underline" onClick={run}>Try again</button>
        </p>
      )}
      {feed && lv && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="hud-mono rounded-md border px-2.5 py-1 text-xs font-bold tracking-widest" style={{ color: lv.tone, borderColor: lv.tone, boxShadow: `0 0 12px ${lv.tone}55` }}>{lv.label}</span>
            <p className="min-w-[240px] flex-1 text-sm text-slate-200">{lv.text}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {stat("STORMS (GST)", feed.gst.length, "#ff6b8b")}
            {stat("PEAK Kp", Math.max(0, ...feed.gst.map((g) => g.kp)) || "-", "#ffb020")}
            {stat("SOLAR PARTICLE (SEP)", feed.sep.length, "#a78bfa")}
            {stat("RADIATION BELT (RBE)", feed.rbe.length, "#00f0ff")}
            {stat("CMEs", feed.cme.length, "#38bdf8")}
          </div>
          <ul className="mt-3 space-y-1 text-xs text-slate-300">
            {latest.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-2">
                <span className="hud-mono text-slate-500">{e.time.replace("T", " ").replace("Z", " UTC")}</span>
                <span>{e.t}{e.extra ? ` (${e.extra})` : ""}</span>
                {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-aegis-cyan hover:underline">details <ExternalLink size={10} aria-hidden="true" /></a>}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            {feed.snapshot ? "Live NASA call is rate limited right now, so this is a saved snapshot of real DONKI events from 15 Nov 2026. " : ""}Source: NASA DONKI space-weather database via api.nasa.gov, last 30 days, updated {new Date(feed.fetchedAt).toLocaleString()}. Awareness only, not a dose measurement or medical advice.
            <button className="inline-flex items-center gap-1 text-aegis-cyan hover:underline" onClick={run} disabled={busy}><RefreshCw size={11} className={busy ? "animate-spin" : ""} aria-hidden="true" /> Refresh</button>
          </p>
        </>
      )}
    </Panel>
  );
}
