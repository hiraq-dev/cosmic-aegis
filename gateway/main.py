import time

import httpx
from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware

from common import load_config, make_app

cfg = load_config()
app = make_app("gateway")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8080", "http://127.0.0.1:8080",
                                  "http://localhost:8081", "http://127.0.0.1:8081"],
                   allow_methods=["GET", "POST"], allow_headers=["*"])
UP = cfg["upstream"]
last_triage = {"at": 0, "result": None}


async def call(method, url, **kw):
    async with httpx.AsyncClient(timeout=kw.pop("timeout", 5)) as c:
        return await c.request(method, url, **kw)


@app.get("/services")
async def services():
    out = {}
    for name, url in UP.items():
        try:
            out[name] = (await call("GET", f"{url}/health", timeout=3)).json()["status"]
        except Exception:
            out[name] = "down"  # one pipeline failing must not break the others
    return out


@app.get("/kinetic/status")
async def kinetic_status():
    try:
        return (await call("GET", f"{UP['kinetic_guardian']}/status")).json()
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
        r = await call("POST", f"{UP['cognitive_triage']}/triage", json=await request.json(), timeout=120)
        data = r.json()
    except Exception as e:
        return {"status": "unavailable", "error": str(e)}
    last_triage.update(at=time.time(), result=data)
    return data


@app.get("/overview")
async def overview():
    """Cross-validated alert level. critical = pipelines agree; warning = only one flags."""
    k = await kinetic_status()
    t = last_triage["result"] if time.time() - last_triage["at"] < cfg["alerting"]["cooldown_seconds"] * 10 else None
    kin_flag = bool(k.get("alert"))
    tri_flag = bool(t and t.get("status") == "ok" and t["symptoms"]["severity"] in ("moderate", "high"))
    if kin_flag and tri_flag:
        level = "critical"
    elif kin_flag or tri_flag:
        level = "warning"
    else:
        level = "nominal"
    return {"level": level, "kinetic": k, "triage": t, "services": await services()}
