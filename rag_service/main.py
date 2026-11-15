import os
import threading

from pydantic import BaseModel

from common import load_config, make_app
from rag import Index, make_plan

cfg = load_config()
app = make_app("rag_service")

_model = None


def embed(texts):
    """sentence-transformers, loaded lazily from the local cache (offline)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(cfg["embedding_model"])
    return _model.encode(texts, normalize_embeddings=True, show_progress_bar=False)


index = Index(embed, os.path.dirname(cfg["index_path"]))
index.load()


def _warm_up():
    """Load the embedding model at startup so the first real query is not slow."""
    try:
        embed(["warm-up"])
    except Exception:
        pass  # surfaced on first real query instead


threading.Thread(target=_warm_up, daemon=True).start()


class Query(BaseModel):
    query: str


@app.post("/ingest")
def ingest():
    n = index.build(cfg["corpus_dir"], cfg["chunk_size"], cfg["chunk_overlap"])
    return {"chunks": n}


@app.post("/query")
def query(q: Query):
    hits = index.search(q.query, cfg["top_k"])
    return make_plan(q.query, hits, cfg.get("min_score", 0.5))


@app.get("/stats")
def stats():
    return {"chunks": len(index.meta), "sources": sorted({m["source"] for m in index.meta})}
