from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode()[:72], hashed.encode())
    except ValueError:
        return False


def make_token(secret: str, user_id: str, role: str, minutes: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "role": role, "iat": now, "exp": now + timedelta(minutes=minutes)}, secret, algorithm="HS256")


def read_token(secret: str, token: str) -> dict | None:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
