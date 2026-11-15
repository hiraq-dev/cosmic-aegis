const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625
pres.title = "C.O.S.M.I.C. AEGIS";
pres.author = "Team AEGIS";

const BG = "1C2125", PANEL = "262E34", TEAL = "4FD1C5", TXT = "E6EDF0", MUT = "9AA8B0", WARN = "F6AD55";
const HF = "Cambria", BF = "Calibri";

function base(title, notes) {
  const s = pres.addSlide();
  s.background = { color: BG };
  s.addText(title, { x: 0.5, y: 0.35, w: 9, h: 0.8, fontFace: HF, fontSize: 36, bold: true, color: TEAL, margin: 0, isTextBox: true, objectName: "Title" });
  s.addText("C.O.S.M.I.C. AEGIS", { x: 0.5, y: 5.2, w: 4, h: 0.3, fontFace: BF, fontSize: 10, color: MUT, margin: 0, isTextBox: true });
  if (notes) s.addNotes(notes);
  return s;
}
const card = (s, x, y, w, h) => s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: PANEL }, line: { color: "33404A", width: 1 }, rectRadius: 0.1 });
const txt = (s, t, o) => s.addText(t, Object.assign({ fontFace: BF, color: TXT, fontSize: 14, margin: 0, isTextBox: true, valign: "top" }, o));

