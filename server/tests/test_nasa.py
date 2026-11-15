import asyncio
import random
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import select

from app.analytics import Point, trend
from app.db import Base, Database
from app.models import SourceCache, utcnow
from app.nasa import adapters, service
from app.nasa.http import RetryPolicy, UpstreamError, backoff_delay, get_json

FAST = RetryPolicy(attempts=2, base=0, cap=0, timeout=2)


def mock(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def run(c):
    return asyncio.run(c)


KP_OK = [{"time_tag": "2026-11-15T10:00:00", "estimated_kp": 2.33}, {"time_tag": "2026-11-15T10:01:00", "estimated_kp": None}]


def test_kp_missing_is_none_not_zero():
    async def go():
        async with mock(lambda r: httpx.Response(200, json=[{"time_tag": "2026-11-15T10:00:00", "estimated_kp": None}])) as c:
            return await adapters.noaa_kp(c, FAST)
    d = run(go())
    assert d["current"]["kp"] is None and d["observed_at"] is None


def test_kp_uses_last_known_value_and_utc_time():
    async def go():
        async with mock(lambda r: httpx.Response(200, json=KP_OK)) as c:
            return await adapters.noaa_kp(c, FAST)
    d = run(go())
    assert d["current"]["kp"] == 2.33 and d["observed_at"].endswith("+00:00")


def test_scales_missing_fields_are_none():
    async def go():
        async with mock(lambda r: httpx.Response(200, json={"0": {"DateStamp": "2026-11-15", "TimeStamp": "10:00:00", "G": {"Scale": "2"}, "S": {}}})) as c:
            return await adapters.noaa_scales(c, FAST)
    cur = run(go())["current"]
    assert cur["geomagnetic_G"] == 2 and cur["solar_radiation_storm_S"] is None and cur["radio_blackout_R"] is None


def test_schema_error_on_unexpected_shape():
    async def go():
        async with mock(lambda r: httpx.Response(200, json={"oops": 1})) as c:
            return await adapters.noaa_scales(c, FAST)
    with pytest.raises(UpstreamError) as e:
        run(go())
    assert e.value.kind == "schema"


def test_429_not_retried_and_retry_after_kept():
    calls = []

    def h(r):
        calls.append(1)
        return httpx.Response(429, headers={"retry-after": "120"})

    async def go():
        async with mock(h) as c:
            await get_json(c, "https://x.test/a", policy=RetryPolicy(attempts=3))
    with pytest.raises(UpstreamError) as e:
        run(go())
    assert e.value.kind == "rate_limited" and e.value.retry_after == 120 and len(calls) == 1


def test_5xx_retried_then_fails():
    calls = []

    def h(r):
        calls.append(1)
        return httpx.Response(503)

    async def go():
        async with mock(h) as c:
            await get_json(c, "https://x.test/a", policy=FAST, sleep=lambda s: asyncio.sleep(0))
    with pytest.raises(UpstreamError):
        run(go())
    assert len(calls) == 2


def test_backoff_has_full_jitter_and_cap():
    p = RetryPolicy(base=1, cap=4)
    rng = random.Random(1)
    vals = [backoff_delay(a, p, rng) for a in range(6) for _ in range(20)]
    assert max(vals) <= 4 and min(vals) >= 0 and len(set(round(v, 3) for v in vals)) > 20


def donki_handler(r):
    p = r.url.path
    if p.endswith("/CME"):
        return httpx.Response(200, json=[{"activityID": "c1", "startTime": "2026-11-14T01:00Z", "link": "l"}, {"activityID": "c1", "startTime": "2026-11-14T01:00Z"}])
    if p.endswith("/GST"):
        return httpx.Response(200, json=[{"gstID": "g1", "startTime": "2026-11-13T00:00Z", "allKpIndex": []}])
    return httpx.Response(200, json=[])


def test_donki_dedupes_flags_demo_key_and_handles_missing_kp():
    async def go():
        async with mock(donki_handler) as c:
            return await adapters.donki(c, "", policy=FAST)
    d = run(go())
    assert d["history_counts"] == {"CME": 1, "GST": 1} and d["uses_demo_key"] is True
    assert [e for e in d["events"] if e["kind"] == "GST"][0]["max_kp"] is None


def test_eonet_skips_unsupported_geometry_and_keeps_source_links():
    data = {"events": [
        {"id": "a", "title": "Fire", "categories": [{"title": "Wildfires"}], "geometry": [{"type": "Point", "coordinates": [10, 20], "date": "2026-11-14T00:00:00Z"}], "sources": [{"url": "https://s"}], "link": "l"},
        {"id": "b", "title": "Line", "geometry": [{"type": "LineString", "coordinates": [[0, 0], [1, 1]], "date": "2026-11-14T00:00:00Z"}]},
        {"id": "c", "title": "Poly", "geometry": [{"type": "Polygon", "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]], "date": "2026-11-14T00:00:00Z"}]},
    ]}

    async def go():
        async with mock(lambda r: httpx.Response(200, json=data)) as c:
            return await adapters.eonet(c, FAST)
    d = run(go())
    assert [e["id"] for e in d["events"]] == ["a", "c"] and d["skipped_unsupported_geometry"] == 1
    assert d["events"][0]["sources"] == ["https://s"]


def test_gibs_reports_actual_acquisition_time():
    h = {"layer-time-actual": "2026-11-14", "layer-identifier-actual": "MODIS_Terra_CorrectedReflectance_TrueColor"}

    async def go():
        async with mock(lambda r: httpx.Response(200, headers=h, content=b"jpg")) as c:
            return await adapters.gibs_layer(c, now=datetime(2026, 11, 15, tzinfo=timezone.utc))
    d = run(go())
    assert d["acquisition_time"] == "2026-11-14" and d["requested_date"] == "2026-11-15" and "EPSG:3857" in d["projection"]


def test_iss_labelled_third_party_predicted():
    async def go():
        async with mock(lambda r: httpx.Response(200, json={"latitude": 1, "longitude": 2, "timestamp": 1700000000})) as c:
            return await adapters.iss_position(c, FAST)
    d = run(go())
    assert "third party" in d["provider"] and d["kind"] == "propagated_orbit_position"


@pytest.fixture()
def db(tmp_path):
    d = Database(f"sqlite:///{tmp_path/'n.db'}")
    Base.metadata.create_all(d.engine)
    return d


def test_failure_keeps_old_payload_with_age_and_never_live(db):
    t0 = datetime(2026, 11, 15, 10, 0, tzinfo=timezone.utc)

    async def ok():
        async with mock(lambda r: httpx.Response(200, json=KP_OK)) as c:
            with db.Session() as s:
                return await service.refresh(s, "noaa_kp", c, now=t0)

    async def bad():
        async with mock(lambda r: httpx.Response(429, headers={"retry-after": "600"})) as c:
            with db.Session() as s:
                return await service.refresh(s, "noaa_kp", c, now=t0 + timedelta(minutes=3))

    row = run(ok())
    assert service.describe(row, "noaa_kp", t0 + timedelta(seconds=30))["freshness"] == "live"
    row = run(bad())
    d = service.describe(row, "noaa_kp", t0 + timedelta(minutes=30))
    assert d["freshness"] == "cached" and d["live"] is False and d["status"] == "rate_limited"
    assert d["data"]["current"]["kp"] == 2.33 and d["age_s"] == 1800
    # even right after a failed poll the old success is not live once it is old
    assert service.describe(row, "noaa_kp", t0 + timedelta(minutes=10))["live"] is False


def test_never_fetched_is_unavailable_not_snapshot(db):
    d = service.describe(None, "donki")
    assert d["freshness"] == "unavailable" and d["data"] is None


def test_next_delay_backs_off_on_rate_limit():
    row = SourceCache(source="donki", status="rate_limited", retry_after_s=3600, payload={})
    assert service.next_delay("donki", row, random.Random(0)) >= 3600 * 0.9


# ---- analytics ---------------------------------------------------------------------------------------------------------
DAY = 86400


def test_irregular_sampling_uses_elapsed_time():
    # slope must be 2/day regardless of uneven spacing
    days = [0, 0.1, 0.2, 1, 1.05, 3, 3.1, 6, 6.5, 7, 7.2, 9]
    pts = [Point(d * DAY, 60 + 2 * d) for d in days]
    r = trend(pts, sd_floor=1)
    assert r["status"] == "ok" and abs(r["trend"]["slope_per_day"] - 2) < 1e-6 and r["heuristic"] is True
    assert abs(r["projection"]["value"] - (60 + 2 * (9 + 3))) < 0.01


def test_insufficient_data_is_reported():
    r = trend([Point(i * 60, 70) for i in range(20)])  # many points but only 20 minutes
    assert r["status"] == "insufficient_data" and r["coverage"]["span_days"] < 1
