"""Server configuration, read from environment variables only. No secrets in code."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _flag(name: str, default: str = "1") -> bool:
    return os.environ.get(name, default).lower() in ("1", "true", "yes", "on")


@dataclass
class Settings:
    env: str = field(default_factory=lambda: os.environ.get("AEGIS_ENV", "development"))
    database_url: str = field(default_factory=lambda: os.environ.get("DATABASE_URL", "sqlite:///./aegis.db"))
    jwt_secret: str = field(default_factory=lambda: os.environ.get("JWT_SECRET", ""))
    jwt_minutes: int = field(default_factory=lambda: int(os.environ.get("JWT_MINUTES", "720")))
    allowed_origins: list[str] = field(default_factory=lambda: [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()])
    nasa_api_key: str = field(default_factory=lambda: os.environ.get("NASA_API_KEY", ""))
    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    anthropic_model: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_MODEL", "claude-haiku-5-5"))
    poll_nasa: bool = field(default_factory=lambda: _flag("POLL_NASA", "1"))
    # A reading older than this is "stale"; older than 3x this the device counts as "disconnected".
    stale_seconds: dict[str, int] = field(default_factory=lambda: {"heart_rate": 15, "co2_ppm": 120, "temperature_c": 120})
    default_stale_seconds: int = 300

    def validate(self) -> None:
        if self.env == "production" and (len(self.jwt_secret) < 32 or self.jwt_secret.startswith("change-me")):
            raise RuntimeError("JWT_SECRET must be a random string of at least 32 characters in production")
        if not self.jwt_secret:
            # development convenience only; never used when env == production
            self.jwt_secret = "dev-only-secret-not-for-production-use-0123456789"


def get_settings() -> Settings:
    s = Settings()
    s.validate()
    return s
