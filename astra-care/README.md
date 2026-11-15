# ASTRA CARE - deep space wellbeing prototype (demo)

A static, no-build, no-login website prototype for the
[NASA Space Apps Challenge 2026: Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).

> **Simulated demo.** Every crew member, reading, alert and "link" is fictional sample data. Not a medical device.
> Not affiliated with or endorsed by NASA. Code, text and artwork were created with AI assistance (Claude by Anthropic).
> No NASA data or API is used. No NASA logos or insignia are used.

## Build checklist: 10 / 10 prototype modules implemented

| # | Module | What it really does |
|---|---|---|
| 01 | Animated Astro companion | Interactive SVG avatar with four moods, scripted messages, sound effects |
| 02 | Daily mental wellbeing check-in | Valence/arousal pad, sliders, sample log; adds a simulated packet to the queue |
| 03 | Funny interactive questions | Four sample prompts, banter, humour gauge |
| 04 | Sleep and fatigue dashboard | Demo metrics plus a working 1-tap reaction-time game (illustrative, not clinical) |
| 05 | 7-day sleep trend chart | Canvas chart of sample data, three metrics, hover tooltips |
| 06 | AI pattern detection | Scripted demo panel. **No machine-learning model runs.** |
| 07 | Prevention recommendations | Light screen, binaural tone generator, 4-7-8 breathing pacer (general wellbeing ideas, not medical advice) |
| 08 | Emergency SOS screen | Countdown and siren simulation. **Nothing real is ever sent.** |
| 09 | Offline data and transmission queue | In-memory simulation of delayed uplink and blackouts |
| 10 | Ground medical monitoring dashboard | Fictional crew vitals, synthetic ECG waveform, simulated actions |

An extra **Space Apps Requirements** tab holds an interactive submission checklist (saved in your browser), the NASA resources
to cite, and a copy-ready AI-use disclosure.

## Run

No install needed. Open `index.html`, or serve the folder:

```bash
cd astra-care
python -m http.server 8090
```

## Deploy (Vercel)

Import the repository, set **Root Directory** to `astra-care`, Framework Preset **Other**, no build command, no output directory.

## Known limitations

- All data is simulated; thresholds are illustrative; no clinical validity.
- Fonts load from Google Fonts; offline they fall back to system fonts.
- Tested in a Chromium-based browser only.
