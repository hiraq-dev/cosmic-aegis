# Setup, devices, acceptance

## Run
    cd server && py -3.12 -m pip install -r requirements.txt
    cp .env.example .env   # set JWT_SECRET, NASA_API_KEY (server-side only), optional ANTHROPIC_API_KEY
    DATABASE_URL=sqlite:///./aegis.db alembic upgrade head   # or a postgresql+psycopg URL
    uvicorn app.main:create_app --factory --port 8000
    cd web && npm install && VITE_API_URL=http://localhost:8000 npm run dev
Tests: `cd server && pytest` and `cd web && npx vitest run`.
Endpoints: `/health`, `/ready`, OpenAPI at `/docs`. Backup: copy the SQLite file, or `pg_dump` for Postgres; restore then `alembic upgrade head`.

## Data contract
Append-only `measurements` rows: event_id, subject_id, device_id, metric, value, unit, observed_at, received_at, source, source_type, timestamp_origin (`device`, `manual`, `receive_time_proxy`), quality_flags, context, session_id, sequence. Unique per (subject, device, event_id). Flags: `late`, `timestamp_proxy`, `future_timestamp`, `clock_skew_or_delayed`, `implausible_value`. Card states: receiving, connected_waiting, stale, disconnected, unavailable, manual, estimated, historical_replay.
Environmental sensors POST to `/ingest` with `X-Device-Id` and `X-Device-Token` (token issued once by `POST /devices` with `with_token`).

## Supported devices
- Any BLE sensor exposing the standard Heart Rate Service (0x180D), in Chrome/Edge (Web Bluetooth, HTTPS or localhost). **Not verified on hardware.**
- Apple Watch / Wear OS: **not supported** (would need a native companion app using HealthKit / Health Services).
- BP, SpO2, ECG, respiration: not collected, shown unavailable. CO2/temperature: only via the authenticated ingest endpoint from a real sensor. Radiation dose: only from a dosimeter; NASA events are never converted to dose.

## Acceptance checks (what was actually run)
| # | Check | Result |
|---|---|---|
| 1 | Physical sensor readings visible | **Blocked** (no hardware). Parser unit tests pass (6). |
| 2 | Stopping device -> stale/disconnected | Passed in API tests (stale at 40 s, disconnected on state report). |
| 3 | Readings survive refresh/server restart | Passed (SQLite restart test). Postgres **not tested** (no Postgres available). |
| 4 | Camera movement changes landmarks | Pose code exists (`/scan` page, earlier verified); the single-page 3D avatar is **not yet driven by landmarks** (`pose` prop is wired but passed null). |
| 5 | NASA genuine timestamps | Verified against live upstreams: observed_at for NOAA Kp/scales, EONET, GIBS, ISS. DONKI returned 429 on DEMO_KEY and shows unavailable. Set NASA_API_KEY. |
| 6 | Upstream outage never leaves LIVE | Passed (mocked 429; cached with age). |
| 7 | Assistant separates observed/research/estimates | Sections returned by API; tested retrieval-only and crisis notice. Language-model path **not exercised** (no key). |
| 8 | Fresh account has no history | Passed. |
| 9 | Single page, no menu | Implemented; not browser-tested in this run. |
| 10 | Build/tests/deploy | 32 pytest + 6 vitest pass; web build passes. **No backend deployment exists**; the Vercel site only hosts the frontend and needs a reachable backend (VITE_API_URL). Not a complete production deployment. |

## Known gaps
No browser end-to-end tests; no pose worker/rep counting/calibration in the new page; SSE is single-process; Alembic migration not run on Postgres; reviewer UI is API-only; breathing-from-shoulders output remains only in the legacy `/scan` code, not in the new page.
