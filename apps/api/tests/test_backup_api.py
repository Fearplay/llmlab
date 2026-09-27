import io
import json
import zipfile
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from llmlab_api import backup_api
from llmlab_api.database import get_db
from llmlab_api.models import Base, Dataset, DocumentVersion, UserDocument
from llmlab_api.settings import Settings, get_settings


def test_backup_roundtrip_and_invalid_archive(monkeypatch, tmp_path: Path) -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    checkpoint = tmp_path / "dqn-checkpoint.npz"
    checkpoint.write_bytes(b"checkpoint")
    monkeypatch.setattr(backup_api, "_checkpoint_path", lambda _: checkpoint)
    app = FastAPI()
    app.include_router(backup_api.router)

    def session() -> Iterator[Session]:
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = session
    app.dependency_overrides[get_settings] = lambda: Settings()
    with factory() as db:
        db.add(
            Dataset(id="set-1", name="Questions", version=1, cases=[{"id": "q1", "input": "Hi"}])
        )
        db.add(
            UserDocument(
                id="doc-1",
                name="note.txt",
                media_type="txt",
                text="Hello",
                metadata_json={"version": 1, "version_id": "ver-1"},
            )
        )
        db.add(
            DocumentVersion(
                id="ver-1",
                document_id="doc-1",
                version=1,
                name="note.txt",
                media_type="txt",
                text="Hello",
                original=b"Hello",
                metadata_json={},
            )
        )
        db.commit()
    with TestClient(app) as client:
        exported = client.post(
            "/api/v1/backups/export",
            json={"browser": {"llmlab.locale": "cs", "OPENAI_API_KEY": "never-export"}},
        )
        assert exported.status_code == 200, exported.text
        archive = exported.content
        preview = client.post("/api/v1/backups/inspect", files={"file": ("backup.zip", archive)})
        assert preview.status_code == 200, preview.text
        assert preview.json()["counts"]["datasets"] == 1
        assert preview.json()["checkpoint"] is True
        with factory() as db:
            db.query(Dataset).delete()
            db.query(UserDocument).delete()
            db.query(DocumentVersion).delete()
            db.commit()
        checkpoint.unlink()
        restored = client.post("/api/v1/backups/restore", files={"file": ("backup.zip", archive)})
        assert restored.status_code == 200, restored.text
        assert restored.json()["browser"] == {"llmlab.locale": "cs"}
        assert checkpoint.read_bytes() == b"checkpoint"
        with factory() as db:
            assert db.get(Dataset, "set-1").cases[0]["input"] == "Hi"
            assert db.get(DocumentVersion, "ver-1").original == b"Hello"
        invalid = client.post(
            "/api/v1/backups/restore", files={"file": ("backup.zip", archive[:-20])}
        )
        assert invalid.status_code == 422
        tampered = io.BytesIO()
        with (
            zipfile.ZipFile(io.BytesIO(archive)) as source,
            zipfile.ZipFile(tampered, "w", compression=zipfile.ZIP_DEFLATED) as target_zip,
        ):
            manifest = json.loads(source.read("manifest.json"))
            manifest["counts"]["datasets"] += 1
            for name in source.namelist():
                target_zip.writestr(
                    name,
                    json.dumps(manifest).encode() if name == "manifest.json" else source.read(name),
                )
        bad_counts = client.post(
            "/api/v1/backups/inspect", files={"file": ("backup.zip", tampered.getvalue())}
        )
        assert bad_counts.status_code == 422
        with factory() as db:
            assert db.get(Dataset, "set-1") is not None
            db.get(Dataset, "set-1").name = "Current state"
            db.commit()
        checkpoint.write_bytes(b"current-checkpoint")

        def fail_insert(_conn, _cursor, statement, _params, _context, _many):
            if statement.startswith("INSERT INTO datasets"):
                raise RuntimeError("simulated import failure")

        event.listen(engine, "before_cursor_execute", fail_insert)
        try:
            with pytest.raises(RuntimeError, match="simulated import failure"):
                client.post("/api/v1/backups/restore", files={"file": ("backup.zip", archive)})
        finally:
            event.remove(engine, "before_cursor_execute", fail_insert)
        with factory() as db:
            assert db.get(Dataset, "set-1").name == "Current state"
        assert checkpoint.read_bytes() == b"current-checkpoint"

        with factory() as db:
            db.get(DocumentVersion, "ver-1").original = None
            db.commit()
        legacy_archive = client.post("/api/v1/backups/export", json={}).content
        with factory() as db:
            db.query(DocumentVersion).delete()
            db.query(UserDocument).delete()
            db.commit()
        restored_legacy = client.post(
            "/api/v1/backups/restore", files={"file": ("backup.zip", legacy_archive)}
        )
        assert restored_legacy.status_code == 200
        with factory() as db:
            assert db.get(DocumentVersion, "ver-1").text == "Hello"
            assert db.get(DocumentVersion, "ver-1").original is None
