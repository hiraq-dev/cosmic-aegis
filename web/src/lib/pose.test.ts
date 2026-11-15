import { describe, expect, it } from "vitest";
import { jointAngle, SquatCounter, toAvatar, kneeAngle } from "./pose";

const P = (x: number, y: number, v = 1) => ({ x, y, visibility: v });
describe("pose maths", () => {
  it("right angle", () => expect(jointAngle(P(0, 1), P(0, 0), P(1, 0))).toBeCloseTo(90));
  it("straight line is 180", () => expect(jointAngle(P(-1, 0), P(0, 0), P(1, 0))).toBeCloseTo(180));
  it("occluded joint returns null", () => expect(jointAngle(P(0, 1), P(0, 0, 0.2), P(1, 0))).toBeNull());
  it("counts squats with hysteresis and ignores noise", () => {
    const c = new SquatCounter();
    const rep = [170, 150, 100, 90, 95, 120, 165];
    for (let i = 0; i < 3; i++) rep.forEach(a => c.push(a));
    [170, 112, 108, 170].forEach(a => c.push(a)); // shallow wobble: not a rep
    expect(c.reps).toBe(3);
  });
  it("skips low-confidence frames and reports usable fraction", () => {
    const c = new SquatCounter(); c.push(null); c.push(170); c.push(null); c.push(170);
    expect(c.summary(2).usable_fraction).toBe(0.5);
  });
  it("calibration shifts thresholds", () => { const c = new SquatCounter(); c.calibrate(175); expect(c.upAbove).toBe(160); });
  it("avatar mapping needs all six arm landmarks", () => {
    const lm = Array.from({ length: 33 }, () => P(0.5, 0.5));
    expect(toAvatar(lm)).not.toBeNull();
    lm[14] = P(0.5, 0.5, 0.1);
    expect(toAvatar(lm)).toBeNull();
  });
  it("knee angle averages visible legs", () => {
    const lm = Array.from({ length: 33 }, () => P(0, 0, 0));
    lm[23] = P(0, 1); lm[25] = P(0, 0); lm[27] = P(1, 0);
    expect(kneeAngle(lm)).toBeCloseTo(90);
  });
});
