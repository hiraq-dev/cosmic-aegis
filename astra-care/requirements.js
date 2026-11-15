// Interactive Space Apps requirements tracker. State is kept in this browser only (localStorage).
(function () {
  var KEY = "astra-care-rules-v1";
  var ITEMS = [
    { id: "challenge", text: "Chose a challenge: Create Health Monitoring Software for Astronauts on Space Missions", why: "Pick exactly the challenge your project answers.", auto: true },
    { id: "public-demo", text: "Demo is public and needs no login: up to 7 slides or a 30-second video", why: "Judges must open it without an account. Check the current limits on the official site." },
    { id: "public-link", text: "Public project link (live website and/or GitHub repository) works for anyone", why: "Test it in a private window." },
    { id: "nasa-data", text: "NASA data or resources are used and cited with full URLs", why: "Needed to be considered for the Global Awards. This demo cites background pages only; add real data use if you add it." },
    { id: "no-branding", text: "No NASA logos, insignia or wording that implies NASA endorsement", why: "This site uses an original emblem and says it is not affiliated with NASA.", auto: true },
    { id: "ai-disclosure", text: "AI use disclosed in the submission text (and in file metadata where possible)", why: "Copy the text below into the form. AI-generated images or video should be watermarked or labelled.", auto: true },
    { id: "honest", text: "Nothing is presented as real that is simulated (data, alerts, certifications)", why: "Every value here is labelled as demo data.", auto: true },
    { id: "summary", text: "Project summary written (50-200 words) and details filled in", why: "Plain language: problem, what you built, who it helps." },
    { id: "partner", text: "Space agency partner and other data/resources listed in the form", why: "List only what you really used." },
    { id: "team", text: "Team members registered and the final submission sent before the deadline", why: "Only you can confirm this." }
  ];
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { state = {}; }
  ITEMS.forEach(function (it) { if (it.auto && state[it.id] === undefined) state[it.id] = true; });

  var list = document.getElementById("rules-list");
  if (!list) return;

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function update() {
    var done = ITEMS.filter(function (i) { return state[i.id]; }).length;
    document.getElementById("rules-progress-tag").textContent = done + " / " + ITEMS.length + " DONE";
    document.getElementById("rules-progress-fill").style.width = Math.round((done / ITEMS.length) * 100) + "%";
  }

  ITEMS.forEach(function (it) {
    var li = document.createElement("li");
    var cb = document.createElement("input");
    cb.type = "checkbox"; cb.id = "rule-" + it.id; cb.checked = !!state[it.id];
    cb.addEventListener("change", function () { state[it.id] = cb.checked; save(); update(); });
    var lb = document.createElement("label");
    lb.htmlFor = cb.id;
    lb.appendChild(document.createTextNode(it.text));
    if (it.auto) { var t = document.createElement("span"); t.className = "auto-tag"; t.textContent = "AUTO"; lb.appendChild(t); }
    var why = document.createElement("span"); why.className = "why"; why.textContent = it.why;
    lb.appendChild(why);
    li.appendChild(cb); li.appendChild(lb); list.appendChild(li);
  });
  update();

  var copy = document.getElementById("copy-ai-btn");
  if (copy) copy.addEventListener("click", function () {
    var text = document.getElementById("rules-ai-text").textContent;
    var done = function () { if (window.app) window.app.showToast("AI disclosure text copied.", "success"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done); else done();
  });
})();
