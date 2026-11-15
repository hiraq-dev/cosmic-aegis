# Space Apps project form - paste-ready answers

Fill the `<...>` items before submitting. Everything below matches what the repo actually does.

## Project Name
C.O.S.M.I.C. AEGIS

## Summary (about 150 words; limit 1500 characters)
On a Mars mission a radio message takes up to 20 minutes each way, so a flight surgeon cannot respond to a medical emergency in real time. C.O.S.M.I.C. AEGIS is an offline, containerised edge-AI prototype that acts as an onboard medical assistant. A Kinetic Guardian pipeline uses pose estimation on camera video to track exercise form, count repetitions and flag fatigue, with no wearable sensors. A separate Cognitive Triage pipeline uses a vision-language model to turn a visible symptom into structured text, then retrieves cited procedures from an offline vector database of space-medicine protocols. Each component runs in its own Docker container on a network with no internet access, so a failure in one does not stop the others. Safety features include citation-only answers, confidence gating, frame debouncing and validated model output. It is decision support, not a diagnostic device.

## Project Demonstration
`<public link to 30-second video OR 7-slide deck, no login>`
- Slides: `submission/AEGIS_slides.pptx` (7 slides including title). Upload to Google Drive / GitHub and share a public link, or export to PDF.
- Use the full URL, e.g. https://...

## Project (public link)
`<https://github.com/<you>/<repo>>` - the repository must be public (no login or permission needed).

## Project Details
**What it does.** AEGIS gives a crew on a long-duration mission autonomous health monitoring and first-line medical triage when Earth cannot help in time. It has two deliberately separate pipelines.

**Pipeline 1 - Kinetic Guardian.** A YOLOv8-pose model exported to ONNX (ONNX Runtime; TensorRT/CUDA providers used when available) finds a person's skeleton in video. We compute knee angle and trunk lean, count repetitions, and compare recent reps to a baseline from the first reps. Shallower depth and more forward lean raise a 0-1 fatigue score, which can warn of degrading form on resistive exercise such as the ARED before an injury occurs. An alert needs 5 consecutive bad frames, which filters sensor glitches and spurious detections.

**Pipeline 2 - Cognitive Triage.** A vision-language model is prompted to describe a visible symptom as strict JSON (condition, confidence, location, severity). We never trust the output: malformed JSON, unknown conditions and low confidence become "no finding". Valid findings are turned into a query for the RAG service, which embeds protocol documents (PDF/text) with sentence-transformers, searches a vector index (FAISS), and returns the matching excerpts with source file and page. Answers are extractive and citation-only, so the system cannot invent medical advice; irrelevant queries return "no protocol found, escalate".

**Architecture and security.** Five services (kinetic_guardian, cognitive_triage, rag_service, gateway, dashboard), each configured by its own config.json, run as separate Docker containers. ML services sit on an internal network with no internet. Containers are read-only with all capabilities dropped and have memory limits and healthchecks. The gateway reports an overall alert level: critical only when both pipelines flag, warning if one does. A Mission Control dashboard shows the live skeleton feed, fatigue metrics, triage results with citations and service health.

**Benefits and intended impact.** Medical autonomy and lower crew burden for Artemis and Mars-class missions, without wearables, cloud access or a live communications link.

**Tools.** Python, FastAPI, ONNX Runtime, OpenCV, NumPy, sentence-transformers, FAISS, pypdf, Docker Compose, HTML/JS dashboard, optional Qwen2-VL through Hugging Face transformers.

**Creativity and design factors.** Separating "watching" from "reasoning" for fault isolation; refusing to generate unsupported medical text; treating every model output as untrusted; running fully offline.

**Honest status.** This is a hackathon prototype. Unit tests cover the biomechanics, fatigue logic, debouncing, retrieval, VLM-output validation and alert levels. `<Edit this line to reflect what you actually ran, e.g. "The full stack was run end to end in Docker on <date>" or "The VLM in the demo is a simulated mock backend, labelled as such.">` The fatigue score is a heuristic, not a clinical measure; the VLM is not clinically validated; the infrared sleep/heart-rate monitor is not implemented.

## Use of Super Intelligence (SI)
Select every option that applies. Based on this project:
- **Code:** SI used - the code, tests, configuration and documentation were largely written with Claude (Anthropic). Acknowledged in the README, which carries an AI-assistance disclosure; add the same note to the repo description/metadata.
- **Text:** SI used for drafting the summary and slides.
- **Images/video:** select only if you generated any with AI; if so add a visible "AI-generated" watermark. The slides contain no AI-generated images.
- **Audio:** select only if you use a synthetic voice-over; acknowledge it in the video description.
- No NASA logos, flags or mission identifiers may appear in any generated content.
- If your demo shows the mock VLM, caption it "SIMULATED output".

## NASA Data
Required for a Global Award. **List only what you actually loaded into the project**, with full URLs and
the link text being the resource name. Likely candidates (verify each URL works and that you used it):

| Link Text | Link URL |
|---|---|
| NASA HRP Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions | https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf |
| NASA HRP Evidence Report: Risk of Cardiovascular Disease and Other Degenerative Tissue Effects from Radiation Exposure | https://ntrs.nasa.gov/api/citations/20150016006/downloads/20150016006.pdf |
| `<NASA exercise/ARED reference used for the demo video>` | `<full URL>` |

If the protocol corpus is still only the bundled placeholder, you have not used NASA data yet: add real
public NASA documents to `rag_service/data/protocols/` and rebuild the index before claiming this.

## Space Agency Partner & Other Data

| Link Text | Link URL |
|---|---|
| Ultralytics YOLOv8-pose (model and export tooling) | https://github.com/ultralytics/ultralytics |
| ONNX Runtime | https://github.com/microsoft/onnxruntime |
| sentence-transformers all-MiniLM-L6-v2 | https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2 |
| FAISS | https://github.com/facebookresearch/faiss |
| FastAPI | https://github.com/fastapi/fastapi |
| Qwen2-VL-2B-Instruct (only if the real VLM backend is used) | https://huggingface.co/Qwen/Qwen2-VL-2B-Instruct |
| `<Canadian Space Agency source, only if used>` | `<full URL>` |
| `<source of the exercise video / test images>` | `<full URL>` |

Check each licence (YOLOv8 is AGPL-3.0; Qwen2-VL has its own terms) and that you have permission to use any video or images.
