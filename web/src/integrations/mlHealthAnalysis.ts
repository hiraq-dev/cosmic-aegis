// FUTURE INTEGRATION: ML Health Analysis
// Not implemented. The app currently uses transparent rule-based thresholds (src/lib/assess.ts).
// A trained model could be plugged in here to add trend analysis, but it would need clinical validation first.
import type { Alert, AppData } from "../lib/types";

export const isMlAvailable = (): boolean => false;

export async function analyseTrends(_data: AppData): Promise<Alert[] | null> {
  // FUTURE INTEGRATION: call the model and return alerts in the existing Alert shape.
  return null;
}
