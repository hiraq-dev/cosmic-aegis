# Submission form answers (website prototypes)

Challenge: **Create Health Monitoring Software for Astronauts on Space Missions**
https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/

Replace `[TEAM NAME]` with your real team name before submitting. Check the official Space Apps site for current field names, limits and the deadline. Both texts below say plainly that all data is simulated, so do not edit that out.

A team normally submits **one project**. AEGIS is the stronger primary entry (three focused modules, a 7-slide deck, sources page). ASTRA CARE is a second, broader prototype; submit it only if the rules allow a second entry, or mention it as a related demo in the AEGIS details.

---

## A. C.O.S.M.I.C. AEGIS (recommended primary entry)

**Project name:** C.O.S.M.I.C. AEGIS - Understand Your Health Beyond Earth

**Project summary (50-200 words):**
C.O.S.M.I.C. AEGIS is a website prototype that helps an astronaut understand their health far from Earth. It brings three areas into one calm dashboard: mental health (mood, stress, sleep, fatigue), musculoskeletal change (exercise, strength, a clickable body figure) and cardiovascular awareness (heart rate, blood pressure, oxygen). Users log daily readings, see 14-day trends, and get plain-language alerts and suggestions that can be shared with a crew medical officer. The cardiovascular module raises awareness of warning signs; it never claims to diagnose, predict or prevent any condition. Everything shown is simulated demo data, saved only in the browser, with no login. It is a design and interaction prototype, not a medical device. Integration points for computer vision, machine-learning analysis and wearable sensors are stubbed for future work.

(About 125 words.)

**Link to demo (public, no login):** https://cosmic-aegis-beryl.vercel.app
(The 7-slide deck is in the repository: `submission/AEGIS_SpaceApps_7slides.pdf` and `.pptx`.)

**Link to project (code):** https://github.com/hiraq-dev/cosmic-aegis

**Project details (what it does, how it was built):**
The site has a dashboard (astronaut profile, mission status, overall overview, module cards, alerts, trends, daily check-in, recent activity, six supporting indicators) and one page per module plus a personal profile and a sources page. Forms validate input; alerts come from simple, clearly illustrative rules (for example, repeated high stress, blood pressure outside a demo range, falling strength). Entries persist in localStorage and a reset button restores the seeded demo data. Built with React, TypeScript, Vite, Tailwind CSS and Recharts, and deployed as a static site on Vercel. A "Real versus simulated" table on the Sources page lists what is implemented (forms, charts, rule-based alerts, local saving), simulated (astronaut, mission, 14 days of history, radiation, CO2, cabin temperature, bone status) and future work (computer vision, ML analysis, wearables, clinical validation). The repository also contains an earlier Python edge-AI backend prototype (pose analysis, retrieval over NASA reports) that is not part of the website demo.

**Use of Artificial Intelligence (SI) disclosure:**
The website's code, text and illustrations were created with AI assistance (Claude by Anthropic), directed and reviewed by the team. The astronaut illustration is original AI-assisted vector artwork, labelled "AI-generated illustration" on the page and on the slides, and contains no NASA or other agency logos. Presentation slides were generated with AI assistance from real screenshots of the site. All health data, crew members and alerts are fictional, simulated values; no AI model analyses real health data. The repository README and the site footer state this.

**NASA data and resources used (full URLs):** (background reading only; no NASA dataset or API is connected)
- https://www.nasa.gov/hrp/hazards/ - Five hazards of human spaceflight
- https://www.nasa.gov/hrp/risks/ - Risks of human spaceflight
- https://www.nasa.gov/hrp/ongoing-hrp-research/ - Ongoing Human Research Program research
- https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf - HRP evidence report: in-flight medical conditions (also used by the repository's earlier retrieval service)
- https://ntrs.nasa.gov/api/citations/20150016006/downloads/20150016006.pdf - HRP evidence report: cardiovascular disease and radiation exposure (same)

**Space agency partner and other data/resources:**
- Canadian Space Agency, "Monitoring Radiation for Astronaut Health": https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- Canadian Space Agency, "Why Do We Conduct Science Experiments in Space?": https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp
- Open-source libraries: React, Vite, Tailwind CSS, Recharts, Lucide icons.
- No agency partnership, endorsement or data licence exists. Say "none" if the form asks for a formal partner.

---

## B. ASTRA CARE (optional second entry)

**Project name:** ASTRA CARE - Deep Space Wellbeing Prototype

**Project summary (50-200 words):**
ASTRA CARE is an interactive website prototype for the wellbeing of astronauts on long missions. It combines ten demo modules: an animated astronaut companion, a daily mental-wellbeing check-in, light-hearted morale questions, a sleep and fatigue dashboard with a reaction-time game, a 7-day sleep trend chart, a pattern-detection panel, simple countermeasure tools (breathing pacer, light and sound), an emergency screen simulation, an offline transmission queue that simulates communication delays, and a simulated ground-team console. It is built to show how a crew-facing tool could stay useful when contact with Earth is delayed. All crew, readings and alerts are fictional, no machine-learning model runs, and nothing is ever sent anywhere. It is a design prototype, not a medical device.

(About 120 words.)

**Link to demo (public, no login):** https://astra-care-seven.vercel.app

**Link to project (code):** https://github.com/hiraq-dev/cosmic-aegis (folder `astra-care`)

**Project details:**
A static site (HTML, CSS, JavaScript, no build step) with a Build Checklist view showing 10 of 10 prototype modules implemented, a simulated ground console and a Space Apps Requirements tab with an interactive submission checklist. Sound effects and the binaural tone use the browser's Web Audio API. The pattern-detection panel, voice analysis, "links" and ECG waveform are scripted or synthetic and are labelled that way on the page. A banner on every page says the data is fictional.

**Use of Artificial Intelligence (SI) disclosure:**
The website's code, text and graphics were created with AI assistance (Claude by Anthropic) and edited by the team. The astronaut avatar is original vector artwork with no NASA or other agency logos. No AI model analyses health data; all values are simulated. This is stated on the site and in the repository README.

**NASA data and resources used (full URLs):** background reading only; no dataset or API is connected.
- https://www.nasa.gov/hrp/hazards/
- https://www.nasa.gov/hrp/risks/
- https://www.nasa.gov/hrp/ongoing-hrp-research/
- https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf

**Space agency partner and other data/resources:** none (no partnership or endorsement). Only open web technologies and Google Fonts (Orbitron, Rajdhani, Space Mono).

---

## Submission checklist

- [ ] Replace `[TEAM NAME]` (and the "Team AEGIS" / "Your team name here" placeholders on both sites, then redeploy by pushing to GitHub)
- [ ] Open both live URLs in a private window (no login needed) on a phone and a laptop
- [ ] Open `AEGIS_SpaceApps_7slides.pptx` in PowerPoint and check every slide (layout was not visually verified)
- [ ] Upload the deck as PDF if the form asks for slides; confirm it is 7 slides or fewer
- [ ] Confirm the GitHub repository is public and the README renders
- [ ] Paste the AI-use disclosure and the NASA resource URLs into the form
- [ ] Re-read the official Space Apps rules for current limits and the deadline, then submit
- [ ] Do not add NASA logos, and do not describe the project as certified, validated or endorsed
