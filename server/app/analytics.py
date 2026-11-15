"""Time-aware, transparent trend statistics. These are heuristics, not a trained or validated predictive model.

* x is real elapsed time (days), so irregular sampling is handled correctly.
* Resting and activity readings are analysed separately by the caller (context filter).
* A trend is only reported when baseline coverage requirements are met; otherwise the answer is "insufficient data".
"""
from __future__ import annotations

import math
from dataclasses import dataclass

MIN_POINTS = 8
MIN_SPAN_DAYS = 3.0
BASELINE_FRACTION = 0.6  # earliest part of the time span defines the personal baseline


@dataclass
class Point:
    t: float  # seconds since epoch
    v: float


def _mean(a):
    return sum(a) / len(a)


def _sd(a):
    if len(a) < 2:
        return 0.0
    m = _mean(a)
    return math.sqrt(sum((x - m) ** 2 for x in a) / (len(a) - 1))


def ols_time(points: list[Point]) -> tuple[float, float, float]:
    """Least squares of value on elapsed days. Returns (slope_per_day, intercept_at_first_point, r2)."""
    t0 = points[0].t
    xs = [(p.t - t0) / 86400.0 for p in points]
    ys = [p.v for p in points]
    mx, my = _mean(xs), _mean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0:
        return 0.0, my, 0.0
    slope = sxy / sxx
    return slope, my - slope * mx, (sxy * sxy) / (sxx * syy) if syy else 0.0


def trend(points: list[Point], sd_floor: float = 0.0, horizon_days: float = 3.0) -> dict:
    pts = sorted(points, key=lambda p: p.t)
    n = len(pts)
    span = (pts[-1].t - pts[0].t) / 86400.0 if n > 1 else 0.0
    coverage = {"n": n, "span_days": round(span, 2), "min_points": MIN_POINTS, "min_span_days": MIN_SPAN_DAYS}
    if n < MIN_POINTS or span < MIN_SPAN_DAYS:
        return {"status": "insufficient_data", "coverage": coverage, "heuristic": True,
                "message": f"Needs at least {MIN_POINTS} readings across {MIN_SPAN_DAYS:g} days; have {n} across {span:.1f}."}
    cut = pts[0].t + (pts[-1].t - pts[0].t) * BASELINE_FRACTION
    base = [p.v for p in pts if p.t <= cut]
    later = [p for p in pts if p.t > cut]
    if len(base) < 4 or not later:
        return {"status": "insufficient_data", "coverage": coverage, "heuristic": True, "message": "Baseline period has too few readings."}
    b_mean, b_sd = _mean(base), max(_sd(base), sd_floor, 1e-9)
    slope, intercept, r2 = ols_time(pts)
    last = pts[-1]
    t_last = (last.t - pts[0].t) / 86400.0
    return {
        "status": "ok", "heuristic": True, "coverage": coverage,
        "baseline": {"mean": round(b_mean, 3), "sd": round(b_sd, 3), "n": len(base)},
        "latest": {"value": last.v, "z_vs_baseline": round((last.v - b_mean) / b_sd, 2)},
        "trend": {"slope_per_day": round(slope, 4), "r2": round(r2, 3)},
        "projection": {"days_ahead": horizon_days, "value": round(intercept + slope * (t_last + horizon_days), 2), "note": "Linear extrapolation of recent behaviour, not a prediction of health outcomes."},
        "message": "Descriptive statistics only. Correlation is not causation.",
    }
