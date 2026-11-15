"""Append-only measurement ingestion and card-state derivation.

Rules (see docs/DATA_CONTRACT.md):
* Idempotent: (subject, device, event_id) is unique; a repeat is reported as a duplicate, never stored twice.
* Out-of-order events are accepted and flagged "late"; reads order by observed_at.
* If the device sent no timestamp, observed_at is the receive time and timestamp_origin is "receive_time_proxy".
* Timestamps far from the server clock are flagged, never silently corrected.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Measurement, utcnow

CLOCK_SKEW_FLAG = timedelta(minutes=5)
VALID_RANGES = {  # physiologically plausible bounds, used only to flag implausible values
    "heart_rate": (20.0, 250.0, "bpm"),
    "co2_ppm": (250.0, 40000.0, "ppm"),
    "temperature_c": (-20.0, 60.0, "C"),
}


def as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


@dataclass
class IngestResult:
    stored: int = 0
    duplicates: int = 0
    late: int = 0
    rejected: int = 0
    errors: list[str] | None = None


def ingest(db: Session, subject_id: str, events: list[dict], received_at: datetime | None = None) -> IngestResult:
    received = as_utc(received_at or utcnow())
    res = IngestResult(errors=[])
    seen_in_batch: set[tuple[str, str]] = set()
    for ev in events:
        try:
            metric, unit = ev["metric"], ev["unit"]
            value = float(ev["value"])
            device = ev["device_id"]
            event_id = ev["event_id"]
        except (KeyError, TypeError, ValueError):
            res.rejected += 1
            res.errors.append("malformed event")
            continue
        key = (device, event_id)
        exists = key in seen_in_batch or db.scalar(select(Measurement.pk).where(Measurement.subject_id == subject_id, Measurement.device_id == device, Measurement.event_id == event_id))
        if exists:
            res.duplicates += 1
            continue
        seen_in_batch.add(key)

        flags: list[str] = list(ev.get("quality_flags") or [])
        raw_ts = ev.get("observed_at")
        if raw_ts is None:
            observed, origin = received, "receive_time_proxy"
            flags.append("timestamp_proxy")
        else:
            observed = as_utc(raw_ts if isinstance(raw_ts, datetime) else datetime.fromisoformat(str(raw_ts).replace("Z", "+00:00")))
            origin = ev.get("timestamp_origin") or "device"
            skew = received - observed
            if observed - received > CLOCK_SKEW_FLAG:
                flags.append("future_timestamp")
            elif skew > CLOCK_SKEW_FLAG and ev.get("source_type", "device") != "replay":
                flags.append("clock_skew_or_delayed")
        rng = VALID_RANGES.get(metric)
        if rng and not (rng[0] <= value <= rng[1]):
            flags.append("implausible_value")
        newest = db.scalar(select(func.max(Measurement.observed_at)).where(Measurement.subject_id == subject_id, Measurement.metric == metric, Measurement.device_id == device))
        if newest is not None and observed < as_utc(newest):
            flags.append("late")
            res.late += 1
        db.add(Measurement(
            event_id=event_id, subject_id=subject_id, device_id=device, metric=metric, value=value, unit=unit,
            observed_at=observed, received_at=received, source=ev.get("source", device), source_type=ev.get("source_type", "device"),
            timestamp_origin=origin, quality_flags=sorted(set(flags)), context=ev.get("context"), session_id=ev.get("session_id"),
            sequence=ev.get("sequence"),
        ))
        res.stored += 1
    db.commit()
    return res


def series(db: Session, subject_id: str, metric: str, since: datetime | None = None, limit: int = 2000) -> list[Measurement]:
    q = select(Measurement).where(Measurement.subject_id == subject_id, Measurement.metric == metric)
    if since:
        q = q.where(Measurement.observed_at >= since)
    q = q.order_by(Measurement.observed_at.desc()).limit(limit)
    return list(reversed(list(db.scalars(q))))


CARD_STATES = ("receiving", "connected_waiting", "stale", "disconnected", "unavailable", "manual", "estimated", "historical_replay")


def card_state(latest: Measurement | None, *, now: datetime, stale_after_s: int, client_connection: str | None = None) -> dict:
    """Derive what a dashboard card may truthfully say. A successful fetch never makes an old observation current."""
    now = as_utc(now)
    if latest is None:
        if client_connection == "connected":
            return {"state": "connected_waiting", "age_s": None, "label": "Connected, waiting for the first reading"}
        return {"state": "unavailable", "age_s": None, "label": "No data source has supplied this metric"}
    observed = as_utc(latest.observed_at)
    age = max(0.0, (now - observed).total_seconds())
    base = {"age_s": round(age, 1), "observed_at": observed.isoformat(), "timestamp_origin": latest.timestamp_origin, "source": latest.source, "source_type": latest.source_type}
    if latest.source_type == "replay":
        return {**base, "state": "historical_replay", "label": "Historical replay, not live"}
    if latest.source_type == "manual":
        return {**base, "state": "manual", "label": "Manually entered"}
    if latest.source_type == "estimated":
        return {**base, "state": "estimated", "label": "Estimated, not measured"}
    if client_connection == "disconnected" or age > stale_after_s * 3:
        return {**base, "state": "disconnected", "label": "Device disconnected or silent"}
    if age > stale_after_s:
        return {**base, "state": "stale", "label": "Delayed: last reading is old"}
    return {**base, "state": "receiving", "label": "Connected and receiving"}
