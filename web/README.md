# C.O.S.M.I.C. AEGIS - website prototype

**Understand Your Health Beyond Earth.** A frontend-only prototype for the NASA Space Apps Challenge 2026,
[Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).

> **Prototype for demonstration only. Not a medical device.** It does not diagnose, predict or prevent any
> condition. Every number is sample data and every threshold is illustrative. Not affiliated with or endorsed by
> NASA or the Canadian Space Agency. Code, text and artwork were created with AI assistance (Claude by Anthropic).

## What it is

Three health modules plus a dashboard and a personal profile:

- **Mental health:** daily check-in (mood, stress, fatigue, sleep), trends, gentle suggestions and alerts.
- **Musculoskeletal degradation:** exercise log, strength trend, clickable body figure, simulated bone-loading status.
- **Cardiovascular health and risk awareness:** vital-signs entry with validation, trends, warning-sign information.
  It never claims to diagnose, predict or prevent heart attacks.
- **Dashboard:** profile, mission status, overall overview, module cards, alerts, 14-day trends, recent activity,
  six supporting indicators (including simulated radiation, CO2 and cabin temperature).
- **Profile and history:** optional family history, health concerns, entry history.
- **Sources and status:** NASA/CSA references and a table of what is implemented, simulated or future work.

## Run it

Requires Node 20+.

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

No backend, no login, no environment variables. Entries are saved in your browser's `localStorage`
(key `cosmic-aegis-demo-v1`). The footer's **Reset demo data** button restores the seeded sample data.

## Tech

React 19, TypeScript, Vite, React Router, Tailwind CSS 4, Recharts, Lucide icons. Deployed as a static site
(`vercel.json` rewrites all routes to `index.html`).

## Real versus simulated

| Part | Status |
| --- | --- |
| Forms with validation, charts, rule-based alerts, local saving | Implemented |
| Astronaut, mission, 14 days of history, radiation / CO2 / temperature, bone status | Simulated demo data |
| Computer-vision exercise analysis, ML health analysis, wearable sensors | Future integration |
| Clinical validation, flight-surgeon workflows | Future work with medical teams |

No NASA dataset, API or live feed is connected. NASA and CSA pages are cited as background in the Sources page.

## Future integration points

`src/integrations/` holds typed stubs marked `// FUTURE INTEGRATION: ...` (Computer Vision Module, ML Health
Analysis, Wearable Sensor Integration). They currently return nothing. See `src/integrations/README.md`.
The Python services in the repository root (pose analysis, retrieval over NASA reports) are an earlier,
separate backend prototype that these stubs could connect to.

## Deploy on Vercel

1. Sign in at vercel.com with GitHub and authorize access to this repository.
2. Add New > Project > import `cosmic-aegis`.
3. Root Directory: `web`. Framework Preset: Vite. Build Command: `npm run build`. Output Directory: `dist`.
4. No environment variables. Click Deploy.

## Known limitations

- Demo data and illustrative rules only; no clinical validity.
- Data lives in one browser; clearing site data removes it.
- Charts were tested in desktop, tablet and phone widths in a Chromium-based browser; other browsers are untested.
