export const API = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
let token = '';
export function setToken(value: string) { token = value; }
export async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const r = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(35000) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(typeof j.detail === 'string' ? j.detail : `Request failed (${r.status})`); }
  return r.json();
}
export function subscribe(onChange: () => void) {
  const abort = new AbortController();
  async function run() {
    while (!abort.signal.aborted) {
      try {
        const r = await fetch(`${API}/stream`, { headers: { Authorization: `Bearer ${token}` }, signal: abort.signal });
        if (!r.ok || !r.body) throw new Error('stream unavailable');
        const reader = r.body.getReader();
        try { while (!abort.signal.aborted) { const next = await reader.read(); if (next.done) break; onChange(); } } finally { await reader.cancel(); }
      } catch { /* Periodic REST refresh remains the recovery path. */ }
      if (!abort.signal.aborted) await new Promise<void>(resolve => { const id = setTimeout(done, 3000); function done() { clearTimeout(id); abort.signal.removeEventListener('abort', done); resolve(); } abort.signal.addEventListener('abort', done, { once: true }); });
    }
  }
  void run(); return () => abort.abort();
}
export interface Reading { event_id: string; device_id: string; metric: string; value: number; unit: string; observed_at: string; source: string; source_type: string; timestamp_origin: string; quality_flags: string[]; context: string; sequence?: number }
export interface Card { value?: number; unit?: string; state: string; label: string; observed_at?: string; source?: string; age_s?: number; quality_flags?: string[] }
export interface Source { source: string; freshness: string; error?: string; times?: { observed_at?: string; last_success_at?: string }; data?: { provider?: string; events?: Array<{ id: string; kind?: string; title?: string; observed_at?: string; link?: string; lat?: number; lon?: number; max_kp?: number }>; history_counts?: Record<string, number>; window_days?: number; current?: Record<string, number | null>; lat?: number; lon?: number; tile_template?: string; acquisition_time?: string; requested_date?: string; attribution?: string } }
export const formatTime = (t?: string) => t ? new Date(t).toLocaleString() : 'Not available';
