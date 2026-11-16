// Browser-only mode: used when no backend is configured (VITE_API_URL empty). Everything is stored in this browser.
// Same endpoint shapes as the server so the workspace code is unchanged. No data is invented: empty stays empty.
type J = any;
const KEY = "aegis-local-v2";
const DOMAINS: Record<string, string[]> = { cardiovascular: ["heart_rate"], mental: ["mood"], sleep: ["sleep_hours"], exercise: ["exercise_minutes"], space_weather: ["radiation_dose_uSv"], cabin: ["co2_ppm", "temperature_c"] };
const STALE: Record<string, number> = { heart_rate: 15, co2_ppm: 120, temperature_c: 120 };
// NASA Open APIs key (free, rate-limit key, visible in the page code by design: this site has no backend). Override with VITE_NASA_API_KEY.
const NASA_KEY = (import.meta.env.VITE_NASA_API_KEY as string | undefined) || "DR9Cq9wMndpRTRnF8dK9qLftTFdMpGKThfLzHg8h";
const INTERVAL: Record<string, number> = { noaa_wind: 120, noaa_scales: 120, noaa_kp: 120, donki: 900, eonet: 1800, gibs: 3600, iss: 20 };

interface Store { measurements: J[]; checkins: J[]; history: string; devices: Record<string, string>; consent: boolean; nasa: Record<string, J>; seq: number }
let mem: Store = { measurements: [], checkins: [], history: "", devices: {}, consent: false, nasa: {}, seq: 0 };
try { const s = localStorage.getItem(KEY); if (s) mem = { ...mem, ...JSON.parse(s) }; } catch { /* storage blocked: memory only */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...mem, measurements: mem.measurements.slice(-5000), nasa: mem.nasa })); } catch { /* quota */ } };

const RANGES: Record<string, [number, number]> = { heart_rate: [20, 250], co2_ppm: [250, 40000], temperature_c: [-20, 60] };

function ingest(events: J[]) {
  const now = Date.now(); let stored = 0, duplicates = 0, late = 0;
  for (const e of events) {
    if (mem.measurements.some(m => m.device_id === e.device_id && m.event_id === e.event_id)) { duplicates++; continue; }
    const flags: string[] = [...(e.quality_flags || [])];
    let obs = e.observed_at ? Date.parse(e.observed_at) : NaN, origin = e.timestamp_origin || "device";
    if (!Number.isFinite(obs)) { obs = now; origin = "receive_time_proxy"; flags.push("timestamp_proxy"); }
    if (obs > now + 60000) flags.push("future_timestamp");
    const r = RANGES[e.metric]; if (r && (e.value < r[0] || e.value > r[1])) flags.push("implausible_value");
    const newest = mem.measurements.filter(m => m.device_id === e.device_id && m.metric === e.metric).reduce((a, m) => Math.max(a, Date.parse(m.observed_at)), 0);
    if (obs < newest) { flags.push("late"); late++; }
    mem.measurements.push({ ...e, observed_at: new Date(obs).toISOString(), received_at: new Date(now).toISOString(), timestamp_origin: origin, quality_flags: flags, source: e.source || e.device_id });
    stored++;
  }
  save(); return { stored, duplicates, late, rejected: 0 };
}

function cardState(m: string, now: number) {
  const rows = mem.measurements.filter(x => x.metric === m);
  const last = rows.reduce<J>((a, x) => (!a || Date.parse(x.observed_at) > Date.parse(a.observed_at) ? x : a), null);
  const connected = Object.entries(mem.devices).some(([, s]) => s === "connected");
  if (!last) return { state: m === "heart_rate" && connected ? "connected_waiting" : "unavailable" };
  const age = (now - Date.parse(last.observed_at)) / 1000, stale = STALE[m] ?? 300;
  const devState = mem.devices[last.device_id];
  let state = "receiving";
  if (last.source_type === "replay") state = "historical_replay";
  else if (last.source_type === "manual") state = "manual";
  else if (last.source_type === "estimated") state = "estimated";
  else if (devState === "disconnected" || age > stale * 3) state = "disconnected";
  else if (age > stale) state = "stale";
  return { state, age_s: Math.round(age), value: last.value, unit: last.unit, observed_at: last.observed_at, source: last.source, source_type: last.source_type, timestamp_origin: last.timestamp_origin, quality_flags: last.quality_flags };
}

