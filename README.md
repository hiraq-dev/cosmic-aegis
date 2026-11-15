C.O.S.M.I.C. AEGIS - website prototype
Understand Your Health Beyond Earth. By Team AEGIS (Hira Qaiser, Srikant Kavitha Parasuraman, Kishore Kumar Mani Kandan) for the NASA Space Apps Challenge 2026, Create Health Monitoring Software for Astronauts on Space Missions.

Live site: https://cosmic-aegis-beryl.vercel.app

Prototype for demonstration only. Not a medical device. It does not diagnose, predict or prevent any condition. Health entries are sample data and every threshold is illustrative. Not affiliated with or endorsed by NASA or the Canadian Space Agency. Code, text and artwork were created with AI assistance (Claude by Anthropic).

What it is
The site opens on the Dashboard, which starts with a 30-second animated, narrated story (problem, why it matters, our idea, what we built, limits).

Dashboard: story, profile, mission status, overall score, alerts, 14-day trends, recent activity, a simulated live ticker (heart rate, oxygen, CO2, cabin temperature, radiation).
Live NASA space weather: real events from NASA DONKI (geomagnetic storms, solar particle events, radiation belt enhancements, CMEs) turned into a QUIET / WATCH / ELEVATED radiation-awareness label.
NASA HRP mapping: NASA's five hazards of human spaceflight, each linked to the AEGIS feature that responds to it.
Mental health: daily check-in (mood, stress, fatigue, sleep), trends, gentle suggestions and alerts.
Muscle and bone: exercise log, strength trend, clickable body figure, activity-based bone status.
Cardiovascular: vital-signs entry with validation, trends, warning-sign information. Never claims to diagnose or predict.
Habitat console (/console): ten modules, including an astronaut companion with 4-7-8 breathing pacer and reaction test, a mock ground-control view with signal delay, a delay-tolerant message queue, a module checklist, and a hex byte viewer.
SOS practice: 10-second countdown with siren tone. Practice only, nothing is sent.
AEGIS assistant: floating chat that explains your own entries, with spoken guidance (Web Speech API) built from your data. It is scripted and rule-based, not an AI model. Emergency or crisis wording is redirected to real help.
Profile and Sources: optional history, NASA/CSA references, and a real-versus-simulated table.
Screenshots
See shots (dashboard, story, modules, trends, live space weather, NASA hazards, console, assistant, health pages).

Run it
Requires Node 20+.

cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
No backend and no login. Entries are saved in your browser's localStorage (key cosmic-aegis-demo-v1). The footer's Reset demo data button restores the sample data.

Optional: set VITE_NASA_API_KEY to your free key from https://api.nasa.gov. Without it the site uses NASA's shared DEMO_KEY, which is rate limited; if a call fails, the space-weather panel shows a clearly labelled snapshot of real events.

Tech
React 19, TypeScript, Vite 8, React Router 7, Tailwind CSS 4, Recharts, Lucide icons. Web Speech API (voice), Web Audio (tones), Canvas (starfield). Deployed on Vercel as a static site (vercel.json rewrites routes to index.html).

Real versus simulated
Part	Status
Forms with validation, charts, rule-based alerts, local saving	Implemented
Voice guidance, scripted assistant, 30-second story, SOS practice, delay-tolerant queue	Implemented (simulated scenario)
Space weather events from NASA DONKI (api.nasa.gov)	Live NASA data
Astronaut, mission, 14 days of history, vitals, cabin readings, bone status, ticker	Simulated demo data
Computer-vision exercise analysis, ML health analysis, wearable sensors, language-model assistant	Future integration
Clinical validation, flight-surgeon workflows	Future work with medical teams
NASA resources
NASA DONKI Space Weather Database via NASA Open APIs (live): https://api.nasa.gov/
5 Hazards of Human Spaceflight (NASA HRP): https://www.nasa.gov/hrp/hazards/
Risks of Human Spaceflight (NASA HRP): https://www.nasa.gov/hrp/risks/
Ongoing HRP Research in Space: https://www.nasa.gov/hrp/ongoing-hrp-research/
HRP evidence reports (NTRS): https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf and https://ntrs.nasa.gov/api/citations/20150016006/downloads/20150016006.pdf
Future integration points
src/integrations/ holds typed stubs marked // FUTURE INTEGRATION: ... (computer vision, ML health analysis, wearable sensors). The scripted assistant in src/lib/assistant.ts is isolated so a language model could replace it. The Python services in the repository root are an earlier, separate backend prototype.

Deploy on Vercel
Root Directory web, Framework Preset Vite, Build npm run build, Output dist. Optional env var: VITE_NASA_API_KEY. Pushes to main deploy automatically.

Known limitations
Demo data and illustrative rules only; no clinical validity.
Data lives in one browser; clearing site data removes it.
Speech voices depend on the browser and device.
Tested in desktop and phone widths in a Chromium-based browser; other browsers are untested.
