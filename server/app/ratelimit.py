"""Persistent fixed-window rate limiter backed by the database (survives restarts, shared by workers)."""
from __future__ import annotations

import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import RateLimit


def allow(db: Session, key: str, limit: int, window_s: int) -> bool:
    window = int(time.time() // window_s) * window_s
    row = db.scalar(select(RateLimit).where(RateLimit.key == key, RateLimit.window_start == window))
    if row is None:
        db.add(RateLimit(key=key, window_start=window, count=1))
        db.commit()
        return True
    if row.count >= limit:
        return False
    row.count += 1
    db.commit()
    return True
