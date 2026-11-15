"""Source adapters. Each returns structured values plus separate time fields:
observed_at (when it happened) and issued_at (provider issue time). The caller records retrieval and success times.
Structured fields are used instead of parsing prose. A missing value is None, never 0."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx

from .http import RetryPolicy, UpstreamError, get_json


def parse_time(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)  # NOAA time_tag carries no zone; its docs say UTC


def need(cond: bool, msg: str):
    if not cond:
        raise UpstreamError("schema", msg)


# ---- NOAA SWPC (not NASA) -----------------------------------------------------------------------------------------
async def noaa_scales(client: httpx.AsyncClient, policy: RetryPolicy | None = None) -> dict:
    data, _ = await get_json(client, "https://services.swpc.noaa.gov/products/noaa-scales.json", policy=policy)
    need(isinstance(data, dict) and "0" in data, "unexpected NOAA scales shape")
    cur = data["0"]

    def scale(k: str):
        try:
            v = cur[k]["Scale"]
            return int(v) if v not in (None, "") else None
        except (KeyError, TypeError, ValueError):
            return None

    stamp = f"{cur.get('DateStamp')}T{cur.get('TimeStamp')}Z" if cur.get("DateStamp") and cur.get("TimeStamp") else None
    return {
        "provider": "NOAA Space Weather Prediction Center",
        "current": {"radio_blackout_R": scale("R"), "solar_radiation_storm_S": scale("S"), "geomagnetic_G": scale("G")},
        "observed_at": parse_time(stamp).isoformat() if parse_time(stamp) else None,
        "note": "NOAA categories of space-weather conditions. Not a personal dose.",
    }


async def noaa_kp(client: httpx.AsyncClient, policy: RetryPolicy | None = None) -> dict:
    data, _ = await get_json(client, "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json", policy=policy)
    need(isinstance(data, list), "unexpected Kp shape")
    last = next((r for r in reversed(data) if isinstance(r, dict) and r.get("estimated_kp") is not None), None)
    series = [{"t": r.get("time_tag"), "kp": r.get("estimated_kp")} for r in data[-720:] if isinstance(r, dict)][::12]
    t = parse_time(last.get("time_tag")) if last else None
    return {
        "provider": "NOAA Space Weather Prediction Center",
        "current": {"kp": float(last["estimated_kp"]) if last else None},  # None when unknown, never 0
        "observed_at": t.isoformat() if t else None,
        "series": series,
    }


# ---- NASA DONKI ---------------------------------------------------------------------------------------------------
DONKI = "https://api.nasa.gov/DONKI"


async def donki(client: httpx.AsyncClient, api_key: str, days: int = 30, policy: RetryPolicy | None = None, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    start, end = (now - timedelta(days=days)).date().isoformat(), now.date().isoformat()
    raw: dict[str, list] = {}
    for kind in ("CME", "GST", "SEP", "RBE"):
        data, _ = await get_json(client, f"{DONKI}/{kind}", {"startDate": start, "endDate": end, "api_key": api_key or "DEMO_KEY"}, policy)
        need(isinstance(data, list), f"unexpected DONKI {kind} shape")
        raw[kind] = data
    events: dict[str, dict] = {}  # dedupe by provider id

    def add(kind, id_, t, link, extra=None):
        if not id_ or id_ in events:
            return
        pt = parse_time(t)
        events[id_] = {"id": id_, "kind": kind, "observed_at": pt.isoformat() if pt else None, "link": link, **(extra or {})}

    for r in raw["CME"]:
        add("CME", r.get("activityID"), r.get("startTime"), r.get("link"))
    for r in raw["GST"]:
        kps = [k.get("kpIndex") for k in (r.get("allKpIndex") or []) if isinstance(k, dict) and k.get("kpIndex") is not None]
        add("GST", r.get("gstID"), r.get("startTime"), r.get("link"), {"max_kp": max(kps) if kps else None})
    for r in raw["SEP"]:
        add("SEP", r.get("sepID"), r.get("eventTime"), r.get("link"))
    for r in raw["RBE"]:
        add("RBE", r.get("rbeID"), r.get("eventTime"), r.get("link"))
    ev = sorted(events.values(), key=lambda e: e["observed_at"] or "", reverse=True)
    counts: dict[str, int] = {}
    for e in ev:
        counts[e["kind"]] = counts.get(e["kind"], 0) + 1
    return {
        "provider": "NASA CCMC DONKI via api.nasa.gov",
        "window_days": days,
        "history_counts": counts,  # historical counts, deliberately separate from any statement about right now
        "events": ev[:60],
        "observed_at": next((e["observed_at"] for e in ev if e["observed_at"]), None),
        "uses_demo_key": not api_key,
        "note": "Events describe solar and geomagnetic activity. They are not a measurement of any person's dose.",
    }


# ---- NASA EONET ---------------------------------------------------------------------------------------------------
def centroid(geom: dict) -> tuple[float, float] | None:
    t, c = geom.get("type"), geom.get("coordinates")
    try:
        if t == "Point":
            return float(c[0]), float(c[1])
        if t == "Polygon":
            ring = c[0]
            return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    except (TypeError, IndexError, ValueError, ZeroDivisionError):
        return None
    return None  # unsupported geometry types are skipped and counted, not guessed


async def eonet(client: httpx.AsyncClient, policy: RetryPolicy | None = None) -> dict:
    data, _ = await get_json(client, "https://eonet.gsfc.nasa.gov/api/v3/events", {"status": "open", "limit": 150}, policy)
    need(isinstance(data, dict) and isinstance(data.get("events"), list), "unexpected EONET shape")
    events, skipped = [], 0
    for e in data["events"]:
        geoms = [g for g in e.get("geometry", []) if isinstance(g, dict)]
        g = geoms[-1] if geoms else None
        cen = centroid(g) if g else None
        if not cen:
            skipped += 1
            continue
        events.append({
            "id": e.get("id"), "title": e.get("title"), "category": (e.get("categories") or [{}])[0].get("title"),
            "lon": cen[0], "lat": cen[1], "observed_at": g.get("date"), "geometry_type": g.get("type"),
            "sources": [s.get("url") for s in e.get("sources", []) if s.get("url")], "link": e.get("link"),
        })
    return {"provider": "NASA EONET", "events": events, "skipped_unsupported_geometry": skipped,
            "observed_at": max((e["observed_at"] for e in events if e["observed_at"]), default=None)}


# ---- NASA GIBS ----------------------------------------------------------------------------------------------------
GIBS_TILE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/GoogleMapsCompatible_Level9/3/3/4.jpg"


async def gibs_layer(client: httpx.AsyncClient, layer: str = "MODIS_Terra_CorrectedReflectance_TrueColor", policy: RetryPolicy | None = None, now: datetime | None = None) -> dict:
    """Probe one tile to learn which acquisition time GIBS actually served (Layer-Time-Actual header)."""
    now = now or datetime.now(timezone.utc)
    for back in (0, 1, 2):
        day = (now - timedelta(days=back)).date().isoformat()
        try:
            r = await client.get(GIBS_TILE.format(layer=layer, date=day), timeout=(policy or RetryPolicy()).timeout)
        except httpx.HTTPError as e:
            raise UpstreamError("network", f"GIBS unreachable: {type(e).__name__}")
        if r.status_code == 429:
            raise UpstreamError("rate_limited", "GIBS rate limit", 600)
        if r.status_code == 200:
            return {
                "provider": "NASA GIBS (EOSDIS)", "layer_requested": layer, "layer_served": r.headers.get("layer-identifier-actual"),
                "projection": "EPSG:3857 (WMTS GoogleMapsCompatible_Level9)", "acquisition_time": r.headers.get("layer-time-actual"),
                "requested_date": day, "observed_at": r.headers.get("layer-time-actual"), "attribution": "Imagery: NASA GIBS / EOSDIS",
                "tile_template": f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{day}/GoogleMapsCompatible_Level9/{{z}}/{{y}}/{{x}}.jpg",
            }
    raise UpstreamError("http", "no GIBS imagery available for the last 3 days")


# ---- ISS (third party) --------------------------------------------------------------------------------------------
async def iss_position(client: httpx.AsyncClient, policy: RetryPolicy | None = None) -> dict:
    data, _ = await get_json(client, "https://api.wheretheiss.at/v1/satellites/25544", policy=policy)
    need(isinstance(data, dict) and "latitude" in data and "timestamp" in data, "unexpected ISS shape")
    return {
        "provider": "api.wheretheiss.at (third party, not NASA)", "kind": "propagated_orbit_position",
        "note": "Computed from published orbital elements: a predicted position, not an observation by an instrument on the station.",
        "lat": data["latitude"], "lon": data["longitude"], "altitude_km": data.get("altitude"), "velocity_kmh": data.get("velocity"),
        "observed_at": datetime.fromtimestamp(data["timestamp"], timezone.utc).isoformat(),
    }
