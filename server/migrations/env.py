import os
from alembic import context
from sqlalchemy import create_engine
from app.db import Base
from app import models  # noqa: F401  (register tables)

url = os.environ.get("DATABASE_URL", "sqlite:///./aegis.db")
meta = Base.metadata


def run():
    if context.is_offline_mode():
        context.configure(url=url, target_metadata=meta, literal_binds=True)
        with context.begin_transaction():
            context.run_migrations()
        return
    with create_engine(url).connect() as c:
        context.configure(connection=c, target_metadata=meta)
        with context.begin_transaction():
            context.run_migrations()


run()
