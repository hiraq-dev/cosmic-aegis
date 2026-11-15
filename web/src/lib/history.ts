// Saved scan reports and live-environment snapshots, stored only in this browser (localStorage).
import type { Report } from "./screening";

const KEY_R = "cosmic-aegis-reports-v1";
const KEY_S = "cosmic-aegis-snapshots-v1";

type StoredReport = Omit<Report, "when"> & { when: string };

function read<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]") as T[]; } catch { return []; }
}
function write(key: string, v: unknown[]) {
  try { localStorage.setItem(key, JSON.stringify(v.slice(0, 50))); } catch { /* storage unavailable */ }
}

export const listReports = (): Report[] => read<StoredReport>(KEY_R).map((r) => ({ ...r, when: new Date(r.when) }));
export function saveReport(r: Report): Report[] {
  const all = [r, ...listReports().filter((x) => x.id !== r.id)];
  write(KEY_R, all.map((x) => ({ ...x, when: x.when.toISOString() })));
  return all;
}
export function deleteReport(id: string): Report[] {
  const all = listReports().filter((x) => x.id !== id);
  write(KEY_R, all.map((x) => ({ ...x, when: x.when.toISOString() })));
  return all;
}

export interface Snapshot {
  id: string;
  when: string;
  iss?: { lat: number; lon: number; altKm: number; speedKmh: number };
  scales?: { R: string; S: string; G: string };
  kp?: number | null;
  eonetCount?: number;
  eonetByCategory?: Record<string, number>;
}
export const listSnapshots = (): Snapshot[] => read<Snapshot>(KEY_S);
export function saveSnapshot(s: Snapshot): Snapshot[] {
  const all = [s, ...listSnapshots()];
  write(KEY_S, all);
  return all;
}
export function deleteSnapshot(id: string): Snapshot[] {
  const all = listSnapshots().filter((x) => x.id !== id);
  write(KEY_S, all);
  return all;
}

export function download(name: string, text: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function reportsCsv(rs: Report[]): string {
  const head = ["id", "when", "postureScore", "readinessIndex", "readinessBand", "imageQuality", ...(rs[0]?.findings.map((f) => f.label) ?? [])];
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [head.map(q).join(","), ...rs.map((r) => [r.id, r.when.toISOString(), r.postureScore, r.readinessIndex, r.readinessBand, r.quality, ...r.findings.map((f) => f.value)].map(q).join(","))].join("\n");
}
