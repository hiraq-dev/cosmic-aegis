"""AEGIS API: measurements, auth, consent-controlled review, NASA context, evidence-linked assistant."""

import asyncio
import json
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from . import measurements as meas
from . import ratelimit
from .analytics import Point, trend
from .config import Settings, get_settings
from .db import Base, Database
from .models import Audit, CheckIn, Consent, Device, HealthHistory, Measurement, ReviewNote, SourceCache, User, utcnow
from .nasa import service as nasa
from .rag import Index, build_index
from .security import hash_password, make_token, read_token, verify_password

DOMAINS = {
    "cardiovascular": ["heart_rate"],
    "mental": ["mood"],
    "sleep": ["sleep_hours", "fatigue"],
    "exercise": ["exercise_minutes"],
    "space_weather": ["radiation_dose_uSv"],  # personal dose only if a dosimeter supplies it
    "cabin": ["co2_ppm", "temperature_c"],
}
CRISIS = re.compile(r"suicid|kill myself|hurt myself|self.?harm|end my life|chest pain|can'?t breathe|cannot breathe|unconscious|overdose", re.I)


class Registration(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    role: str = Field(pattern="^(crew|reviewer)$")
    display_name: str = Field(default="", max_length=80)


class Login(BaseModel):
    email: EmailStr
    password: str


class EventIn(BaseModel):
    event_id: str = Field(min_length=1, max_length=64)
    device_id: str = Field(min_length=1, max_length=64)
    metric: str = Field(pattern="^[a-z0-9_]{2,40}$")
    value: float
    unit: str = Field(max_length=16)
    observed_at: datetime | None = None
    source: str | None = Field(default=None, max_length=80)
    source_type: str = Field(default="device", pattern="^(device|manual|estimated|replay)$")
    timestamp_origin: str | None = Field(default=None, pattern="^(device|manual)$")
    quality_flags: list[str] = Field(default_factory=list, max_length=10)
    context: str | None = Field(default=None, pattern="^(rest|activity|sleep|unknown)$")
    session_id: str | None = Field(default=None, max_length=64)
    sequence: int | None = None


class Batch(BaseModel):
    events: list[EventIn] = Field(min_length=1, max_length=500)


class DeviceIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    kind: str = Field(max_length=40)
    label: str = Field(default="", max_length=80)
    with_token: bool = False


class ConnState(BaseModel):
    state: str = Field(pattern="^(connected|disconnected)$")


class CheckInIn(BaseModel):
    kind: str = Field(pattern="^(mood|sleep|exercise|note)$")
    observed_at: datetime | None = None
    payload: dict[str, Any]

    @field_validator("payload")
    @classmethod
    def small(cls, v):
        if len(json.dumps(v)) > 2000:
            raise ValueError("payload too large")
        return v


class HistoryIn(BaseModel):
    text: str = Field(max_length=4000)


class ConsentIn(BaseModel):
    reviewer_email: EmailStr
    scopes: list[str] = Field(min_length=1, max_length=20)
    expires_in_hours: int | None = Field(default=72, ge=1, le=24 * 90)


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=800)


class ConsentFlag(BaseModel):
    external_model: bool


def _aware(d: datetime | None):
    return None if d is None else meas.as_utc(d)


