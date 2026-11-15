"""One-time, online step: cache the embedding model where the offline container expects it.

    pip install sentence-transformers
    python scripts/download_embedder.py
"""
import os

os.environ["HF_HOME"] = os.path.join("rag_service", "data", "hf")
from sentence_transformers import SentenceTransformer

SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
print("cached in", os.environ["HF_HOME"])
