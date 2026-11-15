import { describe, expect, it } from "vitest";
import { parseHeartRate } from "./ble";

const dv = (...b: number[]) => new DataView(new Uint8Array(b).buffer);

describe("heart rate parser", () => {
  it("8-bit value", () => expect(parseHeartRate(dv(0x00, 72)).bpm).toBe(72));
  it("16-bit value", () => expect(parseHeartRate(dv(0x01, 0x2c, 0x01)).bpm).toBe(300));
  it("RR intervals in ms (1/1024 s units)", () => {
    const r = parseHeartRate(dv(0x10, 60, 0x00, 0x04, 0x00, 0x02));
    expect(r.rr_ms[0]).toBeCloseTo(1000); expect(r.rr_ms[1]).toBeCloseTo(500);
  });
  it("skips energy field before RR", () => expect(parseHeartRate(dv(0x18, 60, 9, 9, 0x00, 0x04)).rr_ms[0]).toBeCloseTo(1000));
  it("contact flags", () => {
    expect(parseHeartRate(dv(0x06, 60)).contact).toBe(true);
    expect(parseHeartRate(dv(0x04, 60)).contact).toBe(false);
    expect(parseHeartRate(dv(0x00, 60)).contact).toBeNull();
  });
  it("rejects short/truncated packets", () => {
    expect(() => parseHeartRate(dv(0x00))).toThrow();
    expect(() => parseHeartRate(dv(0x01, 5))).toThrow();
  });
});
