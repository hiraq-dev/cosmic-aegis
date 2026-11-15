import numpy as np

from rag import Index, chunk_text, make_plan

VOCAB = ["bleeding", "pressure", "saline", "vision", "acuity", "radiation", "rash"]


def fake_embed(texts):
    v = np.array([[t.lower().count(w) for w in VOCAB] for t in texts], dtype="float32") + 1e-3
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def test_chunking_overlap():
    c = chunk_text("a" * 2000, 800, 100)
    assert all(len(x) <= 800 for x in c) and len(c) >= 3 and chunk_text("  ") == []


def test_build_search_persist(tmp_path):
    d = tmp_path / "docs"; d.mkdir()
    (d / "a.md").write_text("Control bleeding with direct pressure and saline.")
    (d / "b.md").write_text("Check visual acuity for vision changes.")
    idx = Index(fake_embed, str(tmp_path / "idx"))
    assert idx.build(str(d)) == 2
    top = idx.search("how to stop bleeding", 1)[0]
    assert top["source"] == "a.md"
    idx2 = Index(fake_embed, str(tmp_path / "idx"))
    assert idx2.load() and idx2.search("vision problem", 1)[0]["source"] == "b.md"


def test_plan_refuses_when_irrelevant():
    plan = make_plan("q", [{"score": 0.05, "text": "x", "source": "s", "page": 1}])
    assert plan["confident"] is False and plan["sources"] == []
