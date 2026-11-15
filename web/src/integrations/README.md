# Integration points

The website is a frontend prototype. These are the places where the real computer vision, machine learning and
sensor code plug in later. Nothing here is implemented yet, and the UI does not claim that it is.

| File | Purpose | Replaces |
|---|---|---|
| `cvModule.ts` | Pose / video analysis (the Python `kinetic_guardian` service in this repo is a starting point) | Manually logged exercise form |
| `mlHealthAnalysis.ts` | Trend analysis and risk-awareness models | The rule-based thresholds in `src/lib/assess.ts` |
| `wearables.ts` | Sensor and device ingestion | Manually typed vitals and sleep |

Keep the data shapes in `src/lib/types.ts` stable. Each integration should return those shapes so the pages need no changes.
