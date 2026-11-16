import { describe, expect, it } from "vitest";
import { SignalCounter, armSignal, counterFor } from "./pose";
import { faceSampleFrom, summarizeFace, labelFor, type FaceSample } from "./face";
import { hrZone, weekly, type FitSession } from "./fitness";

describe("rep counter", () => {
  it("counts arm raises with hysteresis", () => {
    const c = counterFor("armraise"); [0, 0.1, 0.4, 0.5, 0.3, -0.1, 0, 0.3, 0.6, -0.2].forEach(v => c.push(v));
    expect(c.reps).toBe(2);
  });
  it("ignores wobble that never crosses the high threshold", () => { const c = new SignalCounter(0.25, -0.05); [0, 0.2, -0.1, 0.2, -0.1].forEach(v => c.push(v)); expect(c.reps).toBe(0); });
  it("skips null frames", () => { const c = counterFor("squat"); c.push(null); expect(c.skipped).toBe(1); });
  it("arm signal needs visible landmarks", () => { expect(armSignal(Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 })))).toBeNull(); });
});
describe("face cues", () => {
  const f = (o: Partial<FaceSample> = {}): FaceSample => ({ t: 0, smile: 0, browDown: 0, browUp: 0, jawOpen: 0, blink: 0, frown: 0, squint: 0, ...o });
  it("labels frames by rule", () => {
    expect(labelFor(f({ smile: 0.6 }))).toBe("smiling"); expect(labelFor(f({ browDown: 0.6 }))).toBe("tense"); expect(labelFor(f())).toBe("neutral"); expect(labelFor(f({ blink: 0.9 }))).toBe("eyes closed");
  });
  it("maps blendshape categories", () => { expect(faceSampleFrom([{ categoryName: "mouthSmileLeft", score: 0.8 }, { categoryName: "mouthSmileRight", score: 0.6 }], 1).smile).toBeCloseTo(0.7); });
  it("counts blinks and refuses tiny samples", () => {
    expect(summarizeFace([f()], 1, 1)).toBeNull();
    const s: FaceSample[] = []; for (let i = 0; i < 300; i++) s.push(f({ t: i / 30, blink: i % 60 === 30 ? 0.9 : 0.05 }));
    const r = summarizeFace(s, 300, 10)!; expect(r.blinkCount).toBe(5); expect(r.blinkPerMin).toBeGreaterThan(25);
  });
});
describe("fitness", () => {
  it("weekly totals ignore old sessions", () => {
    const now = Date.parse("2026-11-16T12:00:00Z"), mk = (d: string, secs: number): FitSession => ({ id: d, when: d, exercise: "squat", reps: 10, seconds: secs, tempo: null, avgHr: null, maxHr: null, usable: 100 });
    const w = weekly([mk("2026-11-15T10:00:00Z", 600), mk("2026-11-01T10:00:00Z", 900)], now);
    expect(w.sessions).toBe(1); expect(w.minutes).toBe(10); expect(w.whoPct).toBe(7);
  });
  it("hr zone from age", () => { expect(hrZone(130, 30).zone).toBe("moderate"); expect(hrZone(190, 30).zone).toBe("near maximum"); });
});
