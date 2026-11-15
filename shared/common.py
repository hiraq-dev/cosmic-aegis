"""Shared helpers: config loading + health endpoint. Copied into each image."""
import json
import os

from fastapi import FastAPI


def load_config(path=None):
    path = path or os.environ.get("CONFIG_PATH", "/app/config.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def make_app(name):
    app = FastAPI(title=name)

    @app.get("/health")
    def health():
        return {"service": name, "status": "ok"}

    return app
