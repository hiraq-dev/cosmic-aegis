import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import Base, Database
from app.main import create_app


@pytest.fixture()
def env(tmp_path):
    cfg = Settings(database_url=f"sqlite:///{tmp_path/'t.db'}", jwt_secret="test-secret-test-secret-test-secret-123", poll_nasa=False, anthropic_api_key="")
    db = Database(cfg.database_url)
    Base.metadata.create_all(db.engine)
    app = create_app(cfg, db)
    return cfg, db, app


@pytest.fixture()
def client(env):
    with TestClient(env[2]) as c:
        yield c


def signup(client, email, role="crew"):
    r = client.post("/auth/register", json={"email": email, "password": "correct-horse-battery", "role": role, "display_name": email.split("@")[0]})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["id"]
