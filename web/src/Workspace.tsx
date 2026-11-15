import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api, hasToken, setToken, stream, API } from "./lib/api";
import { bleSupported, connectHeartRate, type HrConnection } from "./lib/ble";

const Body3D = lazy(() => import("./components/Body3D"));
const CameraPanel = lazy(() => import("./components/CameraPanel"));
const Globe3D = lazy(() => import("./components/Globe3D"));
const webgl = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } })();

const LABEL: Record<string, string> = { receiving: "Connected · receiving", connected_waiting: "Connected · waiting for data", stale: "Delayed / stale", disconnected: "Disconnected", unavailable: "Unavailable — no source", manual: "Manually entered", estimated: "Estimated", historical_replay: "Historical replay" };
const TONE: Record<string, string> = { receiving: "text-cyan-300", stale: "text-amber-300", disconnected: "text-amber-300", unavailable: "text-slate-400" };
const DOMAINS: [string, string, string[]][] = [
  ["cardiovascular", "Cardiovascular", ["heart_rate"]],
  ["mental", "Mental wellbeing", ["mood"]],
  ["sleep", "Sleep & fatigue", ["sleep_hours"]],
  ["exercise", "Exercise & movement", ["exercise_minutes"]],
  ["space_weather", "Radiation dose (dosimeter only)", ["radiation_dose_uSv"]],
  ["cabin", "Cabin CO₂ & temperature", ["co2_ppm", "temperature_c"]],
];
const NOTE: Record<string, string> = {
  exercise: "Camera-derived movement only. AEGIS does not measure bone density or muscle loss.",
  space_weather: "Space-weather context is shown in the NASA panel. A personal dose appears only if a dosimeter reports one.",
  cabin: "Shown only when a physical sensor posts through the authenticated ingest endpoint.",
};

const Card = ({ title, children }: { title: string; children: any }) => (
  <section className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4"><h3 className="mb-2 text-sm font-semibold text-slate-100">{title}</h3>{children}</section>
);
const ago = (s?: number | null) => (s == null ? "" : s < 90 ? `${Math.round(s)} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${(s / 3600).toFixed(1)} h ago`);

function Header({ right }: { right?: any }) {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-[#070d1f]/95 px-4 py-2">
      <div className="flex items-baseline gap-3"><h1 className="text-lg font-bold tracking-wide">AEGIS</h1><span className="text-xs text-slate-400">UTC {t.toISOString().slice(11, 19)}</span></div>
      {right}
    </header>
  );
}

function Auth({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [role, setRole] = useState("crew"), [mode, setMode] = useState<"login" | "register">("login"), [err, setErr] = useState("");
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    try { const r = await api(`/auth/${mode}`, { method: "POST", json: mode === "login" ? { email, password: pw } : { email, password: pw, role } }); setToken(r.token); onDone(); }
    catch (x: any) { setErr(typeof x.message === "string" ? x.message : "Request failed"); }
  };
  return (
    <form onSubmit={go} className="mx-auto mt-10 max-w-sm space-y-3 rounded-xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-lg font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h2>
      <input aria-label="Email" className="w-full rounded bg-slate-800 p-2" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input aria-label="Password" type="password" className="w-full rounded bg-slate-800 p-2" placeholder="password (10+ characters)" value={pw} onChange={e => setPw(e.target.value)} />
      {mode === "register" && <select aria-label="Role" className="w-full rounded bg-slate-800 p-2" value={role} onChange={e => setRole(e.target.value)}><option value="crew">Crew member</option><option value="reviewer">Authorized reviewer</option></select>}
      {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
      <button className="w-full rounded bg-cyan-500 p-2 font-medium text-slate-950">{mode === "login" ? "Sign in" : "Register"}</button>
      <button type="button" className="text-sm text-slate-400 underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Need an account?" : "Have an account?"}</button>
      <p className="text-xs text-slate-500">Prototype. Not medical software, not certified, not endorsed by NASA or any space agency.</p>
    </form>
  );
}

function DomainCard({ k, name, ms, cards, children }: any) {
  return (
    <Card title={name}>
      {ms.map((m: string) => {
        const c = cards?.[k]?.[m];
        return (
          <div key={m} className="mb-1 text-sm">
            <span className="text-slate-400">{m}: </span>
            {c?.value != null && c.state !== "unavailable" ? <b>{c.value} {c.unit}</b> : <span className="text-slate-500">no value</span>}
            <div className={`text-xs ${TONE[c?.state] || "text-slate-300"}`}>
              {LABEL[c?.state] || "Loading…"}{c?.age_s != null && <> · observed {ago(c.age_s)}</>}{c?.timestamp_origin === "receive_time_proxy" && " (receive time used as proxy)"}{c?.source && <> · source: {c.source}</>}
            </div>
          </div>
        );
      })}
      {NOTE[k] && <p className="text-xs text-slate-500">{NOTE[k]}</p>}
      {children}
    </Card>
  );
}

