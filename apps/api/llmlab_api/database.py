from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from .models import Base
from .settings import get_settings

settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def create_tables() -> None:
    Base.metadata.create_all(engine)
    # Direct ``uvicorn`` starts must also open databases made by the earlier
    # fixture-only release. Alembic remains the deployment migration path.
    existing = {column["name"] for column in inspect(engine).get_columns("runs")}
    additions = {
        "kind": "VARCHAR(30) NOT NULL DEFAULT 'prompt'",
        "spec": "JSON NOT NULL DEFAULT '{}'",
        "results": "JSON NOT NULL DEFAULT '[]'",
        "metrics": "JSON NOT NULL DEFAULT '{}'",
        "trace": "JSON NOT NULL DEFAULT '[]'",
    }
    with engine.begin() as connection:
        for name, definition in additions.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE runs ADD COLUMN {name} {definition}"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_runs_kind ON runs (kind)"))


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