// 1 Title
{
  const s = pres.addSlide(); s.background = { color: BG };
  s.addText("C.O.S.M.I.C. AEGIS", { x: 0.7, y: 1.3, w: 8.6, h: 1, fontFace: HF, fontSize: 48, bold: true, color: TEAL, margin: 0, isTextBox: true });
  txt(s, "An offline edge-AI medical officer for deep space", { x: 0.7, y: 2.4, w: 8.6, h: 0.6, fontSize: 24 });
  txt(s, "Cottbus Orbital Software for Medical Informatics & Care", { x: 0.7, y: 3.1, w: 8.6, h: 0.4, fontSize: 14, color: MUT });
  txt(s, "NASA Space Apps Challenge 2026   |   Repo: <add public GitHub URL>", { x: 0.7, y: 4.5, w: 8.6, h: 0.4, fontSize: 14, color: MUT });
  s.addNotes("Introduce team and the challenge selected.");
}
// 2 Problem
{
  const s = base("Earth cannot save you", "20 minutes each way at maximum Mars distance.");
  txt(s, "40", { x: 0.5, y: 1.4, w: 3.2, h: 1.6, fontSize: 96, bold: true, color: WARN, fontFace: HF });
  txt(s, "minute round trip for a radio message at maximum Mars distance", { x: 0.5, y: 3.1, w: 3.2, h: 1.0, fontSize: 16, color: MUT });
  const items = [["Microgravity", "Muscle atrophy and bone loss demand daily exercise on the ARED"],
    ["Radiation", "Skin and tissue effects that need prompt assessment"],
    ["Isolation", "No flight surgeon in real time for injuries or illness"]];
  items.forEach(([h, d], i) => {
    const y = 1.4 + i * 1.15; card(s, 4.2, y, 5.3, 1.0);
    txt(s, h, { x: 4.4, y: y + 0.12, w: 4.9, h: 0.35, fontSize: 18, bold: true, color: TEAL });
    txt(s, d, { x: 4.4, y: y + 0.5, w: 4.9, h: 0.4, fontSize: 14 });
  });
}
// 3 Solution
{
  const s = base("Two pipelines, one offline guardian", "Separation of concerns: watching vs reasoning.");
  const cols = [["Kinetic Guardian", "Watches", "Pose estimation tracks exercise form and joint angles with cameras only. Flags fatigue before injury."],
    ["Cognitive Triage", "Reasons", "A vision-language model turns visible symptoms into structured text."],
    ["Protocol Knowledge Base", "Remembers", "Offline retrieval over space-medicine protocols returns a cited plan."]];
  cols.forEach(([h, tag, d], i) => {
    const x = 0.5 + i * 3.05; card(s, x, 1.5, 2.85, 3.3);
    txt(s, tag.toUpperCase(), { x: x + 0.2, y: 1.7, w: 2.45, h: 0.3, fontSize: 12, color: WARN, bold: true });
    txt(s, h, { x: x + 0.2, y: 2.05, w: 2.45, h: 0.8, fontSize: 20, bold: true, color: TEAL, fontFace: HF });
    txt(s, d, { x: x + 0.2, y: 2.95, w: 2.45, h: 1.7, fontSize: 14 });
  });
}
// 4 Architecture
{
  const s = base("Architecture: isolated containers", "Each box is its own Docker container with its own config.json.");
  const box = (x, y, w, h, label, sub, hl) => {
    s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: hl ? "1F4A47" : PANEL }, line: { color: TEAL, width: 1.25 }, rectRadius: 0.08 });
    txt(s, label, { x, y: y + 0.1, w, h: 0.35, align: "center", bold: true, fontSize: 14, color: TXT });
    txt(s, sub, { x, y: y + 0.48, w, h: h - 0.5, align: "center", fontSize: 11, color: MUT });
  };
  const arrow = (x1, y1, x2, y2) => s.addShape(pres.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), line: { color: MUT, width: 1.5, endArrowType: "triangle" }, flipV: y2 < y1 });
  box(0.5, 1.4, 2.4, 1.0, "Kinetic Guardian", "YOLO-pose, ONNX / TensorRT");
  box(0.5, 3.1, 2.4, 1.0, "Cognitive Triage", "VLM, validated JSON output");
  box(3.7, 3.1, 2.4, 1.0, "RAG Service", "FAISS over NASA/CSA protocols");
  box(6.9, 2.25, 2.6, 1.0, "Gateway", "Cross-checks alerts", true);
  box(6.9, 3.9, 2.6, 0.8, "Dashboard", "Mission Control UI");
  arrow(2.9, 1.9, 6.9, 2.6); arrow(2.9, 3.6, 3.7, 3.6); arrow(6.1, 3.6, 6.9, 3.0); arrow(8.2, 3.25, 8.2, 3.9);
  s.addShape(pres.ShapeType.rect, { x: 0.35, y: 1.25, w: 6.0, h: 3.0, fill: { type: "none" }, line: { color: MUT, width: 1, dashType: "dash" } });
  txt(s, "internal network: no internet access", { x: 0.45, y: 4.3, w: 5.8, h: 0.3, fontSize: 11, color: MUT });
}
// 5 Demo
{
  const s = base("Demo", "Replace each frame with a real screenshot. Label VLM output SIMULATED if the mock backend is used.");
  const caps = ["Skeleton overlay, reps and fatigue score", "Triage result with source citations (SIMULATED VLM)", "One container stopped, the other keeps running"];
  caps.forEach((c, i) => {
    const x = 0.5 + i * 3.05; card(s, x, 1.4, 2.85, 2.5);
    txt(s, "Insert screenshot " + (i + 1), { x, y: 2.4, w: 2.85, h: 0.5, align: "center", fontSize: 14, color: MUT });
    txt(s, c, { x, y: 4.05, w: 2.85, h: 0.9, align: "left", fontSize: 14 });
  });
}
// 6 Safety
{
  const s = base("Safety and security by design", "Every claim here maps to code in the repo.");
  const items = [["Citation-only answers", "No free-text medical generation, so no invented advice"],
    ["Confidence gate", "Low confidence returns 'no finding'"],
    ["Frame debounce", "5 consecutive frames needed before an alert"],
    ["Validated model output", "Malformed or unknown VLM output is rejected"],
    ["Hardened containers", "Read-only, capabilities dropped, offline network"],
    ["Alert agreement", "Critical only when both pipelines agree"]];
  items.forEach(([h, d], i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.4 + Math.floor(i / 2) * 1.2; card(s, x, y, 4.4, 1.05);
    txt(s, h, { x: x + 0.2, y: y + 0.12, w: 4.0, h: 0.35, fontSize: 16, bold: true, color: TEAL });
    txt(s, d, { x: x + 0.2, y: y + 0.52, w: 4.0, h: 0.45, fontSize: 13 });
  });
}
// 7 Impact
{
  const s = base("Impact, limits, next steps", "Be upfront that this is a prototype and decision support only.");
  const cols = [["Impact", ["Medical autonomy for Artemis and Mars crews", "No wearables, no cloud, no comms link"]],
    ["Limits", ["Prototype on proxy data", "VLM not clinically validated", "Decision support, not diagnosis"]],
    ["Next", ["Real protocol corpus and tuned VLM", "TensorRT benchmarks on flight-class hardware", "Sleep and heart-rate monitoring"]]];
  cols.forEach(([h, list], i) => {
    const x = 0.5 + i * 3.05; card(s, x, 1.4, 2.85, 2.9);
    txt(s, h, { x: x + 0.2, y: 1.55, w: 2.45, h: 0.4, fontSize: 20, bold: true, color: TEAL, fontFace: HF });
    s.addText(list.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < list.length - 1 } })),
      { x: x + 0.2, y: 2.1, w: 2.45, h: 2.1, fontFace: BF, fontSize: 14, color: TXT, margin: 0, valign: "top", paraSpaceAfter: 6, isTextBox: true });
  });
  txt(s, "Code written with AI assistance (Claude). Simulated outputs are labelled. No NASA logos used.", { x: 0.5, y: 4.55, w: 9, h: 0.4, fontSize: 12, color: MUT });
}
pres.writeFile({ fileName: "AEGIS_slides.pptx" }).then(f => console.log("wrote", f));