function CheckInForm({ onSave }: { onSave: (p: any) => void }) {
  const [v, setV] = useState(3), [t, setT] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <label>Mood 1–5 <input type="number" min={1} max={5} value={v} onChange={e => setV(+e.target.value)} className="w-14 rounded bg-slate-800 p-1" /></label>
      <input aria-label="Note" className="flex-1 rounded bg-slate-800 p-1" placeholder="optional note" value={t} onChange={e => setT(e.target.value)} />
      <button className="rounded bg-slate-700 px-2 py-1" onClick={() => { onSave({ mood: v, note: t }); setT(""); }}>Save check-in</button>
    </div>
  );
}

function Spark({ pts }: { pts: { t: number; v: number }[] }) {
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, lo = Math.min(...pts.map(p => p.v)) - 2, hi = Math.max(...pts.map(p => p.v)) + 2;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${((p.t - t0) / Math.max(t1 - t0, 1)) * 300},${60 - ((p.v - lo) / (hi - lo)) * 56}`).join(" ");
  return (
    <div>
      <svg viewBox="0 0 300 60" className="w-full" role="img" aria-label="Heart rate over time"><path d={d} fill="none" stroke="#22d3ee" strokeWidth="1.5" /></svg>
      <p className="text-xs text-slate-500">Time axis is real elapsed time; gaps stay gaps. {pts.length} readings.</p>
    </div>
  );
}

function FamilyCard() {
  const [open, setOpen] = useState(false), [txt, setTxt] = useState("");
  return (
    <Card title="Family connection (optional)">
      <button className="text-xs underline" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
      {open && (
        <div className="mt-2 space-y-1 text-xs">
          <p className="text-slate-400">Voluntary history is stored as restricted reviewer context. It is never used to compute disease probabilities.</p>
          <textarea aria-label="Voluntary history" className="w-full rounded bg-slate-800 p-1" value={txt} onChange={e => setTxt(e.target.value)} />
          <button className="rounded bg-slate-700 px-2 py-1" onClick={() => api("/me/history", { method: "PUT", json: { text: txt } })}>Save</button>
        </div>
      )}
    </Card>
  );
}

export default function Workspace() {
  const [authed, setAuthed] = useState(hasToken());
  const [me, setMe] = useState<any>(null), [cards, setCards] = useState<any>({}), [nasa, setNasa] = useState<any>({}), [notes, setNotes] = useState<any[]>([]), [checkins, setCheckins] = useState<any[]>([]);
  const [pose, setPose] = useState<any>(null), [hr, setHr] = useState<{ t: number; v: number }[]>([]), [region, setRegion] = useState(""), [ble, setBle] = useState<HrConnection | null>(null), [bleErr, setBleErr] = useState(""), [live, setLive] = useState(false);
  const [chat, setChat] = useState<any[]>([]), [q, setQ] = useState(""), [astat, setAstat] = useState<any>(null), [pending, setPending] = useState<any[]>([]);
  const dev = useRef("");

  const refresh = useCallback(async () => {
    try {
      const [c, n, ck, rows] = await Promise.all([api("/cards"), api("/notes"), api("/checkins"), api("/measurements?metric=heart_rate&since_hours=1")]);
      setCards(c); setNotes(n); setCheckins(ck); setHr(rows.map((r: any) => ({ t: Date.parse(r.observed_at), v: r.value })));
    } catch (e: any) { if (e.status === 401) { setToken(""); setAuthed(false); } }
  }, []);

  useEffect(() => {
    const load = () => api("/context/nasa").then(setNasa).catch(() => setNasa({}));
    load(); const t = setInterval(load, 60000); return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!authed) return;
    const ac = new AbortController();
    api("/me").then(setMe).catch(() => {}); api("/assistant/status").then(setAstat).catch(() => {}); refresh();
    stream(() => { setLive(true); refresh(); }, ac.signal);
    const t = setInterval(refresh, 5000); // re-evaluates freshness even when no events arrive
    return () => { ac.abort(); clearInterval(t); };
  }, [authed, refresh]);

  // Readings are queued locally when the server is unreachable and retried; the UI shows how many are pending.
  const send = useCallback(async (events: any[]) => {
    try { await api("/measurements", { method: "POST", json: { events } }); setPending([]); }
    catch { setPending(p => [...p, ...events].slice(-500)); }
  }, []);
  useEffect(() => { if (pending.length) { const t = setTimeout(() => send(pending), 5000); return () => clearTimeout(t); } }, [pending, send]);

  const pair = async () => {
    setBleErr("");
    try {
      let seq = 0;
      const c = await connectHeartRate(
        (s, at) => send([{ event_id: `${dev.current}-${at.getTime()}-${seq}`, device_id: dev.current, metric: "heart_rate", value: s.bpm, unit: "bpm", observed_at: at.toISOString(), timestamp_origin: "device", source: "BLE Heart Rate Service", source_type: "device", sequence: seq++, context: "unknown", quality_flags: s.contact === false ? ["no_skin_contact"] : [] }]),
        st => { if (dev.current) api(`/devices/${dev.current}/state`, { method: "POST", json: { state: st } }).catch(() => {}); if (st === "disconnected") setBle(null); },
      );
      dev.current = c.deviceId;
      await api("/devices", { method: "POST", json: { id: c.deviceId, kind: "ble_heart_rate", label: c.name } });
      await api(`/devices/${c.deviceId}/state`, { method: "POST", json: { state: "connected" } });
      setBle(c);
    } catch (e: any) { setBleErr(e.message || "Pairing cancelled"); }
  };
  useEffect(() => () => { ble?.disconnect(); }, [ble]);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault(); const m = q.trim(); if (!m) return; setQ(""); setChat(c => [...c, { who: "you", text: m }]);
    try { const r = await api("/assistant/chat", { method: "POST", json: { message: m } }); setChat(c => [...c, { who: "aegis", ...r }]); }
    catch (x: any) { setChat(c => [...c, { who: "aegis", mode: "error", ai_generated: false, text: String(x.message) }]); }
  };
  const checkin = async (kind: string, payload: any) => { await api("/checkins", { method: "POST", json: { kind, payload } }); refresh(); };

  if (!authed) return <div className="min-h-screen bg-[#070d1f] p-4 text-slate-100"><Header /><Auth onDone={() => setAuthed(true)} /></div>;

  const eon = nasa.eonet?.data?.events ?? [], iss = nasa.iss?.data;
  const pins = [...eon.slice(0, 80).map((e: any) => ({ lat: e.lat, lon: e.lon, color: "#f59e0b", label: e.title })), ...(iss && nasa.iss.live ? [{ lat: iss.lat, lon: iss.lon, color: "#22d3ee", label: "ISS (predicted)" }] : [])];

  return (
    <div className="min-h-screen bg-[#070d1f] text-slate-100">
      <Header right={
        <div className="flex items-center gap-3 text-xs">
          <span aria-live="polite" className={live ? "text-cyan-300" : "text-amber-300"}>{live ? "Server stream connected" : "Server stream not connected"}</span>
          {pending.length > 0 && <span className="text-amber-300">{pending.length} queued, pending send</span>}
          <button className="underline" onClick={() => { setToken(""); setAuthed(false); }}>Sign out</button>
        </div>} />
      <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_1.1fr_1fr]">
        <div className="space-y-3">
          {DOMAINS.slice(0, 3).map(([k, name, ms]) => (
            <DomainCard key={k} k={k} name={name} ms={ms} cards={cards}>
              {k === "cardiovascular" && (
                <div className="mt-2 space-y-1">
                  {bleSupported()
                    ? <button className="rounded bg-cyan-500 px-3 py-1 text-sm font-medium text-slate-950" onClick={ble ? () => ble.disconnect() : pair}>{ble ? `Disconnect ${ble.name}` : "Pair heart-rate sensor"}</button>
                    : <p className="text-xs text-amber-300">Web Bluetooth is not available in this browser. Use Chrome or Edge on HTTPS or localhost.</p>}
                  {bleErr && <p role="alert" className="text-xs text-red-400">{bleErr}</p>}
                  <p className="text-xs text-slate-500">Works with sensors exposing the standard BLE Heart Rate Service. Blood pressure, SpO₂, ECG and respiration are not collected.</p>
                </div>
              )}
              {k === "mental" && <CheckInForm onSave={p => checkin("mood", p)} />}
            </DomainCard>
          ))}
        </div>
        <div className="space-y-3">
          <Card title="Crew visualization (3D)">
            <div className="h-72">
              {webgl ? <Suspense fallback={<p className="text-sm text-slate-400">Loading 3D…</p>}><Body3D pose={pose} region={region} onPick={setRegion} /></Suspense>
                : <p className="text-sm text-slate-400">WebGL is unavailable; showing text only. Selected region: {region || "none"}.</p>}
            </div>
            <p className="text-xs text-slate-400">Reference posture, not a validated digital twin. Limbs move only from camera landmarks. {region && <>Selected: <b>{region}</b>.</>} </p>
            <Suspense fallback={null}><CameraPanel onPose={setPose} /></Suspense>
          </Card>
          <Card title="Heart rate, last hour">{hr.length ? <Spark pts={hr} /> : <p className="text-sm text-slate-400">No readings yet. Pair a sensor to begin.</p>}</Card>
        </div>
        <div className="space-y-3">{DOMAINS.slice(3).map(([k, name, ms]) => <DomainCard key={k} k={k} name={name} ms={ms} cards={cards} />)}</div>

        <section className="grid gap-4 md:grid-cols-2 lg:col-span-3">
          <Card title="NASA and space-weather context">
            <div className="h-64">{webgl ? <Suspense fallback={null}><Globe3D pins={pins} /></Suspense> : <p className="text-sm text-slate-400">Globe unavailable without WebGL.</p>}</div>
            <ul className="mt-2 space-y-1 text-xs">
              {["noaa_kp", "noaa_scales", "donki", "eonet", "gibs", "iss"].map(s => {
                const d = nasa[s];
                return <li key={s}><b>{s}</b>: <span className={d?.live ? "text-cyan-300" : "text-amber-300"}>{d ? (d.live ? "LIVE" : d.freshness === "cached" ? "CACHED" : "UNAVAILABLE") : "unknown"}</span>{d?.age_s != null && <> · retrieved {ago(d.age_s)}</>}{d?.times?.observed_at && <> · observed {d.times.observed_at}</>}{d?.error && <> · {d.error}</>}{d?.data?.provider && <> · {d.data.provider}</>}</li>;
              })}
            </ul>
            <p className="mt-1 text-xs text-slate-500">Kp now: {nasa.noaa_kp?.data?.current?.kp ?? "unknown"}. Space-weather context does not by itself indicate any personal health effect. Historical DONKI counts: {JSON.stringify(nasa.donki?.data?.history_counts ?? {})}.</p>
          </Card>
          <Card title="Check-ins, observations and review notes">
            <ul className="max-h-40 space-y-1 overflow-auto text-xs">
              {checkins.map(c => <li key={c.id}>{c.observed_at.slice(0, 16)} · {c.kind} · {JSON.stringify(c.payload)}</li>)}
              {!checkins.length && <li className="text-slate-400">No check-ins. Nothing is pre-filled.</li>}
            </ul>
            <h4 className="mt-3 text-xs font-semibold">Shared review notes</h4>
            <ul className="space-y-1 text-xs">
              {notes.map(n => <li key={n.id}>{n.body} <span className="text-slate-500">sent {n.sent_at.slice(0, 16)} · delivered · {n.acknowledged_at ? "acknowledged" : <button className="underline" onClick={() => api(`/notes/${n.id}/ack`, { method: "POST" }).then(refresh)}>acknowledge</button>}</span></li>)}
              {!notes.length && <li className="text-slate-400">None.</li>}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Communication with distant reviewers can be delayed. Notes show sent, delivered and acknowledged separately; they are never implied to be instant.</p>
          </Card>
          <Card title="Assistant">
            <p className="text-xs text-slate-400">Mode: <b>{astat ? astat.mode : "unknown"}</b>{astat && !astat.model_available && " (no language model answering; retrieval only)"} · {astat?.research_passages ?? 0} research passages.</p>
            <label className="my-1 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!me?.external_model_consent} onChange={e => api("/me/consent/external-model", { method: "PUT", json: { external_model: e.target.checked } }).then(() => { api("/me").then(setMe); api("/assistant/status").then(setAstat); })} />
              Allow sending my measurements, check-ins and question to an external language model
            </label>
            <div className="max-h-56 space-y-2 overflow-auto text-sm" aria-live="polite">
              {chat.map((m, i) => (
                <div key={i}>
                  {m.who === "you" ? <p className="text-slate-300">You: {m.text}</p> : (
                    <div>
                      <p><span className="text-xs uppercase text-cyan-300">{m.mode}{m.ai_generated ? " · AI" : " · not AI"}</span> {m.text}</p>
                      {m.reason && <p className="text-xs text-amber-300">{m.reason}</p>}
                      {m.sections?.missing_information?.length > 0 && <p className="text-xs text-slate-400">Missing: {m.sections.missing_information.join(", ")}</p>}
                      {m.citations?.map((c: any) => <p key={c.ref} className="text-xs text-slate-400">[{c.ref}] {c.document}{c.page ? ` p.${c.page}` : ""}: {c.text.slice(0, 160)}…</p>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={ask} className="mt-2 flex gap-2">
              <input aria-label="Ask" className="flex-1 rounded bg-slate-800 p-2 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about your data or NASA research" />
              <button className="rounded bg-cyan-500 px-3 text-sm font-medium text-slate-950">Ask</button>
            </form>
            <p className="mt-1 text-xs text-slate-500">Research reports are literature, not treatment protocols. No diagnosis or prescriptions.</p>
          </Card>
          <FamilyCard />
        </section>
      </main>
      <footer className="p-4 text-center text-xs text-slate-500">AEGIS is a prototype built for the NASA Space Apps Challenge. Not medical software, not certified, not endorsed by NASA. Parts of this project were built with AI assistance. API: {API || "same origin"}</footer>
    </div>
  );
}
