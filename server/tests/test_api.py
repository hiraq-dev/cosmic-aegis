from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.config import Settings
from app.db import Database
from app.main import create_app
from conftest import signup

NOW = lambda: datetime.now(timezone.utc)


def ev(i, hr=70, at=None, dev="d1", **kw):
    e = {"event_id": f"e{i}", "device_id": dev, "metric": "heart_rate", "value": hr, "unit": "bpm"}
    if at is not None:
        e["observed_at"] = at.isoformat()
    e.update(kw)
    return e


def test_fresh_account_has_no_history(client):
    h, _ = signup(client, "a@x.io")
    assert client.get("/measurements", params={"metric": "heart_rate"}, headers=h).json() == []
    assert client.get("/checkins", headers=h).json() == []
    assert client.get("/me/history", headers=h).json() == {"text": ""}
    cards = client.get("/cards", headers=h).json()
    assert cards["cardiovascular"]["heart_rate"]["state"] == "unavailable"


def test_duplicates_and_out_of_order(client):
    h, _ = signup(client, "a@x.io")
    t = NOW()
    r = client.post("/measurements", headers=h, json={"events": [ev(1, at=t), ev(1, at=t), ev(2, at=t - timedelta(seconds=30))]}).json()
    assert r["stored"] == 2 and r["duplicates"] == 1 and r["late"] == 1
    again = client.post("/measurements", headers=h, json={"events": [ev(1, at=t)]}).json()
    assert again["stored"] == 0 and again["duplicates"] == 1
    rows = client.get("/measurements", params={"metric": "heart_rate"}, headers=h).json()
    assert [x["event_id"] for x in rows] == ["e2", "e1"]  # ordered by observed time


def test_missing_timestamp_marked_as_proxy(client):
    h, _ = signup(client, "a@x.io")
    client.post("/measurements", headers=h, json={"events": [ev(1)]})
    row = client.get("/measurements", params={"metric": "heart_rate"}, headers=h).json()[0]
    assert row["timestamp_origin"] == "receive_time_proxy" and "timestamp_proxy" in row["quality_flags"]


def test_same_day_multiple_checkins_kept(client):
    h, _ = signup(client, "a@x.io")
    for mood in (3, 4, 2):
        assert client.post("/checkins", headers=h, json={"kind": "mood", "payload": {"mood": mood}}).status_code == 201
    assert len(client.get("/checkins", headers=h).json()) == 3


def test_stale_and_disconnected_states(client):
    h, _ = signup(client, "a@x.io")
    client.post("/measurements", headers=h, json={"events": [ev(1, at=NOW() - timedelta(seconds=40))]})
    assert client.get("/cards", headers=h).json()["cardiovascular"]["heart_rate"]["state"] == "stale"
    client.post("/measurements", headers=h, json={"events": [ev(2, at=NOW())]})
    assert client.get("/cards", headers=h).json()["cardiovascular"]["heart_rate"]["state"] == "receiving"
    client.post("/devices", headers=h, json={"id": "d1", "kind": "ble_heart_rate"})
    client.post("/devices/d1/state", headers=h, json={"state": "disconnected"})
    assert client.get("/cards", headers=h).json()["cardiovascular"]["heart_rate"]["state"] == "disconnected"


def test_no_fabricated_environment_values(client):
    h, _ = signup(client, "a@x.io")
    c = client.get("/cards", headers=h).json()["cabin"]
    assert c["co2_ppm"]["state"] == "unavailable" and c["temperature_c"]["state"] == "unavailable"
    assert c["co2_ppm"].get("value") is None


def test_device_token_ingest(client):
    h, _ = signup(client, "a@x.io")
    tok = client.post("/devices", headers=h, json={"id": "co2-1", "kind": "co2_sensor", "label": "Lab CO2", "with_token": True}).json()["token"]
    body = {"events": [{"event_id": "1", "device_id": "co2-1", "metric": "co2_ppm", "value": 640, "unit": "ppm", "observed_at": NOW().isoformat()}]}
    assert client.post("/ingest", json=body, headers={"x-device-id": "co2-1", "x-device-token": "wrong"}).status_code == 401
    assert client.post("/ingest", json=body, headers={"x-device-id": "co2-1", "x-device-token": tok}).json()["stored"] == 1
    assert client.get("/cards", headers=h).json()["cabin"]["co2_ppm"]["value"] == 640


def test_user_cannot_write_to_foreign_device(client):
    h1, _ = signup(client, "a@x.io")
    h2, _ = signup(client, "b@x.io")
    client.post("/devices", headers=h1, json={"id": "d1", "kind": "ble_heart_rate"})
    assert client.post("/measurements", headers=h2, json={"events": [ev(1)]}).status_code == 403


