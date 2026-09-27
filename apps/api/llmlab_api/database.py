from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from .models import Base, DocumentVersion, UserDocument
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
    # Databases created before document versioning retain their extracted text.
    with SessionLocal() as db:
        for document in db.query(UserDocument).all():
            if db.query(DocumentVersion.id).filter_by(document_id=document.id).first():
                continue
            db.add(DocumentVersion(
                id=f"legacy_{document.id}", document_id=document.id, version=1,
                name=document.name, media_type=document.media_type, text=document.text,
                original=None, metadata_json={**document.metadata_json, "legacy": True},
                created_at=document.created_at,
            ))
        db.commit()


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