def create_app(settings: Settings | None = None, db: Database | None = None, http_client: httpx.AsyncClient | None = None) -> FastAPI:
    cfg = settings or get_settings()
    database = db or Database(cfg.database_url)
    Base.metadata.create_all(database.engine) if cfg.database_url.startswith("sqlite") else None  # Postgres uses Alembic migrations
    research_dirs = [Path(__file__).resolve().parents[1] / "research", Path(__file__).resolve().parents[2] / "rag_service" / "data" / "protocols"]
    state: dict[str, Any] = {"index": None, "model_check": (0.0, None), "queues": {}, "stop": asyncio.Event(), "tasks": []}

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if cfg.poll_nasa:
            state["stop"] = asyncio.Event()
            for src in nasa.INTERVALS:
                state["tasks"].append(asyncio.create_task(nasa.poll_forever(database.Session, src, cfg.nasa_api_key, state["stop"])))
        yield
        state["stop"].set()
        for t in state["tasks"]:
            t.cancel()

    app = FastAPI(title="AEGIS API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=cfg.allowed_origins, allow_methods=["*"], allow_headers=["*"], allow_credentials=False)
    app.state.cfg, app.state.db, app.state.http = cfg, database, http_client

    # ---- dependencies ------------------------------------------------------------------------------------------
    def get_db():
        with database.Session() as s:
            yield s

    DB = Annotated[Session, Depends(get_db)]

    def current_user(db: DB, authorization: Annotated[str | None, Header()] = None) -> User:
        tok = (authorization or "").removeprefix("Bearer ").strip()
        claims = read_token(cfg.jwt_secret, tok) if tok else None
        user = db.get(User, claims["sub"]) if claims else None
        if not user:
            raise HTTPException(401, "authentication required")
        return user

    U = Annotated[User, Depends(current_user)]

    def need_role(user: User, role: str):
        if user.role != role:
            raise HTTPException(403, f"{role} role required")

    def limit(db: Session, key: str, n: int, window: int):
        if not ratelimit.allow(db, key, n, window):
            raise HTTPException(429, "rate limit exceeded")

    def audit(db: Session, actor: str, action: str, subject: str | None = None, **detail):
        db.add(Audit(actor_id=actor, action=action, subject_id=subject, detail=detail))
        db.commit()

    def active_consent(db: Session, subject_id: str, reviewer_id: str) -> Consent | None:
        now = utcnow()
        for c in db.scalars(select(Consent).where(Consent.subject_id == subject_id, Consent.reviewer_id == reviewer_id, Consent.revoked_at.is_(None))):
            if c.expires_at is None or _aware(c.expires_at) > now:
                return c
        return None

    def publish(subject_id: str, payload: dict):
        for q in list(state["queues"].get(subject_id, ())):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass

    # ---- health ----------------------------------------------------------------------------------------------------
    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/ready")
    def ready(db: DB):
        checks: dict[str, Any] = {}
        try:
            db.execute(text("select 1"))
            checks["database"] = "ok"
        except Exception:  # noqa: BLE001
            checks["database"] = "unavailable"
        rows = {r.source: r for r in db.scalars(select(SourceCache))}
        checks["nasa"] = {s: nasa.describe(rows.get(s), s)["freshness"] for s in nasa.INTERVALS}
        checks["language_model"] = "configured" if cfg.anthropic_api_key else "not_configured"
        ok = checks["database"] == "ok"
        return {"status": "ready" if ok else "degraded", "checks": checks}  # a missing service is never reported as healthy

    # ---- auth ------------------------------------------------------------------------------------------------------
    @app.post("/auth/register", status_code=201)
    def register(body: Registration, db: DB, request: Request):
        limit(db, f"reg:{request.client.host if request.client else 'x'}", 10, 3600)
        if db.scalar(select(User).where(User.email == body.email.lower())):
            raise HTTPException(409, "email already registered")
        u = User(email=body.email.lower(), password_hash=hash_password(body.password), role=body.role, display_name=body.display_name)
        db.add(u)
        db.commit()
        return {"id": u.id, "role": u.role, "token": make_token(cfg.jwt_secret, u.id, u.role, cfg.jwt_minutes)}

    @app.post("/auth/login")
    def login(body: Login, db: DB, request: Request):
        limit(db, f"login:{request.client.host if request.client else 'x'}", 20, 600)
        u = db.scalar(select(User).where(User.email == body.email.lower()))
        if not u or not verify_password(body.password, u.password_hash):
            raise HTTPException(401, "invalid credentials")
        return {"id": u.id, "role": u.role, "token": make_token(cfg.jwt_secret, u.id, u.role, cfg.jwt_minutes)}

    @app.get("/me")
    def me(user: U):
        return {"id": user.id, "email": user.email, "role": user.role, "display_name": user.display_name, "external_model_consent": user.external_model_consent}

    @app.put("/me/consent/external-model")
    def set_ext(body: ConsentFlag, user: U, db: DB):
        user.external_model_consent = body.external_model
        db.merge(user)
        db.commit()
        audit(db, user.id, "external_model_consent", user.id, value=body.external_model)
        return {"external_model_consent": body.external_model}

    # ---- devices and measurements -----------------------------------------------------------------------------------
    @app.post("/devices", status_code=201)
    def add_device(body: DeviceIn, user: U, db: DB):
        need_role(user, "crew")
        d = db.get(Device, body.id)
        if d and d.owner_id != user.id:
            raise HTTPException(409, "device id belongs to another user")
        token = None
        if not d:
            d = Device(id=body.id, owner_id=user.id, kind=body.kind, label=body.label)
            if body.with_token:
                import secrets
                token = secrets.token_urlsafe(32)
                d.token_hash = hash_password(token)
            db.add(d)
            db.commit()
        return {"id": d.id, "token": token}  # the token is shown once

    @app.post("/devices/{device_id}/state")
    def device_state(device_id: str, body: ConnState, user: U, db: DB):
        d = db.get(Device, device_id)
        if not d or d.owner_id != user.id:
            raise HTTPException(404, "device not found")
        d.connection_state = body.state
        db.commit()
        publish(user.id, {"type": "connection", "device_id": device_id, "state": body.state})
        return {"ok": True}

    def _store(db: Session, subject_id: str, events: list[EventIn], default_source: str | None = None):
        raw = []
        for e in events:
            dct = e.model_dump()
            dct["source"] = dct["source"] or default_source or e.device_id
            raw.append(dct)
        res = meas.ingest(db, subject_id, raw)
        for dev in {e.device_id for e in events}:
            d = db.get(Device, dev)
            if d and d.owner_id == subject_id:
                d.last_seen_at = utcnow()
        db.commit()
        if res.stored:
            publish(subject_id, {"type": "measurements", "stored": res.stored})
        return {"stored": res.stored, "duplicates": res.duplicates, "late": res.late, "rejected": res.rejected}

    @app.post("/measurements")
    def post_measurements(body: Batch, user: U, db: DB):
        need_role(user, "crew")
        limit(db, f"meas:{user.id}", 600, 60)
        for e in body.events:  # a client may only write through devices it owns (or the manual device)
            d = db.get(Device, e.device_id)
            if d and d.owner_id != user.id:
                raise HTTPException(403, "device belongs to another user")
        return _store(db, user.id, body.events)

    @app.post("/ingest")
    def ingest_device(body: Batch, db: DB, x_device_id: Annotated[str, Header()], x_device_token: Annotated[str, Header()]):
        """Headless environmental sensors authenticate with a per-device token instead of a user session."""
        limit(db, f"ingest:{x_device_id}", 600, 60)
        d = db.get(Device, x_device_id)
        if not d or not d.token_hash or not verify_password(x_device_token, d.token_hash):
            raise HTTPException(401, "invalid device credentials")
        for e in body.events:
            if e.device_id != d.id:
                raise HTTPException(403, "event device_id does not match credentials")
        d.connection_state = "connected"
        return _store(db, d.owner_id, body.events, default_source=d.label or d.kind)

    @app.get("/measurements")
    def get_measurements(user: U, db: DB, metric: str, since_hours: int = Query(24, ge=1, le=24 * 365), subject_id: str | None = None, context: str | None = None):
        sid = _resolve_subject(db, user, subject_id, metric)
        rows = meas.series(db, sid, metric, utcnow() - timedelta(hours=since_hours))
        if context:
            rows = [r for r in rows if r.context == context]
        return [{"event_id": r.event_id, "device_id": r.device_id, "value": r.value, "unit": r.unit, "observed_at": meas.as_utc(r.observed_at).isoformat(),
                 "received_at": meas.as_utc(r.received_at).isoformat(), "source": r.source, "source_type": r.source_type,
                 "timestamp_origin": r.timestamp_origin, "quality_flags": r.quality_flags, "context": r.context, "session_id": r.session_id, "sequence": r.sequence} for r in rows]

    def _resolve_subject(db: Session, user: User, subject_id: str | None, scope: str) -> str:
        if not subject_id or subject_id == user.id:
            return user.id
        if user.role != "reviewer":
            raise HTTPException(403, "not permitted")
        c = active_consent(db, subject_id, user.id)
        if not c or (scope not in c.scopes and "all" not in c.scopes):
            raise HTTPException(403, "no active consent for this data")
        audit(db, user.id, "review_read", subject_id, scope=scope)
        return subject_id

    @app.get("/cards")
    def cards(user: U, db: DB):
        need_role(user, "crew")
        now = utcnow()
        devs = {d.id: d for d in db.scalars(select(Device).where(Device.owner_id == user.id))}
        out: dict[str, Any] = {}
        for domain, metrics in DOMAINS.items():
            out[domain] = {}
            for m in metrics:
                latest = db.scalar(select(Measurement).where(Measurement.subject_id == user.id, Measurement.metric == m).order_by(Measurement.observed_at.desc()).limit(1))
                conn = devs[latest.device_id].connection_state if latest and latest.device_id in devs else None
                if latest is None:
                    conn = "connected" if any(d.connection_state == "connected" and (d.kind == "ble_heart_rate") == (m == "heart_rate") and m == "heart_rate" for d in devs.values()) else None
                st = meas.card_state(latest, now=now, stale_after_s=cfg.stale_seconds.get(m, cfg.default_stale_seconds), client_connection=conn)
                if latest is not None:
                    st["value"], st["unit"], st["quality_flags"] = latest.value, latest.unit, latest.quality_flags
                out[domain][m] = st
        return out

    @app.get("/analytics/trend")
    def analytics_trend(user: U, db: DB, metric: str, context: str | None = None, days: int = Query(30, ge=1, le=365)):
        rows = meas.series(db, user.id, metric, utcnow() - timedelta(days=days))
        if context:
            rows = [r for r in rows if r.context == context]
        floors = {"heart_rate": 3.0, "co2_ppm": 50.0, "temperature_c": 0.3}
        return trend([Point(meas.as_utc(r.observed_at).timestamp(), r.value) for r in rows], sd_floor=floors.get(metric, 0.0))

    @app.get("/stream")
    async def stream(user: U, request: Request):
        """Server-sent events. The client authenticates with a bearer header (fetch-based EventSource)."""
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        state["queues"].setdefault(user.id, set()).add(q)

        async def gen():
            try:
                yield "event: hello\ndata: {}\n\n"
                while True:
                    if await request.is_disconnected():
                        break
                    try:
                        item = await asyncio.wait_for(q.get(), timeout=15)
                        yield f"data: {json.dumps(item)}\n\n"
                    except asyncio.TimeoutError:
                        yield ": keepalive\n\n"
            finally:
                state["queues"].get(user.id, set()).discard(q)

        return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-store"})

    # ---- check-ins, history, data rights ---------------------------------------------------------------------------------
    @app.post("/checkins", status_code=201)
    def add_checkin(body: CheckInIn, user: U, db: DB):
        need_role(user, "crew")
        row = CheckIn(subject_id=user.id, observed_at=meas.as_utc(body.observed_at or utcnow()), kind=body.kind, payload=body.payload)
        db.add(row)
        db.commit()
        return {"id": row.id}  # several per day are kept; nothing is overwritten

    @app.get("/checkins")
    def list_checkins(user: U, db: DB, subject_id: str | None = None):
        sid = _resolve_subject(db, user, subject_id, "checkins")
        rows = db.scalars(select(CheckIn).where(CheckIn.subject_id == sid).order_by(CheckIn.observed_at.desc()).limit(500))
        return [{"id": r.id, "kind": r.kind, "observed_at": meas.as_utc(r.observed_at).isoformat(), "payload": r.payload} for r in rows]

    @app.put("/me/history")
    def put_history(body: HistoryIn, user: U, db: DB):
        need_role(user, "crew")
        db.merge(HealthHistory(subject_id=user.id, text=body.text, updated_at=utcnow()))
        db.commit()
        return {"ok": True}

    @app.get("/me/history")
    def get_history(user: U, db: DB):
        h = db.get(HealthHistory, user.id)
        return {"text": h.text if h else ""}  # a fresh account is empty: nothing is pre-filled

    @app.get("/me/export")
    def export(user: U, db: DB):
        m = db.scalars(select(Measurement).where(Measurement.subject_id == user.id))
        c = db.scalars(select(CheckIn).where(CheckIn.subject_id == user.id))
        audit(db, user.id, "export", user.id)
        return {"measurements": [{"metric": r.metric, "value": r.value, "unit": r.unit, "observed_at": meas.as_utc(r.observed_at).isoformat(), "source": r.source} for r in m],
                "checkins": [{"kind": r.kind, "observed_at": meas.as_utc(r.observed_at).isoformat(), "payload": r.payload} for r in c]}

    @app.delete("/me/data")
    def erase(user: U, db: DB):
        """Erasure request: removes this subject's stored readings, check-ins, history and notes. Audited."""
        for model in (Measurement, CheckIn, HealthHistory, ReviewNote):
            db.execute(delete(model).where(model.subject_id == user.id))
        db.commit()
        audit(db, user.id, "erase_data", user.id)
        return {"erased": True}

    # ---- consent and review --------------------------------------------------------------------------------------------
    @app.post("/consents", status_code=201)
    def grant(body: ConsentIn, user: U, db: DB):
        need_role(user, "crew")
        rev = db.scalar(select(User).where(User.email == body.reviewer_email.lower(), User.role == "reviewer"))
        if not rev:
            raise HTTPException(404, "reviewer not found")
        c = Consent(subject_id=user.id, reviewer_id=rev.id, scopes=body.scopes, expires_at=(utcnow() + timedelta(hours=body.expires_in_hours)) if body.expires_in_hours else None)
        db.add(c)
        db.commit()
        audit(db, user.id, "consent_granted", user.id, reviewer=rev.id, scopes=body.scopes)
        return {"id": c.id}

    @app.get("/consents")
    def list_consents(user: U, db: DB):
        need_role(user, "crew")
        return [{"id": c.id, "reviewer_id": c.reviewer_id, "scopes": c.scopes, "expires_at": c.expires_at.isoformat() if c.expires_at else None, "revoked": c.revoked_at is not None}
                for c in db.scalars(select(Consent).where(Consent.subject_id == user.id))]

    @app.delete("/consents/{cid}")
    def revoke(cid: str, user: U, db: DB):
        c = db.get(Consent, cid)
        if not c or c.subject_id != user.id:
            raise HTTPException(404, "not found")
        c.revoked_at = utcnow()
        db.commit()
        audit(db, user.id, "consent_revoked", user.id, consent=cid)
        return {"revoked": True}

    @app.get("/review/cases")
    def cases(user: U, db: DB):
        need_role(user, "reviewer")
        out = []
        for c in db.scalars(select(Consent).where(Consent.reviewer_id == user.id, Consent.revoked_at.is_(None))):
            if active_consent(db, c.subject_id, user.id):
                s = db.get(User, c.subject_id)
                out.append({"subject_id": c.subject_id, "display_name": s.display_name if s else "", "scopes": c.scopes, "expires_at": c.expires_at.isoformat() if c.expires_at else None})
        return out

    @app.get("/review/cases/{subject_id}/history")
    def case_history(subject_id: str, user: U, db: DB):
        need_role(user, "reviewer")
        c = active_consent(db, subject_id, user.id)
        if not c or ("history" not in c.scopes and "all" not in c.scopes):
            raise HTTPException(403, "no active consent for history")
        audit(db, user.id, "review_read", subject_id, scope="history")
        h = db.get(HealthHistory, subject_id)
        return {"text": h.text if h else ""}

    @app.post("/review/cases/{subject_id}/notes", status_code=201)
    def add_note(subject_id: str, body: NoteIn, user: U, db: DB):
        need_role(user, "reviewer")
        if not active_consent(db, subject_id, user.id):
            raise HTTPException(403, "no active consent")
        n = ReviewNote(subject_id=subject_id, reviewer_id=user.id, body=body.body)
        db.add(n)
        db.commit()
        audit(db, user.id, "review_note", subject_id)
        return {"id": n.id, "sent_at": meas.as_utc(n.sent_at).isoformat(), "status": "sent"}  # not "delivered" until the subject's client fetches it

    @app.get("/notes")
    def my_notes(user: U, db: DB):
        need_role(user, "crew")
        now, out = utcnow(), []
        for n in db.scalars(select(ReviewNote).where(ReviewNote.subject_id == user.id).order_by(ReviewNote.sent_at.desc())):
            if n.delivered_at is None:
                n.delivered_at = now
            out.append({"id": n.id, "body": n.body, "sent_at": meas.as_utc(n.sent_at).isoformat(), "delivered_at": meas.as_utc(n.delivered_at).isoformat(),
                        "acknowledged_at": meas.as_utc(n.acknowledged_at).isoformat() if n.acknowledged_at else None})
        db.commit()
        return out

    @app.post("/notes/{nid}/ack")
    def ack(nid: str, user: U, db: DB):
        n = db.get(ReviewNote, nid)
        if not n or n.subject_id != user.id:
            raise HTTPException(404, "not found")
        n.acknowledged_at = utcnow()
        db.commit()
        audit(db, user.id, "note_ack", user.id, note=nid)
        return {"acknowledged": True}

    # ---- NASA context -----------------------------------------------------------------------------------------------------
    @app.get("/context/nasa")
    def context(db: DB):
        rows = {r.source: r for r in db.scalars(select(SourceCache))}
        return {s: nasa.describe(rows.get(s), s) for s in nasa.INTERVALS}

    # ---- assistant --------------------------------------------------------------------------------------------------------
    def get_index() -> Index:
        if state["index"] is None:
            state["index"] = build_index(research_dirs)
        return state["index"]

    async def model_available() -> bool | None:
        if not cfg.anthropic_api_key:
            return None
        ts, val = state["model_check"]
        if time.time() - ts < 600 and val is not None:
            return val
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get(f"https://api.anthropic.com/v1/models/{cfg.anthropic_model}", headers={"x-api-key": cfg.anthropic_api_key, "anthropic-version": "2023-06-01"})
            val = r.status_code == 200
        except httpx.HTTPError:
            val = False
        state["model_check"] = (time.time(), val)
        return val

    @app.get("/assistant/status")
    async def assistant_status(user: U):
        avail = await model_available()
        return {"mode": "language_model" if (avail and user.external_model_consent) else "retrieval_only", "model": cfg.anthropic_model if cfg.anthropic_api_key else None,
                "model_available": avail, "external_model_consent": user.external_model_consent, "research_passages": len(get_index().passages)}

    def build_context(db: Session, user: User):
        now = utcnow()
        observed, missing = [], []
        for m in ("heart_rate", "co2_ppm", "temperature_c"):
            last = db.scalar(select(Measurement).where(Measurement.subject_id == user.id, Measurement.metric == m).order_by(Measurement.observed_at.desc()).limit(1))
            if last is None:
                missing.append(m)
                continue
            st = meas.card_state(last, now=now, stale_after_s=cfg.stale_seconds.get(m, cfg.default_stale_seconds))
            observed.append({"metric": m, "value": last.value, "unit": last.unit, "age_s": st["age_s"], "state": st["state"], "source_type": last.source_type})
        statements = [{"kind": c.kind, "payload": c.payload, "observed_at": meas.as_utc(c.observed_at).isoformat()} for c in db.scalars(select(CheckIn).where(CheckIn.subject_id == user.id).order_by(CheckIn.observed_at.desc()).limit(5))]
        if not statements:
            missing.append("check-ins")
        hr = meas.series(db, user.id, "heart_rate", now - timedelta(days=30))
        est = trend([Point(meas.as_utc(r.observed_at).timestamp(), r.value) for r in hr if r.context == "rest"], sd_floor=3.0)
        return observed, statements, ({"heart_rate_resting_trend": est} if est["status"] == "ok" else {}), missing

    @app.post("/assistant/chat")
    async def chat(body: ChatIn, user: U, db: DB):
        limit(db, f"chat:{user.id}", 30, 3600)
        idx = get_index()
        hits = idx.search(body.message, 4)
        passages = [{"ref": f"R{i + 1}", "id": p.id, "document": p.doc, "page": p.page, "text": p.text[:700], "score": round(s, 2)} for i, (p, s) in enumerate(hits)]
        if CRISIS.search(body.message):
            audit(db, user.id, "concern_flag", user.id)  # no message text is stored
            return {"mode": "safety_notice", "ai_generated": False, "text": "This may be urgent. Please contact your crew medical officer or the mission emergency channel now, or alert a crew-mate next to you. On Earth, call your local emergency number. This is a fixed safety notice, not an AI answer, and AEGIS has flagged that you asked for help for your reviewers if you have shared your case.", "citations": []}
        observed, statements, estimates, missing = build_context(db, user)
        avail = await model_available()
        base = {"sections": {"observed_measurements": observed, "user_statements": statements, "model_estimates": estimates, "retrieved_research": [{"ref": p["ref"], "document": p["document"], "page": p["page"]} for p in passages], "missing_information": missing}}
        if not cfg.anthropic_api_key or avail is False:
            return {**base, "mode": "retrieval_only", "ai_generated": False, "reason": "language model not configured" if not cfg.anthropic_api_key else "configured model is unavailable", "text": "No language model is answering. Here are the most relevant passages from the curated research set, shown as retrieved.", "citations": passages}
        if not user.external_model_consent:
            return {**base, "mode": "retrieval_only", "ai_generated": False, "reason": "consent to send data to an external language model has not been given", "text": "You have not allowed sending your health context to an external language model, so only research passages are shown.", "citations": passages}
        prompt = json.dumps({"observed_measurements": observed, "user_statements": statements, "model_estimates_heuristic": estimates, "missing_information": missing,
                             "retrieved_research": [{"ref": p["ref"], "document": p["document"], "page": p["page"], "text": p["text"]} for p in passages]})
        system = ("You are the AEGIS assistant. Answer the user's question using ONLY the supplied JSON. Keep four things separate and name them: Observed (device measurements, with their age and whether they are stale), "
                  "Stated by you (user statements), Estimated (heuristic trends, not predictions), Research (cite as [R1] etc.; research reports are literature, not treatment protocols). List what is missing. "
                  "Never diagnose, never prescribe, never give percentages of confidence. If something is concerning, advise contacting the crew medical officer. Under 180 words.")
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post("https://api.anthropic.com/v1/messages", headers={"x-api-key": cfg.anthropic_api_key, "anthropic-version": "2023-06-01"},
                                 json={"model": cfg.anthropic_model, "max_tokens": 500, "system": system, "messages": [{"role": "user", "content": f"CONTEXT_JSON:\n{prompt}\n\nQUESTION: {body.message}"}]})
            if r.status_code != 200:
                return {**base, "mode": "error", "ai_generated": False, "reason": f"language model returned status {r.status_code}", "text": "The language model could not answer. No substitute answer was generated.", "citations": passages}
            txt = "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text").strip()
        except httpx.HTTPError:
            return {**base, "mode": "error", "ai_generated": False, "reason": "language model unreachable", "text": "The language model could not be reached. No substitute answer was generated.", "citations": passages}
        cited = [p for p in passages if f"[{p['ref']}]" in txt]
        return {**base, "mode": "language_model", "ai_generated": True, "model": cfg.anthropic_model, "text": txt, "citations": cited}

    return app
