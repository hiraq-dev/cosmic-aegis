# C.O.S.M.I.C. AEGIS - Demo materials

Rules (from the submission form): demo is EITHER max 7 slides (title + intro included) OR a video of
30 s or less, on a public link needing no login. Pick one; the slides below double as a script source.

## A. 30-second video script (screen recording + voice-over, ~75 words)

| Time | On screen | Voice-over |
|---|---|---|
| 0-4 s | Mars graphic/black title: "40-minute delay. Earth cannot save you." (no NASA logos) | "Mars is 20 minutes away by radio. A medical emergency can't wait 40." |
| 4-10 s | Dashboard, skeleton overlay on exercise video, rep + fatigue numbers moving | "AEGIS is an offline medical officer. Pipeline one tracks exercise form with pose estimation and flags fatigue before injury." |
| 10-14 s | Fatigue rises, badge turns WARNING | "No wearables, just cameras." |
| 14-22 s | Upload wound image, plan appears with source citations. Caption: "SIMULATED VLM OUTPUT" | "Pipeline two: a vision-language model describes the symptom; offline retrieval over space-medicine protocols returns a cited treatment plan." |
| 22-27 s | Terminal: `docker compose stop kinetic_guardian`; triage still works, service shows "down" | "Isolated containers: if one fails, the other keeps running." |
| 27-30 s | Title card + repo URL | "C.O.S.M.I.C. AEGIS. Autonomous, offline, resilient." |

Recording tips: pre-load a sample image; pre-run the container stop so nothing waits; export at 720p;
add a visible "AI-assisted code" line in the end card (SI disclosure).

## B. 7-slide outline

1. **Title** - C.O.S.M.I.C. AEGIS: Offline Edge-AI Medical Officer for Deep Space. Team, challenge name, repo link.
2. **The problem** - 20-minute one-way delay; microgravity muscle/bone loss, radiation, isolation. One bold line: "Earth cannot save you."
3. **Our solution** - Two isolated pipelines + offline protocol knowledge base. One-sentence each: Kinetic Guardian (watches), Cognitive Triage (reasons).
4. **Architecture** - Diagram: cameras -> kinetic_guardian (YOLO-pose, ONNX/TensorRT) and cognitive_triage (VLM) -> rag_service (FAISS over protocols) -> gateway -> dashboard. Note: separate Docker containers, internal no-internet network.
5. **Demo** - 3 screenshots: skeleton + fatigue score; triage result with citations; one pipeline stopped, other alive.
6. **Safety and security** - Citation-only answers (no free-text medical generation); confidence gate -> "no finding"; 5-frame debounce against sensor glitches; validated VLM output; read-only, capability-dropped containers; combined alert level needs both pipelines to agree for critical.
7. **Impact, honesty, next steps** - Impact: autonomy for Artemis/Mars crews. Limits: prototype, proxy data, VLM unvalidated clinically, decision support only. Next: real protocol corpus, fine-tuned VLM, TensorRT benchmarks, sleep/heart-rate monitoring. Add credits + SI-use note.

## C. Form answers (draft)

**Summary (50-200 words):**
C.O.S.M.I.C. AEGIS is an offline, containerised edge-AI system that acts as an autonomous medical assistant
for deep-space crews, where a 40-minute round-trip radio delay makes Earth-based support impractical. A
Kinetic Guardian pipeline uses pose estimation to track exercise form and flag fatigue without wearables.
A separate Cognitive Triage pipeline uses a vision-language model to turn visible symptoms into structured
text, then retrieves cited procedures from an offline vector database of space-medicine protocols. Each
component runs in an isolated Docker container on an internal network, so a failure in one does not stop
the others. Safety features include citation-only answers, confidence gating, frame debouncing and
validated model output. It is a prototype for decision support, not a diagnostic device.

**NASA data/resources to list (add full URLs before submitting; verify each link works):**
- Public NASA Human Research Program / space-medicine documents actually loaded into `rag_service/data/protocols/`
- Any NASA exercise/ARED reference material used for the demo video
- (List only what you truly used.)

**Other resources:** Ultralytics YOLOv8-pose, ONNX Runtime, sentence-transformers all-MiniLM-L6-v2, FAISS,
FastAPI, Qwen2-VL (if enabled), Docker. Add CSA material only if used.

**SI use:** code largely AI-assisted (Claude); state this in README and on the demo end card. Mock VLM
output must be labelled "simulated".
