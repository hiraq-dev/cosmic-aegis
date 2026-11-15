export const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";
let token = "";
try { token = sessionStorage.getItem("aegis-token") || ""; } catch { /* storage unavailable */ }
export const setToken = (t: string) => { token = t; try { t ? sessionStorage.setItem("aegis-token", t) : sessionStorage.removeItem("aegis-token"); } catch { /* ignore */ } };
export const hasToken = () => !!token;
export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const r = await fetch(API + path, {
    ...init, headers: { ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  if (!r.ok) { const e: any = new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}
/** Fetch-based SSE so the bearer header can be sent. */
export function stream(onEvent: (e: any) => void, signal: AbortSignal) {
  (async () => {
    try {
      const r = await fetch(API + "/stream", { headers: { Authorization: `Bearer ${token}` }, signal });
      const rd = r.body!.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf("\n\n")) >= 0) { const m = buf.slice(0, i); buf = buf.slice(i + 2); const d = m.split("\n").find(l => l.startsWith("data: ")); if (d) try { onEvent(JSON.parse(d.slice(6))); } catch { /* skip */ } } }
    } catch { /* aborted or dropped: caller shows disconnected state */ }
  })();
}
