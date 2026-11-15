"""Biomechanics: joint angles, rep counting, form-degradation / fatigue score.

Pure numpy (no cv2/onnx) so it is unit-testable anywhere.
COCO-17 keypoint indices are used (YOLOv8-pose layout).
"""
from collections import deque

import numpy as np

# COCO keypoint indices
L_SHOULDER, R_SHOULDER = 5, 6
L_HIP, R_HIP = 11, 12
L_KNEE, R_KNEE = 13, 14
L_ANKLE, R_ANKLE = 15, 16


def angle(a, b, c):
    """Angle ABC in degrees at vertex b. Points are (x, y)."""
    a, b, c = (np.asarray(p, dtype=float) for p in (a, b, c))
    v1, v2 = a - b, c - b
    n = np.linalg.norm(v1) * np.linalg.norm(v2)
    if n < 1e-9:
        return float("nan")
    return float(np.degrees(np.arccos(np.clip(np.dot(v1, v2) / n, -1.0, 1.0))))


def side_metrics(kp, conf, min_conf=0.4):
    """Return (knee_angle, trunk_lean) averaged over visible sides, or None.

    kp: (17, 2) xy, conf: (17,) keypoint confidences.
    trunk_lean: angle of hip->shoulder line from vertical (0 = upright).
    """
    knees, leans = [], []
    for s, h, k, a in ((L_SHOULDER, L_HIP, L_KNEE, L_ANKLE), (R_SHOULDER, R_HIP, R_KNEE, R_ANKLE)):
        if min(conf[h], conf[k], conf[a]) >= min_conf:
            knees.append(angle(kp[h], kp[k], kp[a]))
        if min(conf[s], conf[h]) >= min_conf:
            v = kp[s] - kp[h]
            leans.append(float(np.degrees(np.arctan2(abs(v[0]), abs(v[1]) + 1e-9))))
    if not knees or not leans:
        return None
    return float(np.nanmean(knees)), float(np.nanmean(leans))


class RepAnalyzer:
    """Counts reps via knee-angle hysteresis and scores form degradation.

    Baseline = first `baseline_reps` reps (depth = min knee angle, lean = max trunk lean).
    fatigue_score in [0, 1]: normalised drift of the last `window` reps from baseline.
    """

    def __init__(self, down_thresh=110.0, up_thresh=160.0, baseline_reps=3,
                 window=5, degradation_threshold=0.25):
        self.down, self.up = down_thresh, up_thresh
        self.baseline_reps, self.window = baseline_reps, window
        self.threshold = degradation_threshold
        self.reset()

    def reset(self):
        self.state = "up"
        self.reps = []                  # list of dicts: depth, lean
        self._min_knee = 999.0
        self._max_lean = 0.0
        self.last = None

    def update(self, knee, lean):
        self.last = {"knee_angle": knee, "trunk_lean": lean}
        if self.state == "up" and knee < self.down:
            self.state = "down"
        if self.state == "down":
            self._min_knee = min(self._min_knee, knee)
            self._max_lean = max(self._max_lean, lean)
            if knee > self.up:                      # rep completed
                self.reps.append({"depth": self._min_knee, "lean": self._max_lean})
                self._min_knee, self._max_lean = 999.0, 0.0
                self.state = "up"
                return True
        return False

    def fatigue(self):
        n = len(self.reps)
        if n <= self.baseline_reps:
            return 0.0
        base = self.reps[: self.baseline_reps]
        recent = self.reps[-self.window:]
        b_depth = np.mean([r["depth"] for r in base])
        b_lean = np.mean([r["lean"] for r in base])
        r_depth = np.mean([r["depth"] for r in recent])
        r_lean = np.mean([r["lean"] for r in recent])
        # shallower depth (angle goes UP) and more forward lean => worse form
        depth_drift = max(0.0, (r_depth - b_depth) / max(b_depth, 1.0))
        lean_drift = max(0.0, (r_lean - b_lean) / max(b_lean, 10.0))
        return float(min(1.0, (depth_drift + lean_drift) / 2 / self.threshold * 0.5))

    def summary(self):
        f = self.fatigue()
        return {
            "reps": len(self.reps),
            "state": self.state,
            "fatigue_score": round(f, 3),
            "form_ok": f < 0.5,
            "last": self.last,
        }


class AlertDebouncer:
    """Adversarial/sensor-noise defence: alert only if the condition holds for N consecutive frames."""

    def __init__(self, n):
        self.n, self.buf = n, deque(maxlen=n)

    def push(self, flag):
        self.buf.append(bool(flag))
        return len(self.buf) == self.n and all(self.buf)
