"""YOLOv8-pose ONNX inference (onnxruntime; TensorRT/CUDA providers used when available)."""
import cv2
import numpy as np
import onnxruntime as ort


class PoseEstimator:
    def __init__(self, path, providers, input_size=(640, 640), conf=0.5, iou=0.5):
        avail = ort.get_available_providers()
        self.session = ort.InferenceSession(path, providers=[p for p in providers if p in avail])
        self.inp = self.session.get_inputs()[0].name
        self.size, self.conf, self.iou = tuple(input_size), conf, iou
        self.provider = self.session.get_providers()[0]

    def _letterbox(self, img):
        h, w = img.shape[:2]
        r = min(self.size[0] / h, self.size[1] / w)
        nh, nw = int(round(h * r)), int(round(w * r))
        pad_h, pad_w = (self.size[0] - nh) // 2, (self.size[1] - nw) // 2
        out = np.full((*self.size, 3), 114, np.uint8)
        out[pad_h:pad_h + nh, pad_w:pad_w + nw] = cv2.resize(img, (nw, nh))
        return out, r, pad_w, pad_h

    def __call__(self, frame_bgr):
        """Return (kp[17,2], kp_conf[17], box_conf) for the best person, or None."""
        img, r, pw, ph = self._letterbox(frame_bgr)
        x = img[:, :, ::-1].transpose(2, 0, 1)[None].astype(np.float32) / 255.0
        out = self.session.run(None, {self.inp: x})[0][0].T          # (N, 56)
        out = out[out[:, 4] >= self.conf]
        if len(out) == 0:
            return None
        boxes = np.stack([out[:, 0] - out[:, 2] / 2, out[:, 1] - out[:, 3] / 2, out[:, 2], out[:, 3]], 1)
        idx = cv2.dnn.NMSBoxes(boxes.tolist(), out[:, 4].tolist(), self.conf, self.iou)
        if len(idx) == 0:
            return None
        det = out[int(np.array(idx).flatten()[0])]
        k = det[5:].reshape(17, 3)
        xy = np.stack([(k[:, 0] - pw) / r, (k[:, 1] - ph) / r], 1)
        return xy, k[:, 2], float(det[4])


SKELETON = [(5, 7), (7, 9), (6, 8), (8, 10), (5, 6), (5, 11), (6, 12), (11, 12),
            (11, 13), (13, 15), (12, 14), (14, 16)]


def draw(frame, kp, conf, text):
    for a, b in SKELETON:
        if conf[a] > 0.4 and conf[b] > 0.4:
            cv2.line(frame, tuple(map(int, kp[a])), tuple(map(int, kp[b])), (197, 209, 79), 3)
    for p, c in zip(kp, conf):
        if c > 0.4:
            cv2.circle(frame, tuple(map(int, p)), 4, (0, 0, 255), -1)
    cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (197, 209, 79), 2)
    return frame
