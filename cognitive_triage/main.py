import base64
import io

import httpx
from pydantic import BaseModel

from common import load_config, make_app
from vlm import build_prompt, load_backend, parse_symptoms, symptoms_to_query

cfg = load_config()
app = make_app("cognitive_triage")
http = httpx.AsyncClient(timeout=30)  # shared client (per-request client creation is slow)
backend_error = None
try:
    backend = load_backend(cfg)
except Exception as e:  # missing weights must not crash the container
    backend, backend_error = None, str(e)


class TriageRequest(BaseModel):
    image_b64: str = ""
    note: str = ""           # optional crew-typed context


@app.get("/info")
def info():
    return {"backend": cfg["vlm"].get("backend", "mock"), "ready": backend is not None,
            "error": backend_error}


@app.post("/triage")
async def triage(req: TriageRequest):
    disclaimer = cfg["safety"]["disclaimer"]
    if backend is None:
        return {"status": "unavailable", "error": backend_error, "disclaimer": disclaimer}
    if not req.image_b64:
        return {"status": "bad_input", "error": "an image is required", "disclaimer": disclaimer}
    from PIL import Image
    try:
        image = Image.open(io.BytesIO(base64.b64decode(req.image_b64, validate=True))).convert("RGB")
    except Exception:
        return {"status": "bad_input", "error": "image_b64 is not a valid image", "disclaimer": disclaimer}
    raw = backend(image, build_prompt(cfg["conditions"]) + (f" Crew note: {req.note}" if req.note else ""))
    s = parse_symptoms(raw, cfg["conditions"])
    if not s["valid"] or s["condition"] == "none" or s["confidence"] < cfg["safety"]["min_confidence"]:
        return {"status": "no_finding", "symptoms": s, "disclaimer": disclaimer,
                "note": "Low confidence / no recognised condition. Do not rely on automated triage."}
    try:
        plan = (await http.post(f"{cfg['rag_url']}/query", json={"query": symptoms_to_query(s)})).json()
    except Exception as e:
        plan = {"answer": "Protocol database unavailable.", "sources": [], "confident": False,
                "error": str(e)}
    return {"status": "ok", "symptoms": s, "plan": plan, "disclaimer": disclaimer}
