import math

import numpy as np

from analysis import AlertDebouncer, RepAnalyzer, angle, side_metrics


def test_angle():
    assert abs(angle((1, 0), (0, 0), (0, 1)) - 90) < 1e-6
    assert abs(angle((1, 0), (0, 0), (-1, 0)) - 180) < 1e-6


def test_side_metrics_straight_leg():
    kp = np.zeros((17, 2)); conf = np.ones(17)
    kp[5] = kp[6] = (0, 0); kp[11] = kp[12] = (0, 100)
    kp[13] = kp[14] = (0, 200); kp[15] = kp[16] = (0, 300)
    knee, lean = side_metrics(kp, conf)
    assert abs(knee - 180) < 1e-6 and lean < 1e-6


def feed(an, depth, lean):
    for k in list(np.linspace(170, depth, 10)) + list(np.linspace(depth, 170, 10)):
        an.update(k, lean)


def test_reps_and_fatigue():
    an = RepAnalyzer()
    for _ in range(3):
        feed(an, 80, 15)
    assert len(an.reps) == 3 and an.fatigue() == 0.0
    for _ in range(5):
        feed(an, 105, 35)          # shallower + more forward lean
    assert len(an.reps) == 8
    assert an.fatigue() > 0.5 and not an.summary()["form_ok"]


def test_good_form_stays_ok():
    an = RepAnalyzer()
    for _ in range(8):
        feed(an, 80, 15)
    assert an.summary()["form_ok"]


def test_debounce_rejects_single_frame_glitch():
    d = AlertDebouncer(5)
    assert not any(d.push(f) for f in [True, True, False, True, True])
    assert [d.push(True) for _ in range(5)][-1] is True
