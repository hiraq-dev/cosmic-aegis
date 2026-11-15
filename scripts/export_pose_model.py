"""Export YOLOv8n-pose to ONNX into ./models (run on a dev machine with internet).

    pip install ultralytics
    python scripts/export_pose_model.py
Optional TensorRT engine (NVIDIA GPU):  trtexec --onnx=models/yolo_pose.onnx --saveEngine=models/yolo_pose.engine --fp16
"""
import os
import shutil

from ultralytics import YOLO

path = YOLO("yolov8n-pose.pt").export(format="onnx", imgsz=640, simplify=True)
os.makedirs("models", exist_ok=True)
shutil.move(path, "models/yolo_pose.onnx")
print("wrote models/yolo_pose.onnx")
