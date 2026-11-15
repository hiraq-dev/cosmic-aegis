"""Offline RAG core: load docs -> chunk -> embed -> vector index -> search.

Embedder is injectable (tests use a fake one). FAISS is used when installed, otherwise numpy.
"""
import json
import os
import re

import numpy as np

try:
    import faiss  # type: ignore
except ImportError:  # numpy fallback keeps tests/dev lightweight
    faiss = None


def load_documents(corpus_dir):
    """Yield (source_name, page, text) for .pdf/.txt/.md files."""
    for root, _, files in os.walk(corpus_dir):
        for fn in sorted(files):
            p = os.path.join(root, fn)
            ext = fn.lower().rsplit(".", 1)[-1]
            if ext in ("txt", "md"):
                with open(p, encoding="utf-8", errors="ignore") as f:
                    yield fn, 1, f.read()
            elif ext == "pdf":
                from pypdf import PdfReader
                for i, page in enumerate(PdfReader(p).pages, 1):
                    yield fn, i, page.extract_text() or ""


def chunk_text(text, size=800, overlap=120):
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    step = max(1, size - overlap)
    return [text[i:i + size] for i in range(0, max(1, len(text) - overlap), step)]


class Index:
    def __init__(self, embed, index_dir):
        self.embed = embed              # callable: list[str] -> np.ndarray (n, d), L2-normalised
        self.dir = index_dir
        self.meta = []                  # [{source, page, text}]
        self.vecs = None
        self._faiss = None

    # ---- build / persist
    def build(self, corpus_dir, size=800, overlap=120):
        self.meta = []
        for src, page, text in load_documents(corpus_dir):
            for c in chunk_text(text, size, overlap):
                self.meta.append({"source": src, "page": page, "text": c})
        if not self.meta:
            self.vecs = None
            return 0
        self.vecs = np.asarray(self.embed([m["text"] for m in self.meta]), dtype="float32")
        self._make_faiss()
        self.save()
        return len(self.meta)

    def _make_faiss(self):
        if faiss is not None and self.vecs is not None:
            self._faiss = faiss.IndexFlatIP(self.vecs.shape[1])
            self._faiss.add(self.vecs)

    def save(self):
        os.makedirs(self.dir, exist_ok=True)
        np.save(os.path.join(self.dir, "vecs.npy"), self.vecs)
        with open(os.path.join(self.dir, "meta.json"), "w", encoding="utf-8") as f:
            json.dump(self.meta, f)

    def load(self):
        vp, mp = os.path.join(self.dir, "vecs.npy"), os.path.join(self.dir, "meta.json")
        if not (os.path.exists(vp) and os.path.exists(mp)):
            return False
        self.vecs = np.load(vp)
        with open(mp, encoding="utf-8") as f:
            self.meta = json.load(f)
        self._make_faiss()
        return True

    # ---- search
    def search(self, query, k=5):
        if self.vecs is None or not len(self.meta):
            return []
        q = np.asarray(self.embed([query]), dtype="float32")
        if self._faiss is not None:
            scores, ids = self._faiss.search(q, min(k, len(self.meta)))
            scores, ids = scores[0], ids[0]
        else:
            s = (self.vecs @ q[0])
            ids = np.argsort(-s)[:k]
            scores = s[ids]
        return [{**self.meta[i], "score": round(float(sc), 4)} for i, sc in zip(ids, scores) if i >= 0]


def make_plan(query, hits, min_score=0.25):
    """Extractive, citation-first answer: no free generation => no hallucinated medical advice."""
    good = [h for h in hits if h["score"] >= min_score]
    if not good:
        return {"answer": "No sufficiently relevant protocol found. Escalate to flight surgeon / "
                          "ground when comms allow.", "sources": [], "confident": False}
    steps = [f"[{i}] {h['text']}" for i, h in enumerate(good, 1)]
    return {
        "answer": "Relevant protocol excerpts (follow in order, verify before acting):\n" + "\n".join(steps),
        "sources": [{"ref": i, "source": h["source"], "page": h["page"], "score": h["score"]}
                    for i, h in enumerate(good, 1)],
        "confident": True,
    }