// ---- NASA / NOAA, fetched by the browser; each source keeps its last good payload with its own retrieval time -----------------------
const utc = (s?: string) => (s ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z").toISOString() : null);
async function getJ(url: string, ms = 12000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(url, { signal: c.signal }); if (r.status === 429) throw new Error("rate_limited"); if (!r.ok) throw new Error("http " + r.status); return r.json(); } finally { clearTimeout(t); } }
const FETCH: Record<string, () => Promise<J>> = {
  async noaa_kp() { const d = await getJ("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"); const l = [...d].reverse().find((r: J) => r.estimated_kp != null); return { provider: "NOAA Space Weather Prediction Center", current: { kp: l ? Number(l.estimated_kp) : null }, observed_at: l ? utc(l.time_tag) : null }; },
  async noaa_wind() {
    const [sp, mag] = await Promise.all([getJ("https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json"), getJ("https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json")]);
    const a = Array.isArray(sp) ? sp[0] : null, b = Array.isArray(mag) ? mag[0] : null; if (!a && !b) throw new Error("schema"); const speed = Number(a?.proton_speed), bz = Number(b?.bz_gsm), bt = Number(b?.bt);
    return { provider: "NOAA Space Weather Prediction Center (DSCOVR / ACE at L1)", current: { speed_kms: Number.isFinite(speed) ? speed : null, bz_nT: Number.isFinite(bz) ? bz : null, bt_nT: Number.isFinite(bt) ? bt : null }, observed_at: utc(a?.time_tag ?? b?.time_tag) };
  },
  async noaa_scales() { const d = await getJ("https://services.swpc.noaa.gov/products/noaa-scales.json"); const c = d["0"]; if (!c) throw new Error("schema"); const sc = (k: string) => { const v = c[k]?.Scale; return v === undefined || v === null || v === "" ? null : Number(v); }; return { provider: "NOAA Space Weather Prediction Center", current: { radio_blackout_R: sc("R"), solar_radiation_storm_S: sc("S"), geomagnetic_G: sc("G") }, observed_at: utc(`${c.DateStamp}T${c.TimeStamp}`) }; },
  async eonet() { const d = await getJ("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=150"); const ev: J[] = []; let skipped = 0; for (const e of d.events || []) { const g = (e.geometry || []).slice(-1)[0]; let p: number[] | null = null; if (g?.type === "Point") p = g.coordinates; else if (g?.type === "Polygon") { const r = g.coordinates[0]; p = [r.reduce((a: number, q: number[]) => a + q[0], 0) / r.length, r.reduce((a: number, q: number[]) => a + q[1], 0) / r.length]; } if (!p) { skipped++; continue; } ev.push({ id: e.id, title: e.title, category: e.categories?.[0]?.title, lon: p[0], lat: p[1], observed_at: g.date, sources: (e.sources || []).map((s: J) => s.url) }); } return { provider: "NASA EONET", events: ev, skipped_unsupported_geometry: skipped, observed_at: ev.map(e => e.observed_at).sort().pop() || null }; },
  async iss() { const d = await getJ("https://api.wheretheiss.at/v1/satellites/25544"); return { provider: "api.wheretheiss.at (third party, not NASA)", kind: "propagated_orbit_position", lat: d.latitude, lon: d.longitude, observed_at: new Date(d.timestamp * 1000).toISOString() }; },
  async gibs() { const day = new Date().toISOString().slice(0, 10); const r = await fetch(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${day}/GoogleMapsCompatible_Level9/3/3/4.jpg`); if (!r.ok) throw new Error("http " + r.status); return { provider: "NASA GIBS (EOSDIS)", projection: "EPSG:3857", acquisition_time: r.headers.get("layer-time-actual"), observed_at: r.headers.get("layer-time-actual") ? utc(r.headers.get("layer-time-actual")!) : null }; },
  async donki() { const end = new Date(), start = new Date(Date.now() - 30 * 864e5), f = (d: Date) => d.toISOString().slice(0, 10); const counts: Record<string, number> = {}; let obs: string | null = null; for (const k of ["CME", "GST", "SEP", "RBE"]) { const d = await getJ(`https://api.nasa.gov/DONKI/${k}?startDate=${f(start)}&endDate=${f(end)}&api_key=${NASA_KEY}`); if (!Array.isArray(d)) throw new Error("schema"); counts[k] = new Set(d.map((x: J) => x.activityID || x.gstID || x.sepID || x.rbeID)).size; for (const x of d) { const t = utc(x.startTime || x.eventTime); if (t && (!obs || t > obs)) obs = t; } } return { provider: "NASA CCMC DONKI via api.nasa.gov", history_counts: counts, observed_at: obs, window_days: 30 }; },
};
const inflight: Record<string, boolean> = {};
async function refreshSource(s: string) {
  const row = mem.nasa[s]; const now = Date.now();
  if (inflight[s] || (row?.next_try_at && now < row.next_try_at)) return;
  inflight[s] = true;
  try { const data = await FETCH[s](); mem.nasa[s] = { status: "ok", data, last_success_at: now, retrieved_at: now, error: null }; }
  catch (e: any) { const rl = String(e.message).includes("rate_limited"); mem.nasa[s] = { ...(row || { data: null, last_success_at: null }), status: rl ? "rate_limited" : "error", error: String(e.message), retrieved_at: now, next_try_at: now + (rl ? 3600e3 : INTERVAL[s] * 2e3) }; }
  finally { inflight[s] = false; save(); }
}
function describeAll() {
  const now = Date.now(), out: J = {};
  for (const s of Object.keys(INTERVAL)) {
    const r = mem.nasa[s];
    if (!r || !r.last_success_at) { out[s] = { source: s, freshness: "unavailable", live: false, status: r?.status || "never", error: r?.error || null, data: null }; continue; }
    const age = (now - r.last_success_at) / 1000, live = r.status === "ok" && age <= INTERVAL[s] * 2.5;
    out[s] = { source: s, freshness: live ? "live" : "cached", live, status: r.status, error: r.error, age_s: Math.round(age), times: { observed_at: r.data?.observed_at ?? null, retrieved_at: new Date(r.retrieved_at).toISOString(), last_success_at: new Date(r.last_success_at).toISOString() }, data: r.data };
  }
  return out;
}
const poll = () => { for (const s of Object.keys(INTERVAL)) { const r = mem.nasa[s]; if (!r || !r.last_success_at || Date.now() - r.last_success_at > INTERVAL[s] * 1000) refreshSource(s); } };

const err = (status: number, msg: string) => Object.assign(new Error(msg), { status });

export async function localApi(path: string, init: { method?: string; json?: J } = {}): Promise<J> {
  const m = (init.method || "GET").toUpperCase(), [p, qs] = path.split("?"), q = new URLSearchParams(qs || "");
  if (p.startsWith("/auth/")) return { id: "local", role: "crew", token: "local" };
  if (p === "/me") return { id: "local", email: "", role: "crew", display_name: "This browser", external_model_consent: mem.consent };
  if (p === "/me/consent/external-model") { mem.consent = !!init.json?.external_model; save(); return { external_model_consent: mem.consent }; }
  if (p === "/devices" && m === "POST") { mem.devices[init.json.id] ||= "disconnected"; save(); return { id: init.json.id, token: null }; }
  const ds = p.match(/^\/devices\/([^/]+)\/state$/); if (ds) { mem.devices[decodeURIComponent(ds[1])] = init.json.state; save(); return { ok: true }; }
  if (p === "/measurements" && m === "POST") return ingest(init.json.events || []);
  if (p === "/measurements") { const since = Date.now() - Number(q.get("since_hours") || 24) * 3600e3; return mem.measurements.filter(r => r.metric === q.get("metric") && Date.parse(r.observed_at) >= since).sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at)); }
  if (p === "/cards") { const now = Date.now(), o: J = {}; for (const [d, ms] of Object.entries(DOMAINS)) { o[d] = {}; for (const x of ms) o[d][x] = cardState(x, now); } return o; }
  if (p === "/checkins" && m === "POST") { const row = { id: String(++mem.seq), kind: init.json.kind, observed_at: new Date().toISOString(), payload: init.json.payload }; mem.checkins.unshift(row); save(); return { id: row.id }; }
  if (p === "/checkins") return mem.checkins.slice(0, 500);
  if (p === "/notes") return [];
  if (p === "/me/history" && m === "PUT") { mem.history = String(init.json.text || "").slice(0, 4000); save(); return { ok: true }; }
  if (p === "/me/history") return { text: mem.history };
  if (p === "/context/nasa") { poll(); return describeAll(); }
  if (p === "/assistant/status") return { mode: "unavailable", model_available: false, external_model_consent: mem.consent, research_passages: 0, reason: "Browser-only deployment: no backend, so no language model and no research index." };
  if (p === "/assistant/chat") return {
    mode: "unavailable", ai_generated: false, citations: [], sections: { missing_information: ["assistant backend (not deployed)"] },
    text: /suicid|kill myself|hurt myself|self.?harm|end my life|chest pain|can'?t breathe|cannot breathe|unconscious|overdose/i.test(init.json?.message || "")
      ? "This may be urgent. Contact your crew medical officer or the mission emergency channel now, or alert a crew-mate. On Earth, call your local emergency number. This is a fixed safety notice, not an AI answer."
      : "The assistant needs a backend with a language model and research index, and this deployment has none. Nothing is generated or simulated here.",
  };
  throw err(404, "not available in browser-only mode");
}
export const localDump = () => mem;
