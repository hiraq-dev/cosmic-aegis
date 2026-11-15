export interface HeartPacket { bpm: number; contact: boolean | null; rr: number[] }
export function parseHeartRate(v: DataView): HeartPacket {
  if (v.byteLength < 2) throw new Error('Incomplete heart-rate packet');
  const flags = v.getUint8(0); let i = 1;
  const take = () => { if (i + 2 > v.byteLength) throw new Error('Incomplete heart-rate packet'); const n = v.getUint16(i, true); i += 2; return n; };
  const bpm = flags & 1 ? take() : v.getUint8(i++);
  if (flags & 8) take();
  const rr: number[] = [];
  if (flags & 16) while (i < v.byteLength) rr.push(take() / 1024);
  return { bpm, contact: flags & 4 ? Boolean(flags & 2) : null, rr };
}
interface Characteristic extends EventTarget { value?: DataView; startNotifications(): Promise<Characteristic>; stopNotifications(): Promise<Characteristic> }
interface Device extends EventTarget { id: string; name?: string; gatt?: { connected: boolean; connect(): Promise<{ getPrimaryService(n: string): Promise<{ getCharacteristic(n: string): Promise<Characteristic> }> }>; disconnect(): void } }
interface Bluetooth { requestDevice(options: unknown): Promise<Device> }
export const bluetooth = () => (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;
export async function connectHeart(onReading: (p: HeartPacket, id: string, name: string) => void, onDisconnect: () => void) {
  const bt = bluetooth(); if (!bt || !window.isSecureContext) throw new Error('Use a supported Chromium browser over HTTPS or localhost with a Bluetooth Heart Rate Service sensor.');
  const device = await bt.requestDevice({ filters: [{ services: ['heart_rate'] }] });
  if (!device.gatt) throw new Error('Device has no Bluetooth GATT server');
  let ch: Characteristic | undefined;
  const receive = () => { if (ch?.value) { try { onReading(parseHeartRate(ch.value), device.id, device.name || 'Bluetooth HR sensor'); } catch { /* Malformed packets are not measurements. */ } } };
  const cleanup = () => { ch?.removeEventListener('characteristicvaluechanged', receive); device.removeEventListener('gattserverdisconnected', cleanup); onDisconnect(); };
  try {
    const server = await device.gatt.connect();
    ch = await (await server.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    ch.addEventListener('characteristicvaluechanged', receive);
    device.addEventListener('gattserverdisconnected', cleanup);
    await ch.startNotifications();
  } catch (e) { device.gatt.disconnect(); cleanup(); throw e; }
  return { id: device.id, name: device.name || 'Bluetooth HR sensor', disconnect: () => { void ch?.stopNotifications().catch(() => {}); device.gatt?.disconnect(); cleanup(); } };
}
