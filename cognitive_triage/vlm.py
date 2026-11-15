"""VLM wrapper: image -> structured symptom JSON. Backends are pluggable; output is always validated."""
import json
import re

PROMPT = (
    "You are an onboard spaceflight medical assistant. Look at the image and respond with ONLY a JSON "
    'object: {{"condition": one of {conds} or "none", "confidence": 0-1, '
    '"location": str, "description": str, "severity": "low"|"moderate"|"high"}}. '
    "Describe only what is visible. If unsure use condition \"none\"."
)


def build_prompt(conditions):
    return PROMPT.format(conds=json.dumps(conditions))


def parse_symptoms(raw, conditions):
    """Extract + validate JSON from model text. Never trusts the model: bad output => 'none'/0."""
    safe = {"condition": "none", "confidence": 0.0, "location": "", "description": "",
            "severity": "low", "valid": False}
    m = re.search(r"\{.*\}", raw or "", re.S)
    if not m:
        return safe
    try:
        d = json.loads(m.group(0))
    except json.JSONDecodeError:
        return safe
    cond = d.get("condition")
    if cond not in list(conditions) + ["none"]:
        return safe
    try:
        conf = float(d.get("confidence", 0))
    except (TypeError, ValueError):
        return safe
    sev = d.get("severity") if d.get("severity") in ("low", "moderate", "high") else "low"
    return {"condition": cond, "confidence": max(0.0, min(1.0, conf)),
            "location": str(d.get("location", ""))[:100],
            "description": str(d.get("description", ""))[:500], "severity": sev, "valid": True}


def symptoms_to_query(s):
    return (f"{s['condition']} {s['severity']} severity at {s['location']}: {s['description']}. "
            "Treatment procedure in spaceflight.")


class MockVLM:
    """Deterministic stand-in so the full pipeline can be demoed without GPU/model weights."""

    def __init__(self, conditions):
        self.conditions = conditions

    def __call__(self, image, prompt):
        return json.dumps({"condition": self.conditions[0], "confidence": 0.8, "location": "forearm",
                           "description": "[MOCK] 3 cm linear wound with minor bleeding",
                           "severity": "moderate"})


class TransformersVLM:
    """Qwen2-VL via transformers, loaded lazily from local weights (offline)."""

    def __init__(self, path, max_new_tokens=256):
        import torch
        from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
        self.torch = torch
        self.proc = AutoProcessor.from_pretrained(path, local_files_only=True)
        self.model = Qwen2VLForConditionalGeneration.from_pretrained(
            path, local_files_only=True, torch_dtype="auto", device_map="auto")
        self.max_new = max_new_tokens

    def __call__(self, image, prompt):
        msgs = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": prompt}]}]
        text = self.proc.apply_chat_template(msgs, add_generation_prompt=True)
        inputs = self.proc(text=[text], images=[image], return_tensors="pt").to(self.model.device)
        with self.torch.no_grad():
            out = self.model.generate(**inputs, max_new_tokens=self.max_new, do_sample=False)
        return self.proc.batch_decode(out[:, inputs.input_ids.shape[1]:], skip_special_tokens=True)[0]


def load_backend(cfg):
    v = cfg["vlm"]
    if v.get("backend", "mock") == "transformers":
        return TransformersVLM(v["path"], v.get("max_new_tokens", 256))
    return MockVLM(cfg["conditions"])
