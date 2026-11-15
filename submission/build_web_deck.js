// Builds the 7-slide deck (PPTX + HTML for PDF) from real website screenshots in web/shots.
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const S = path.resolve(__dirname, "../web/shots");
const img = (n) => path.join(S, n);

const TEAM = "Team AEGIS";
const REPO = "https://github.com/hiraq-dev/cosmic-aegis";
const LIVE = process.env.LIVE_URL || "";   // set after Vercel deployment
const liveText = LIVE || "Live URL: added after deployment";
const AI = "AI-generated / AI-assisted";

const slides = [
  { title: "C.O.S.M.I.C. AEGIS", sub: "Understand Your Health Beyond Earth",
    bullets: ["A prototype health-awareness website for astronauts on long space missions", "NASA Space Apps Challenge 2026: Create Health Monitoring Software for Astronauts on Space Missions", `${TEAM}  |  Demo data only, not a medical device`],
    images: [{ f: "c_hero.png", cap: `${AI} illustration (original artwork)` }, { f: "c_modules.png", cap: "Real screenshot of the prototype dashboard (demo data)" }] },
  { title: "The human challenge", sub: "Far from Earth, the body and mind change",
    bullets: ["NASA's Human Research Program names five hazards of spaceflight: radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments.", "Muscles and bones lose load, sleep and stress shift, and the cardiovascular system adapts.", "With long communication delays, astronauts need clear, calm self-awareness tools and good information to share with their medical team.", "Source: nasa.gov/hrp/hazards"],
    images: [] },
  { title: "Three health modules", sub: "Mental health | Musculoskeletal degradation | Cardiovascular awareness",
    bullets: [], images: [{ f: "s_mental.png", cap: "Mental health: check-in, mood and sleep trends" }, { f: "s_musculoskeletal.png", cap: "Musculoskeletal: body figure, exercise log" }, { f: "s_cardiovascular.png", cap: "Cardiovascular: readings and risk awareness (not diagnosis)" }] },
  { title: "Personal health and the bigger picture", sub: "Not just the mission: the person",
    bullets: ["Personal profile, optional family history and health concerns, all stored only in the browser.", "Cardiovascular module raises awareness of warning signs. It never diagnoses, predicts or prevents heart attacks.", "Implemented: forms, validation, charts, rule-based alerts, local storage.", "Simulated: astronaut, mission, 14-day history, radiation, CO2, cabin temperature.", "Future: computer-vision exercise analysis, ML health analysis, wearable sensors, clinical validation."],
    images: [{ f: "c_profile.png", cap: "Real screenshot: personal health profile (demo data)" }] },
  { title: "User journey", stack: true, sub: "Check in, understand, act",
    bullets: ["1. Daily check-in and readings", "2. Gentle alerts and plain-language suggestions", "3. Trends over 14 days to share with the care team"],
    images: [{ f: "c_checkin_alerts.png", cap: "1-2. Check-in and alerts" }, { f: "c_modules.png", cap: "Module summaries" }, { f: "c_trends.png", cap: "3. Trends (demo data)" }] },
  { title: "Technology, NASA resources, collaboration", sub: "Frontend-only prototype, no backend or login",
    bullets: ["React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide icons; deployed as a static site.", "Referenced (no datasets or APIs connected): NASA HRP hazards and risks pages, ongoing HRP research, two NASA NTRS evidence reports, two Canadian Space Agency articles.", "Integration points ready for computer vision, ML analysis and wearables (src/integrations).", "Space health is a global effort: NASA, CSA, ESA and others share research. Not affiliated with or endorsed by NASA or CSA.", "Code, text and art created with AI assistance (Claude by Anthropic)."],
    images: [] },
  { title: "Health beyond Earth starts with awareness", sub: "Calm information, early, for every crew member",
    bullets: [`Team: ${TEAM}`, `Website: ${liveText}`, `GitHub: ${REPO}`, "QR code: GitHub repository", "All data shown is illustrative demo data."],
    images: [{ f: "c_hero.png", cap: "Real screenshot of the prototype" }, { f: "qr_repo.png", cap: "Scan: GitHub repo", qr: true }] },
];

