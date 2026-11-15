"""Database schema. Measurements are append-only: rows are never updated or deleted by normal operation
(a subject can request erasure, which is a separate audited operation)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def uid() -> str:
    return uuid.uuid4().hex


class TZ(DateTime):
    """Timezone-aware datetime; SQLite drops tzinfo so values are normalised to UTC on read in code."""
    def __init__(self):
        super().__init__(timezone=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(16))  # "crew" | "reviewer"
    display_name: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[datetime] = mapped_column(TZ(), default=utcnow)
    external_model_consent: Mapped[bool] = mapped_column(Boolean, default=False)


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))  # e.g. "ble_heart_rate", "env_sensor"
    label: Mapped[str] = mapped_column(String(80), default="")
    token_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)  # for headless device ingestion
    created_at: Mapped[datetime] = mapped_column(TZ(), default=utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(TZ(), nullable=True)
    connection_state: Mapped[str] = mapped_column(String(16), default="unknown")  # client-reported


class Measurement(Base):
    __tablename__ = "measurements"
    pk: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(64))
    subject_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    device_id: Mapped[str] = mapped_column(String(64))
    metric: Mapped[str] = mapped_column(String(40))
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(16))
    observed_at: Mapped[datetime] = mapped_column(TZ())
    received_at: Mapped[datetime] = mapped_column(TZ(), default=utcnow)
    source: Mapped[str] = mapped_column(String(80))
    source_type: Mapped[str] = mapped_column(String(16))  # device | manual | estimated | replay
    timestamp_origin: Mapped[str] = mapped_column(String(16))  # device | receive_time_proxy | manual
    quality_flags: Mapped[list] = mapped_column(JSON, default=list)
    context: Mapped[str | None] = mapped_column(String(32), nullable=True)  # rest | activity | sleep | unknown
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    __table_args__ = (
        UniqueConstraint("subject_id", "device_id", "event_id", name="uq_measurement_event"),
        Index("ix_measurement_series", "subject_id", "metric", "observed_at"),
    )


class CheckIn(Base):
    """Subject-entered observations (mood, sleep, fatigue, stress). Multiple per day are allowed."""
    __tablename__ = "checkins"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    subject_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    observed_at: Mapped[datetime] = mapped_column(TZ())
    received_at: Mapped[datetime] = mapped_column(TZ(), default=utcnow)
    kind: Mapped[str] = mapped_column(String(16))  # mood | sleep | exercise | note
    payload: Mapped[dict] = mapped_column(JSON)


class HealthHistory(Base):
    """Voluntary history, stored only as reviewer context. Never turned into probabilities."""
    __tablename__ = "health_history"
    subject_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    text: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(TZ(), default=utcnow)


class Consent(Base):
    __tablename__ = "consents"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    subject_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scopes: Mapped[list] = mapped_column(JSON)  # metric names, "checkins", "history"
    granted_at: Mapped[datetime] = mapped_column(TZ(), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(TZ(), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(TZ(), nullable=True)


class ReviewNote(Base):
    __tablename__ = "review_notes"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    subject_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(TZ(), default=utcnow)  # when the reviewer sent it
    delivered_at: Mapped[datetime | None] = mapped_column(TZ(), nullable=True)  # when the subject's client fetched it
    acknowledged_at: Mapped[datetime | None] = mapped_column(TZ(), nullable=True)


class Audit(Base):
    __tablename__ = "audit"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    at: Mapped[datetime] = mapped_column(TZ(), default=utcnow)
    actor_id: Mapped[str] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(String(40))
    subject_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)  # never contains readings


class RateLimit(Base):
    __tablename__ = "rate_limits"
    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    window_start: Mapped[int] = mapped_column(Integer, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)


class SourceCache(Base):
    """Shared cache of upstream NASA/NOAA data with separate observation, issue, retrieval and success times."""
    __tablename__ = "source_cache"
    source: Mapped[str] = mapped_column(String(40), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    observed_at: Mapped[datetime | None] = mapped_column(TZ(), nullable=True)  # when the phenomenon was observed
    issued_at: Mapped[datetime | None] = mapped_column(TZ(), nullable=True)  # when the provider issued the record
    retrieved_at: Mapped[datetime | None] = mapped_column(TZ(), nullable=True)  # last attempt
    last_success_at: Mapped[datetime | None] = mapped_column(TZ(), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="never")  # ok | error | rate_limited | never
    error: Mapped[str | None] = mapped_column(String(200), nullable=True)
    retry_after_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
