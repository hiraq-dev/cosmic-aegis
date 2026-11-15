export const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const today = (): string => toISODate(new Date());

export const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);

export const shortDate = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const makeId = (): string => Math.random().toString(36).slice(2, 10);
