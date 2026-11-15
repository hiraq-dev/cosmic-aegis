"""Run all AEGIS services natively (no Docker). Dev/testing aid.

    python scripts/run_native.py          # starts 4 API services + dashboard (http://localhost:8080)

Writes localhost-adapted copies of each config.json into .native/ and leaves the originals untouched.
"""
import json
import os
import subprocess
import sys
import time
import http.server
import threading
import functools

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
NATIVE = os.path.join(ROOT, ".native")
fw = lambda p: p.replace("\\", "/")

SERVICES = [("rag_service", 8003), ("cognitive_triage", 8002), ("kinetic_guardian", 8001), ("gateway", 8000)]
SUBS = [
    ("http://rag_service:", "http://localhost:"), ("http://kinetic_guardian:", "http://localhost:"),
    ("http://cognitive_triage:", "http://localhost:"),
    ("/data/protocols", fw(os.path.join(ROOT, "rag_service/data/protocols"))),
    ("/data/index", fw(os.path.join(ROOT, "rag_service/data/index"))),
    ("/data/sample_ared.mp4", fw(os.path.join(ROOT, "data/video/sample_ared.mp4"))),
    ("/data/sleep_ir.mp4", fw(os.path.join(ROOT, "data/video/sleep_ir.mp4"))),
    ("/models/", fw(os.path.join(ROOT, "models")) + "/"),
]

os.makedirs(NATIVE, exist_ok=True)
procs = []
for name, port in SERVICES:
    text = open(os.path.join(ROOT, name, "config.json"), encoding="utf-8").read()
    for a, b in SUBS:
        text = text.replace(a, b)
    cfg = os.path.join(NATIVE, f"{name}.json")
    open(cfg, "w", encoding="utf-8").write(text)
    env = dict(os.environ, CONFIG_PATH=cfg, PYTHONPATH=os.path.join(ROOT, "shared"),
               HF_HOME=os.path.join(ROOT, "rag_service", "data", "hf"))
    log = open(os.path.join(NATIVE, f"{name}.log"), "w")
    procs.append(subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--port", str(port), "--app-dir", os.path.join(ROOT, name)],
        env=env, stdout=log, stderr=subprocess.STDOUT, cwd=os.path.join(ROOT, name)))
    print(f"started {name} on :{port}")

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, "dashboard"))
for dash_port in (8080, 8081):   # 8080 can be reserved by Windows; the gateway allows both origins
    try:
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", dash_port), handler)
        break
    except OSError:
        continue
else:
    for p in procs:
        p.terminate()
    sys.exit("no free dashboard port (8080/8081)")
threading.Thread(target=srv.serve_forever, daemon=True).start()
print(f"dashboard on http://localhost:{dash_port}  (Ctrl+C to stop; logs in .native/)")
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    pass
finally:
    for p in procs:
        p.terminate()
