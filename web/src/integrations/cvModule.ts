// FUTURE INTEGRATION: Computer Vision Module
// Not implemented. In the full project this is where camera-based exercise-form and posture analysis would feed the app.
// The repository's Python `kinetic_guardian` service (pose estimation, rep counting) is the intended starting point.
import type { ExerciseEntry } from "../lib/types";

export interface CvAnalysisResult {
  entry: Omit<ExerciseEntry, "id">;
  formQuality: number; // 0-1
}

export const isCvAvailable = (): boolean => false;

export async function analyseExerciseVideo(_video: Blob): Promise<CvAnalysisResult | null> {
  // FUTURE INTEGRATION: send the video to the computer vision service and map its output to ExerciseEntry.
  return null;
}
