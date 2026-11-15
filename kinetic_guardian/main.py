"""Kinetic Guardian: pose -> joint angles -> reps -> fatigue / form alerts.

Runs a background worker over `video_source` (file path or camera index), loops the file.
Endpoints: /health, /status, /frame.jpg (annotated), /reset
"""
import os
import threading
import time

import cv2
from fastapi import Response

from analysis import AlertDebouncer, RepAnalyzer, side_metrics
from common import load_config, make_app

cfg = load_config()
app = make_app("kinetic_guardian")

state = {"summary": {"reps": 0, "fatigue_score": 0.0, "form_ok": True}, "alert": False,
         "person_detected": False, "fps": 0.0, "provider": None, "error": None}
latest_jpg = None
lock = threading.Lock()
analyzer = RepAnalyzer(window=cfg["form_analysis"]["fatigue_window_reps"],
                       degradation_threshold=cfg["form_analysis"]["form_degradation_threshold"])
debounce = AlertDebouncer(cfg["security"]["min_consecutive_frames_for_alert"])


def worker():
    global latest_jpg
    from pose import PoseEstimator, draw
    m = cfg["model"]
    if not os.path.exists(m["path"]):
        state["error"] = f"model not found: {m['path']} (run scripts/export_pose_model.py)"
        return
    try:
        est = PoseEstimator(m["path"], m["providers"], m["input_size"], m["conf_threshold"])
    except Exception as e:  # corrupted model must not crash the container
        state["error"] = f"model load failed: {e}"
        return
    state["provider"] = est.provider
    src = cfg["video_source"]
    cap = cv2.VideoCapture(int(src) if str(src).isdigit() else src)
    t0, n = time.time(), 0
    while True:
        ok, frame = cap.read()
        if not ok:
            if str(src).isdigit():
                time.sleep(0.5)
            else:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                analyzer.reset()
            continue
        try:
            res = est(frame)
        except Exception as e:
            state["error"] = f"inference failed: {e}"
            time.sleep(0.2)
            continue
        text = "no person"
        with lock:
            state["person_detected"] = res is not None
            if res is not None:
                kp, conf, _ = res
                met = side_metrics(kp, conf)
                if met:
                    analyzer.update(*met)
                    s = analyzer.summary()
                    state["summary"] = s
                    state["alert"] = debounce.push(not s["form_ok"])
                    text = f"reps {s['reps']}  fatigue {s['fatigue_score']:.2f}"
                frame = draw(frame, kp, conf, text)
            n += 1
            state["fps"] = round(n / (time.time() - t0), 1)
            latest_jpg = cv2.imencode(".jpg", frame)[1].tobytes()


threading.Thread(target=worker, daemon=True).start()


@app.get("/status")
def status():
    with lock:
        return dict(state)


@app.get("/frame.jpg")
def frame():
    return Response(content=latest_jpg or b"", media_type="image/jpeg",
                    status_code=200 if latest_jpg else 204)


@app.post("/reset")
def reset():
    with lock:
        analyzer.reset()
    return {"ok": True}
