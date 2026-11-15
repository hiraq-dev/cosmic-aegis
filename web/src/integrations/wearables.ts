// FUTURE INTEGRATION: Wearable Sensor Integration
// Not implemented. Today every reading is typed in by the user or comes from clearly labelled demo data.
import type { VitalEntry } from "../lib/types";

export const isWearableConnected = (): boolean => false;

export async function readLatestVitals(): Promise<Omit<VitalEntry, "id"> | null> {
  // FUTURE INTEGRATION: read from a sensor or device API and return a VitalEntry-shaped record.
  return null;
}
