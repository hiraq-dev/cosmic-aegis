"""Shared cache + polling for upstream sources. A source is only ever labelled "live" when its last successful
retrieval is recent; otherwise it is "cached" with its age, or "unavailable". Hardcoded data is never served."""
from __future__ import annotations

import asyncio
import random
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from ..models import SourceCache, utcnow
from . import adapters
from .http import UpstreamError

# seconds between polls, tuned to each provider's update rhythm and rate limits
INTERVALS = {"noaa_scales": 120, "noaa_kp": 120, "donki": 900, "eonet": 1800, "gibs": 3600, "iss": 20}


def _aware(d: datetime | None) -> datetime | None:
    return None if d is None else (d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc))


def _to_dt(s):
    return adapters.parse_time(s) if isinstance(s, str) else None


def describe(row: SourceCache | None, source: str, now: datetime | None = None) -> dict:
    """What the UI may say about a source right now."""
    now = _aware(now or utcnow())
    interval = INTERVALS.get(source, 600)
    if row is None or row.status == "never" or row.last_success_at is None:
        return {"source": source, "freshness": "unavailable", "live": False, "status": row.status if row else "never", "error": row.error if row else None, "data": None}
    ok_at = _aware(row.last_success_at)
    age = (now - ok_at).total_seconds()
    live = row.status == "ok" and age <= interval * 2.5
    return {
        "source": source,
        "freshness": "live" if live else "cached",
        "live": live,
        "status": row.status,
        "error": row.error,
        "retry_after_s": row.retry_after_s,
        "age_s": round(age),
        "times": {
            "observed_at": _aware(row.observed_at).isoformat() if row.observed_at else None,
            "issued_at": _aware(row.issued_at).isoformat() if row.issued_at else None,
            "retrieved_at": _aware(row.retrieved_at).isoformat() if row.retrieved_at else None,
            "last_success_at": ok_at.isoformat(),
        },
        "data": row.payload,
    }


async def refresh(db: Session, source: str, client: httpx.AsyncClient, api_key: str = "", now: datetime | None = None) -> SourceCache:
    now = _aware(now or utcnow())
    row = db.get(SourceCache, source) or SourceCache(source=source, status="never", payload={})
    row.retrieved_at = now
    try:
        if source == "noaa_scales":
            data = await adapters.noaa_scales(client)
        elif source == "noaa_kp":
            data = await adapters.noaa_kp(client)
        elif source == "donki":
            data = await adapters.donki(client, api_key)
        elif source == "eonet":
            data = await adapters.eonet(client)
        elif source == "gibs":
            data = await adapters.gibs_layer(client)
        elif source == "iss":
            data = await adapters.iss_position(client)
        else:
            raise UpstreamError("schema", f"unknown source {source}")
        row.payload = data
        row.observed_at = _to_dt(data.get("observed_at"))
        row.issued_at = _to_dt(data.get("issued_at"))
        row.last_success_at = now
        row.status, row.error, row.retry_after_s = "ok", None, None
    except UpstreamError as e:
        # keep the last good payload (it keeps its age); only the status changes
        row.status = "rate_limited" if e.kind == "rate_limited" else "error"
        row.error = f"{e.kind}: {e}"[:200]
        row.retry_after_s = e.retry_after
    db.merge(row)
    db.commit()
    return db.get(SourceCache, source)


def next_delay(source: str, row: SourceCache | None, rng: random.Random | None = None) -> float:
    r = rng or random
    base = INTERVALS.get(source, 600)
    if row is not None and row.status == "rate_limited":
        base = max(base, row.retry_after_s or 3600)
    elif row is not None and row.status == "error":
        base = min(base * 2, 3600)
    return base * r.uniform(0.9, 1.2)  # jitter so sources do not poll in lockstep


async def poll_forever(session_factory, source: str, api_key: str, stop: asyncio.Event):
    async with httpx.AsyncClient(headers={"User-Agent": "AEGIS-prototype/0.1"}) as client:
        while not stop.is_set():
            with session_factory() as db:
                try:
                    row = await refresh(db, source, client, api_key)
                except asyncio.CancelledError:
                    raise
                except Exception:  # noqa: BLE001 - a poller must never die
                    row = None
                delay = next_delay(source, row)
            try:
                await asyncio.wait_for(stop.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass
