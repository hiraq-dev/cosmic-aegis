import time

import asyncio

import httpx
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from common import load_config, make_app

cfg = load_config()
app = make_app("gateway")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8080", "http://127.0.0.1:8080",
                                  "http://localhost:8081", "http://127.0.0.1:8081"],
                   allow_methods=["GET", "POST"], allow_headers=["*"])
UP = cfg["upstream"]
last_triage = {"at": 0, "result": None}


_client = None


async def call(method, url, **kw):
    """One shared client: building an AsyncClient (TLS context) per request is slow on some machines."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient()
    return await _client.request(method, url, timeout=kw.pop("timeout", 5), **kw)


@app.get("/services")
async def services():
    async def check(url):
        try:
            return (await call("GET", f"{url}/health", timeout=2)).json()["status"]
        except Exception:
            return "down"  # one pipeline failing must not break the others

    results = await asyncio.gather(*(check(u) for u in UP.values()))   # concurrent: slow failure can't stack
    return dict(zip(UP.keys(), results))


@app.get("/kinetic/status")
async def kinetic_status():
    try:
        return (await call("GET", f"{UP['kinetic_guardian']}/status", timeout=2)).json()
    except Exception:
        return {"error": "kinetic_guardian unavailable"}


@app.get("/kinetic/frame.jpg")
async def kinetic_frame():
    try:
        r = await call("GET", f"{UP['kinetic_guardian']}/frame.jpg")
        return Response(r.content, status_code=r.status_code, media_type="image/jpeg")
    except Exception:
        return Response(status_code=204)


@app.post("/triage")
async def triage(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"status": "bad_input", "error": "request body must be JSON"}, status_code=400)
    try:
        r = await call("POST", f"{UP['cognitive_triage']}/triage", json=body, timeout=120)
        data = r.json()
    except Exception as e:
        return {"status": "unavailable", "error": str(e)}
    last_triage.update(at=time.time(), result=data)
    return data


@app.get("/overview")
async def overview():
    """Cross-validated alert level. critical = pipelines agree; warning = only one flags."""
    k, svcs = await asyncio.gather(kinetic_status(), services())
    t = last_triage["result"] if time.time() - last_triage["at"] < cfg["alerting"]["cooldown_seconds"] * 10 else None
    kin_flag = bool(k.get("alert"))
    tri_flag = bool(t and t.get("status") == "ok" and t["symptoms"]["severity"] in ("moderate", "high"))
    if kin_flag and tri_flag:
        level = "critical"
    elif kin_flag or tri_flag:
        level = "warning"
    else:
        level = "nominal"
    return {"level": level, "kinetic": k, "triage": t, "services": svcs}
