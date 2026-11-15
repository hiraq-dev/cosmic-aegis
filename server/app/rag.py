"""Small BM25 retrieval over curated research documents (NASA HRP evidence reports and local notes).
Answers must cite a document and passage. Evidence reports are research literature, not treatment protocols."""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path

TOKEN = re.compile(r"[a-z0-9]{3,}")
STOP = set("the and for that with this from are was were have has not can may which their other than into its also been more such these those".split())


@dataclass
class Passage:
    id: str
    doc: str
    page: int | None
    text: str


def tokens(s: str) -> list[str]:
    return [t for t in TOKEN.findall(s.lower()) if t not in STOP]


def chunk(text: str, size: int = 900, overlap: int = 150) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    out, i = [], 0
    while i < len(text):
        out.append(text[i : i + size])
        i += size - overlap
    return [c for c in out if len(c) > 120]


class Index:
    def __init__(self, passages: list[Passage]):
        self.passages = passages
        self.tok = [tokens(p.text) for p in passages]
        self.df: dict[str, int] = {}
        for t in self.tok:
            for w in set(t):
                self.df[w] = self.df.get(w, 0) + 1
        self.avg = (sum(len(t) for t in self.tok) / len(self.tok)) if self.tok else 0.0

    def search(self, query: str, k: int = 4) -> list[tuple[Passage, float]]:
        q = tokens(query)
        n = len(self.passages)
        scored = []
        for p, t in zip(self.passages, self.tok):
            if not t:
                continue
            s = 0.0
            for w in set(q):
                f = t.count(w)
                if not f:
                    continue
                idf = math.log(1 + (n - self.df.get(w, 0) + 0.5) / (self.df.get(w, 0) + 0.5))
                s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * len(t) / (self.avg or 1)))
            if s > 0:
                scored.append((p, s))
        scored.sort(key=lambda x: -x[1])
        return scored[:k]


def build_index(dirs: list[Path]) -> Index:
    passages: list[Passage] = []
    for d in dirs:
        if not d.exists():
            continue
        for f in sorted(d.iterdir()):
            if f.suffix.lower() == ".pdf":
                try:
                    import fitz  # pymupdf

                    with fitz.open(f) as doc:
                        for pno, page in enumerate(doc, start=1):
                            for j, c in enumerate(chunk(page.get_text())):
                                passages.append(Passage(f"{f.stem}#p{pno}.{j}", f.stem, pno, c))
                except Exception:  # noqa: BLE001 - a bad PDF must not take the service down
                    continue
            elif f.suffix.lower() in (".md", ".txt") and f.name.upper() != "SOURCES.MD":
                for j, c in enumerate(chunk(f.read_text(encoding="utf-8", errors="ignore"))):
                    passages.append(Passage(f"{f.stem}#{j}", f.stem, None, c))
    return Index(passages)