// ---------- PPTX ----------
const p = new pptxgen(); p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
p.title = "C.O.S.M.I.C. AEGIS"; p.author = TEAM;
const BG = "060B1F", CY = "22D3EE", TX = "E2E8F0", MUT = "94A3B8";
slides.forEach((s, i) => {
  const sl = p.addSlide(); sl.background = { color: BG };
  sl.addText(s.title, { x: 0.5, y: 0.3, w: 12.3, h: 0.8, fontFace: "Calibri", fontSize: 34, bold: true, color: "FFFFFF" });
  sl.addText(s.sub, { x: 0.5, y: 1.05, w: 12.3, h: 0.45, fontSize: 16, color: CY });
  const n = s.images.length;
  const textW = n === 0 ? 12.3 : ((n >= 3 && !s.stack) ? 12.3 : 5.2);
  const hasBottomImgs = n >= 3 && !s.stack;
  if (s.bullets.length) sl.addText(s.bullets.map((b) => ({ text: b, options: { bullet: s.bullets.length > 1 && !hasBottomImgs, breakLine: true } })), { x: 0.5, y: 1.7, w: textW, h: hasBottomImgs ? 1.0 : 4.8, fontSize: n === 0 ? 20 : 15, color: TX, valign: "top", paraSpaceAfter: 8 });
  if (hasBottomImgs) {
    const w = 4.0, h = w * 1000 / 1890; // crops are ~1.89:1 or other; contain
    s.images.forEach((im, k) => {
      const dims = require("child_process").execSync(`py -3.12 -c "from PIL import Image;i=Image.open(r'${img(im.f)}');print(i.width,i.height)"`).toString().trim().split(" ").map(Number);
      const ww = 4.0, hh = Math.min(ww * dims[1] / dims[0], 4.2);
      sl.addImage({ path: img(im.f), x: 0.5 + k * 4.15, y: s.bullets.length ? 2.8 : 1.8, w: ww, h: hh });
      sl.addText(im.cap, { x: 0.5 + k * 4.15, y: (s.bullets.length ? 2.8 : 1.8) + hh + 0.05, w: ww, h: 0.5, fontSize: 11, color: MUT });
    });
  } else if (n > 0) {
    let y = 1.7;
    s.images.forEach((im) => {
      const dims = require("child_process").execSync(`py -3.12 -c "from PIL import Image;i=Image.open(r'${img(im.f)}');print(i.width,i.height)"`).toString().trim().split(" ").map(Number);
      const maxW = im.qr ? 2.4 : 6.8, maxH = im.qr ? 2.4 : (s.stack ? 1.6 : n === 2 ? 2.4 : 4.6);
      let ww = maxW, hh = ww * dims[1] / dims[0]; if (hh > maxH) { hh = maxH; ww = hh * dims[0] / dims[1]; }
      sl.addImage({ path: img(im.f), x: 6.2 + (maxW - ww), y, w: ww, h: hh });
      sl.addText(im.cap, { x: 6.2, y: y + hh + 0.03, w: 6.8, h: 0.3, fontSize: 11, color: MUT, align: "right" });
      y += hh + 0.45;
    });
  }
  sl.addText(`${AI} content | Demo data only | Not a medical device | Not affiliated with NASA`, { x: 0.5, y: 7.05, w: 11.5, h: 0.3, fontSize: 10, color: MUT });
  sl.addText(String(i + 1), { x: 12.3, y: 7.05, w: 0.6, h: 0.3, fontSize: 10, color: MUT, align: "right" });
});
p.writeFile({ fileName: path.join(__dirname, "AEGIS_SpaceApps_7slides.pptx") }).then(() => console.log("pptx ok"));

// ---------- HTML (for PDF) ----------
const html = `<!doctype html><meta charset="utf-8"><title>C.O.S.M.I.C. AEGIS</title><style>
@page{size:1280px 720px;margin:0}*{box-sizing:border-box}body{margin:0;background:#060b1f;color:#e2e8f0;font-family:Segoe UI,Calibri,sans-serif}
.s{width:1280px;height:720px;padding:34px 48px;position:relative;overflow:hidden;page-break-after:always;background:#060b1f}
h1{margin:0;font-size:38px;color:#fff}h2{margin:4px 0 14px;font-size:18px;color:#22d3ee;font-weight:500}
.row{display:flex;gap:24px;align-items:flex-start}.t{flex:1;min-width:380px;font-size:18px;line-height:1.4}.t li{margin-bottom:9px}.t.big{font-size:22px}
figure{margin:0}figure img{display:block;width:100%;border:1px solid #1e293b;border-radius:8px}figcaption{font-size:12px;color:#94a3b8;margin-top:4px}
.f{position:absolute;left:48px;bottom:14px;font-size:11px;color:#94a3b8}.n{position:absolute;right:48px;bottom:14px;font-size:11px;color:#94a3b8}
.g3{display:flex;gap:16px}.g3 figure{flex:1}.q{width:170px}.q img{border:none;background:#fff}</style>
${slides.map((s, i) => {
  const n = s.images.length;
  const figs = s.images.map((im) => `<figure ${im.qr ? 'class="q"' : ""} style="${(n < 3 || s.stack) && !im.qr ? "width:" + (s.stack ? "440px" : n === 2 ? "700px" : "700px") : ""}"><img src="file:///${img(im.f).replace(/\\/g, "/")}"><figcaption>${im.cap}</figcaption></figure>`).join("");
  const lis = s.bullets.map((b) => `<li>${b}</li>`).join("");
  const body = (n >= 3 && !s.stack) ? `<ul class="t" style="padding-left:20px;margin:0 0 10px">${lis}</ul><div class="g3">${figs}</div>`
    : `<div class="row"><ul class="t ${n === 0 ? "big" : ""}" style="padding-left:20px;margin:0">${lis}</ul><div>${figs}</div></div>`;
  return `<section class="s"><h1>${s.title}</h1><h2>${s.sub}</h2>${body}<div class="f">${AI} content | Demo data only | Not a medical device | Not affiliated with NASA</div><div class="n">${i + 1}</div></section>`;
}).join("")}`;
fs.writeFileSync(path.join(__dirname, "AEGIS_website_deck.html"), html);
console.log("html ok");
