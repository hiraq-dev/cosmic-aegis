// Web Bluetooth Heart Rate Service (0x180D / characteristic 0x2A37). Spec: Bluetooth GATT Heart Rate Measurement.
export interface HrSample { bpm: number; rr_ms: number[]; contact: boolean | null; }

export function parseHeartRate(dv: DataView): HrSample {
  if (dv.byteLength < 2) throw new Error("heart-rate packet too short");
  const flags = dv.getUint8(0);
  const wide = (flags & 0x01) !== 0;          // bit0: 16-bit value
  const contactSupported = (flags & 0x04) !== 0; // bit2: contact detection supported
  const contactOk = (flags & 0x02) !== 0;     // bit1: contact detected
  const energy = (flags & 0x08) !== 0;        // bit3: energy expended present
  const rr = (flags & 0x10) !== 0;            // bit4: RR intervals present
  let o = 1;
  if (dv.byteLength < o + (wide ? 2 : 1)) throw new Error("heart-rate packet truncated");
  const bpm = wide ? dv.getUint16(o, true) : dv.getUint8(o);
  o += wide ? 2 : 1;
  if (energy) o += 2;
  const rr_ms: number[] = [];
  if (rr) for (; o + 1 < dv.byteLength; o += 2) rr_ms.push((dv.getUint16(o, true) / 1024) * 1000); // units of 1/1024 s
  return { bpm, rr_ms, contact: contactSupported ? contactOk : null };
}

export const bleSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;

export interface HrConnection { deviceId: string; name: string; disconnect: () => void; }

/** Must be called from a user gesture. Pairing is explicit: the browser shows its own device chooser. */
export async function connectHeartRate(onSample: (s: HrSample, at: Date) => void, onState: (s: "connected" | "disconnected") => void): Promise<HrConnection> {
  if (!bleSupported()) throw new Error("Web Bluetooth is not available in this browser (use Chrome or Edge over HTTPS or localhost).");
  const nav = navigator as any;
  const device = await nav.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
  let char: any = null;
  const handler = (e: Event) => onSample(parseHeartRate((e.target as any).value as DataView), new Date());
  const gone = () => { cleanup(); onState("disconnected"); };
  const cleanup = () => { try { char?.removeEventListener("characteristicvaluechanged", handler); } catch { /* already gone */ } char = null; };
  device.addEventListener("gattserverdisconnected", gone);
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService("heart_rate");
  char = await svc.getCharacteristic("heart_rate_measurement");
  char.addEventListener("characteristicvaluechanged", handler);
  await char.startNotifications();
  onState("connected");
  return {
    deviceId: `ble-${device.id}`.slice(0, 60), name: device.name || "BLE heart-rate sensor",
    disconnect: () => { cleanup(); device.removeEventListener("gattserverdisconnected", gone); if (device.gatt?.connected) device.gatt.disconnect(); onState("disconnected"); },
  };
}
