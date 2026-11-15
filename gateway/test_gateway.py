import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
os.environ["CONFIG_PATH"] = os.path.join(os.path.dirname(__file__), "config.json")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


class R:
    def __init__(self, data):
        self._d, self.content, self.status_code = data, b"", 200

    def json(self):
        return self._d


def fake_call(kinetic_alert):
    async def call(method, url, **kw):
        if url.endswith("/health"):
            if "rag" in url:
                raise ConnectionError
            return R({"status": "ok"})
        if url.endswith("/status"):
            return R({"alert": kinetic_alert, "summary": {}})
        if url.endswith("/triage"):
            return R({"status": "ok", "symptoms": {"severity": "high"}})
    return call


def test_levels_and_isolation(monkeypatch):
    c = TestClient(main.app)
    monkeypatch.setattr(main, "call", fake_call(False))
    main.last_triage.update(at=0, result=None)
    o = c.get("/overview").json()
    assert o["level"] == "nominal" and o["services"]["rag_service"] == "down"   # one down, others ok
    assert o["services"]["kinetic_guardian"] == "ok"
    c.post("/triage", json={})
    assert c.get("/overview").json()["level"] == "warning"
    monkeypatch.setattr(main, "call", fake_call(True))
    assert c.get("/overview").json()["level"] == "critical"
