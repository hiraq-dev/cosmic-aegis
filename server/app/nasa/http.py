"""Resilient upstream HTTP: timeout, backoff with jitter, and explicit 429 handling."""
from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass

import httpx


class UpstreamError(Exception):
    def __init__(self, kind: str, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.kind = kind  # "rate_limited" | "http" | "timeout" | "schema" | "network"
        self.retry_after = retry_after


@dataclass
class RetryPolicy:
    attempts: int = 3
    base: float = 0.5
    cap: float = 8.0
    timeout: float = 15.0


def backoff_delay(attempt: int, policy: RetryPolicy, rng: random.Random | None = None) -> float:
    """Full jitter: uniform(0, min(cap, base * 2**attempt))."""
    r = rng or random
    return r.uniform(0, min(policy.cap, policy.base * (2 ** attempt)))


async def get_json(client: httpx.AsyncClient, url: str, params: dict | None = None, policy: RetryPolicy | None = None, sleep=asyncio.sleep):
    """GET and decode JSON. Cancelling the awaiting task cancels the request. Returns (json, response)."""
    policy = policy or RetryPolicy()
    last: UpstreamError | None = None
    for attempt in range(policy.attempts):
        try:
            r = await client.get(url, params=params, timeout=policy.timeout)
        except httpx.TimeoutException:
            last = UpstreamError("timeout", f"timeout contacting {httpx.URL(url).host}")
        except httpx.HTTPError as e:
            last = UpstreamError("network", f"network error: {type(e).__name__}")
        else:
            if r.status_code == 429:
                # A rate limit is not retried inside the request. The poller backs off for Retry-After.
                ra = r.headers.get("retry-after")
                raise UpstreamError("rate_limited", "upstream rate limit (429)", int(ra) if ra and ra.isdigit() else 3600)
            if r.status_code >= 500:
                last = UpstreamError("http", f"upstream status {r.status_code}")
            elif r.status_code >= 400:
                raise UpstreamError("http", f"upstream status {r.status_code}")
            else:
                try:
                    return r.json(), r
                except ValueError:
                    raise UpstreamError("schema", "response was not JSON")
        if attempt < policy.attempts - 1:
            await sleep(backoff_delay(attempt, policy))
    assert last is not None
    raise last
