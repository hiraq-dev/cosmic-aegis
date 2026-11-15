# Audit and data-truth corrections

| Finding in the previous implementation | Status |
|---|---|
| Wearable integration (`web/src/integrations/wearables.ts`) returned null | Replaced by a Web Bluetooth Heart Rate Service connector (`web/src/lib/ble.ts`). Physical verification **blocked: no BLE sensor was available**; parser unit-tested only. |
| Daily records overwrote same-date entries | New backend stores every check-in (tested: three same-day moods kept). |
| Seeded history loaded automatically | New workspace reads only the server; a fresh account is empty (tested). Old seed code is no longer mounted. |
| NASA snapshot fallback kept a LIVE label | New NASA panel only shows server data: LIVE, CACHED (with age) or UNAVAILABLE. No hardcoded snapshot is served. |
| Kp parsed from message prose; missing -> 0 | Structured NOAA field; missing is `null` (tested). |
| Forecasts used sample index | `server/app/analytics.py` regresses on elapsed days, requires coverage, labelled heuristic (tested with irregular timestamps). |
| Gateway reported "nominal" when services were down | Not changed (Python gateway is outside the new path). `/ready` in the new API reports `degraded`/`unavailable`, never healthy by default. |
| Other CV/ML adapters were stubs | Unchanged and still stubs. Only MediaPipe pose exists in the browser (`/scan` code kept in repo but not routed in the single page). |
| Chat endpoint assumed simulated readings | New `/assistant/chat` uses only stored measurements, labels mode, never presents retrieval as AI, needs consent for external model. `web/api/chat.js` is legacy. |
| Multiple routes, large bundle | One page, no menu; 3D code lazy-loaded (initial JS ~76 kB gzip). |

Preserved: MediaPipe pose code, NASA HRP PDFs for retrieval, README story.
