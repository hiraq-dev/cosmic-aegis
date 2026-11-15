# Submission form answers (C.O.S.M.I.C. AEGIS website)

Challenge: **Create Health Monitoring Software for Astronauts on Space Missions**
https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/

Team: Team AEGIS (Hira Qaiser, Srikant Kavitha Parasuraman, Kishore Kumar Mani Kandan). Use your registered Space Apps team name if it differs. Check the official Space Apps site for current field names, limits and the deadline. The text below says plainly that all data is simulated, so do not edit that out.

Only C.O.S.M.I.C. AEGIS is deployed and submitted.

---

## C.O.S.M.I.C. AEGIS

**Project name:** C.O.S.M.I.C. AEGIS - Understand Your Health Beyond Earth

**Project summary (50-200 words):**
C.O.S.M.I.C. AEGIS is a website prototype that helps an astronaut understand their health far from Earth. It brings three areas into one calm dashboard: mental health (mood, stress, sleep, fatigue), musculoskeletal change (exercise, strength, a clickable body figure) and cardiovascular awareness (heart rate, blood pressure, oxygen). Users log daily readings, see 14-day trends, and get plain-language alerts and suggestions that can be shared with a crew medical officer. The cardiovascular module raises awareness of warning signs; it never claims to diagnose, predict or prevent any condition. Everything shown is simulated demo data, saved only in the browser, with no login. It is a design and interaction prototype, not a medical device. Integration points for computer vision, machine-learning analysis and wearable sensors are stubbed for future work.

(About 125 words.)

**Link to demo (public, no login):** https://cosmic-aegis-beryl.vercel.app
(The 7-slide deck is in the repository: `submission/AEGIS_SpaceApps_7slides.pdf` and `.pptx`.)

**Link to project (code):** https://github.com/hiraq-dev/cosmic-aegis

**Project details (what it does, how it was built):**
The site has a dashboard (astronaut profile, mission status, overall overview, module cards, alerts, trends, daily check-in, recent activity, six supporting indicators) and one page per module plus a personal profile and a sources page. Forms validate input; alerts come from simple, clearly illustrative rules (for example, repeated high stress, blood pressure outside a demo range, falling strength). Entries persist in localStorage and a reset button restores the seeded demo data. Built with React, TypeScript, Vite, Tailwind CSS and Recharts, and deployed as a static site on Vercel. A "Real versus simulated" table on the Sources page lists what is implemented (forms, charts, rule-based alerts, local saving), simulated (astronaut, mission, 14 days of history, radiation, CO2, cabin temperature, bone status) and future work (computer vision, ML analysis, wearables, clinical validation). The repository also contains an earlier Python edge-AI backend prototype (pose analysis, retrieval over NASA reports) that is not part of the website demo.

Also included: a scripted chat assistant that gives personal, plain-language answers from the user's own logged entries (rule-based, not an AI model, no medical advice, urgent symptoms are redirected to the crew medical officer), a Companion page (breathing pacer, reaction game, morale break, mood pad) and a Comms & SOS page (simulated delay-tolerant queue, mock ground view, practice SOS that sends nothing).

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

## Submission checklist

- [ ] Confirm the team name matches your Space Apps registration (sites currently say "Team AEGIS" plus the three member names)
- [ ] Open both live URLs in a private window (no login needed) on a phone and a laptop
- [ ] Open `AEGIS_SpaceApps_7slides.pptx` in PowerPoint and check every slide (layout was not visually verified)
- [ ] Upload the deck as PDF if the form asks for slides; confirm it is 7 slides or fewer
- [ ] Confirm the GitHub repository is public and the README renders
- [ ] Paste the AI-use disclosure and the NASA resource URLs into the form
- [ ] Re-read the official Space Apps rules for current limits and the deadline, then submit
- [ ] Do not add NASA logos, and do not describe the project as certified, validated or endorsed