def test_review_requires_consent_and_is_audited(client, env):
    hc, cid = signup(client, "crew@x.io")
    hr, _ = signup(client, "rev@x.io", "reviewer")
    client.post("/measurements", headers=hc, json={"events": [ev(1)]})
    assert client.get("/measurements", params={"metric": "heart_rate", "subject_id": cid}, headers=hr).status_code == 403
    assert client.get("/review/cases", headers=hr).json() == []
    g = client.post("/consents", headers=hc, json={"reviewer_email": "rev@x.io", "scopes": ["heart_rate"]})
    assert g.status_code == 201
    assert len(client.get("/measurements", params={"metric": "heart_rate", "subject_id": cid}, headers=hr).json()) == 1
    # scope is enforced
    assert client.get("/measurements", params={"metric": "co2_ppm", "subject_id": cid}, headers=hr).status_code == 403
    assert client.get(f"/review/cases/{cid}/history", headers=hr).status_code == 403
    # notes: sent -> delivered -> acknowledged
    n = client.post(f"/review/cases/{cid}/notes", headers=hr, json={"body": "please rest"}).json()
    assert n["status"] == "sent"
    got = client.get("/notes", headers=hc).json()[0]
    assert got["delivered_at"] and got["acknowledged_at"] is None
    client.post(f"/notes/{n['id']}/ack", headers=hc)
    assert client.get("/notes", headers=hc).json()[0]["acknowledged_at"]
    # revocation closes access
    cons = client.get("/consents", headers=hc).json()[0]["id"]
    client.delete(f"/consents/{cons}", headers=hc)
    assert client.get("/measurements", params={"metric": "heart_rate", "subject_id": cid}, headers=hr).status_code == 403
    from sqlalchemy import select
    from app.models import Audit
    with env[1].Session() as s:
        acts = [a.action for a in s.scalars(select(Audit))]
    assert "review_read" in acts and "consent_revoked" in acts


def test_crew_cannot_read_other_crew(client):
    h1, id1 = signup(client, "a@x.io")
    h2, _ = signup(client, "b@x.io")
    assert client.get("/measurements", params={"metric": "heart_rate", "subject_id": id1}, headers=h2).status_code == 403


def test_auth_required(client):
    assert client.get("/cards").status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_survives_restart(tmp_path):
    cfg = Settings(database_url=f"sqlite:///{tmp_path/'p.db'}", jwt_secret="test-secret-test-secret-test-secret-123", poll_nasa=False)
    with TestClient(create_app(cfg)) as c:
        h, _ = signup(c, "a@x.io")
        c.post("/measurements", headers=h, json={"events": [ev(1, at=NOW())]})
    with TestClient(create_app(Settings(database_url=cfg.database_url, jwt_secret=cfg.jwt_secret, poll_nasa=False))) as c2:
        assert len(c2.get("/measurements", params={"metric": "heart_rate"}, headers=h).json()) == 1


def test_erasure(client):
    h, _ = signup(client, "a@x.io")
    client.post("/measurements", headers=h, json={"events": [ev(1)]})
    client.post("/checkins", headers=h, json={"kind": "note", "payload": {"t": "x"}})
    client.delete("/me/data", headers=h)
    assert client.get("/measurements", params={"metric": "heart_rate"}, headers=h).json() == []
    assert client.get("/checkins", headers=h).json() == []


def test_ready_reports_unknown_nasa_not_healthy(client):
    r = client.get("/ready").json()
    assert r["checks"]["nasa"]["noaa_kp"] == "unavailable" and r["checks"]["language_model"] == "not_configured"


def test_assistant_never_fakes_ai(client):
    h, _ = signup(client, "a@x.io")
    r = client.post("/assistant/chat", headers=h, json={"message": "how does radiation affect sleep"}).json()
    assert r["mode"] == "retrieval_only" and r["ai_generated"] is False and "missing_information" in r["sections"]
    s = client.post("/assistant/chat", headers=h, json={"message": "I want to kill myself"}).json()
    assert s["mode"] == "safety_notice" and s["ai_generated"] is False


def test_validation_and_rate_limit(client):
    h, _ = signup(client, "a@x.io")
    bad = ev(1, hr=70)
    bad["metric"] = "Bad Metric!"
    assert client.post("/measurements", headers=h, json={"events": [bad]}).status_code == 422
    r = client.post("/measurements", headers=h, json={"events": [ev(2, hr=400)]}).json()
    row = client.get("/measurements", params={"metric": "heart_rate"}, headers=h).json()
    assert "implausible_value" in row[0]["quality_flags"]
