"""Portable, local-only backups of LLMLab user data."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import LargeBinary, delete, insert, select
from sqlalchemy.orm import Session

from .database import get_db
from .game_api import _checkpoint_path
from .game_models import GameEpisode, GameTraining
from .models import Base, Run
from .secret_settings import _require_local
from .settings import Settings, get_settings

router = APIRouter(prefix="/api/v1/backups", tags=["backups"])
FORMAT_VERSION = 1
MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
MAX_EXPANDED_BYTES = 512 * 1024 * 1024
BROWSER_KEYS = {
    "llmlab.locale",
    "llmlab.mode",
    "llmlab.reduceMotion",
    "llmlab.theme",
    "llmlab.projectName",
    "llmlab.selectedModel",
    "llmlab.recentModels",
    "llmlab.promptVersions",
    "llmlab.learningProgress.v1",
    "llmlab.promptLibrary.v1",
    "llmlab.savedViews.v1",
    "llmlab.glossaryNotes.v1",
    "llmlab.plainLanguage.v1",
    "llmlab.flappyChallenges.v1",
}


class ExportRequest(BaseModel):
    browser: dict[str, str] = Field(default_factory=dict)


def _encode(value: Any) -> Any:
    if isinstance(value, datetime):
        return {"$datetime": value.isoformat()}
    if isinstance(value, bytes):
        return {"$bytes": base64.b64encode(value).decode("ascii")}
    return value


def _decode(value: Any, column: Any) -> Any:
    if isinstance(value, dict) and set(value) == {"$datetime"}:
        if not hasattr(column.type, "timezone"):
            raise ValueError("Invalid datetime column")
        return datetime.fromisoformat(value["$datetime"])
    if isinstance(value, dict) and set(value) == {"$bytes"}:
        if not isinstance(column.type, LargeBinary):
            raise ValueError("Invalid binary column")
        return base64.b64decode(value["$bytes"], validate=True)
    return value


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=_encode).encode(
        "utf-8"
    )


def _browser_data(browser: dict[str, str]) -> dict[str, str]:
    return {
        key: value
        for key, value in browser.items()
        if key in BROWSER_KEYS and isinstance(value, str) and len(value) <= 2_000_000
    }


def _archive(db: Session, browser: dict[str, str], settings: Settings) -> bytes:
    payloads: dict[str, bytes] = {}
    counts: dict[str, int] = {}
    for table in Base.metadata.sorted_tables:
        rows = [dict(row) for row in db.execute(select(table)).mappings()]
        payloads[f"database/{table.name}.json"] = _json_bytes(rows)
        counts[table.name] = len(rows)
    payloads["browser.json"] = _json_bytes(_browser_data(browser))
    checkpoint = _checkpoint_path(settings)
    if checkpoint.is_file():
        payloads["dqn-checkpoint.npz"] = checkpoint.read_bytes()
    manifest = {
        "format": "llmlab-backup",
        "format_version": FORMAT_VERSION,
        "created_at": datetime.now(UTC).isoformat(),
        "counts": counts,
        "files": {name: hashlib.sha256(data).hexdigest() for name, data in payloads.items()},
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        archive.writestr("manifest.json", _json_bytes(manifest))
        for name, data in payloads.items():
            archive.writestr(name, data)
    return output.getvalue()


def _inspect(
    raw: bytes,
) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]], dict[str, str], bytes | None]:
    if len(raw) > MAX_ARCHIVE_BYTES:
        raise HTTPException(413, "Backup archive exceeds 256 MB")
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)) or "manifest.json" not in names:
                raise ValueError("Duplicate or missing archive entries")
            if sum(item.file_size for item in archive.infolist()) > MAX_EXPANDED_BYTES:
                raise ValueError("Backup expands beyond 512 MB")
            manifest = json.loads(archive.read("manifest.json"))
            if not isinstance(manifest, dict):
                raise ValueError("Invalid backup manifest")
            if (
                manifest.get("format") != "llmlab-backup"
                or manifest.get("format_version") != FORMAT_VERSION
            ):
                raise ValueError("Unsupported backup format")
            datetime.fromisoformat(manifest["created_at"])
            expected = {f"database/{table.name}.json" for table in Base.metadata.sorted_tables}
            expected.add("browser.json")
            files = manifest.get("files")
            if not isinstance(files, dict) or not expected.issubset(files):
                raise ValueError("Backup is missing required data")
            if set(names) != set(files) | {"manifest.json"} or set(files) - expected - {
                "dqn-checkpoint.npz"
            }:
                raise ValueError("Unexpected archive entries")
            payloads = {}
            for name, checksum in files.items():
                data = archive.read(name)
                if hashlib.sha256(data).hexdigest() != checksum:
                    raise ValueError(f"Checksum mismatch: {name}")
                payloads[name] = data
            browser_value = json.loads(payloads["browser.json"])
            if not isinstance(browser_value, dict) or any(
                key not in BROWSER_KEYS or not isinstance(value, str) or len(value) > 2_000_000
                for key, value in browser_value.items()
            ):
                raise ValueError("Invalid browser data")
            browser = _browser_data(browser_value)
            tables: dict[str, list[dict[str, Any]]] = {}
            for table in Base.metadata.sorted_tables:
                rows = json.loads(payloads[f"database/{table.name}.json"])
                if not isinstance(rows, list):
                    raise ValueError(f"Invalid rows in {table.name}")
                columns = {column.name: column for column in table.columns}
                parsed = []
                for row in rows:
                    if not isinstance(row, dict) or set(row) != set(columns):
                        raise ValueError(f"Invalid columns in {table.name}")
                    parsed.append({key: _decode(value, columns[key]) for key, value in row.items()})
                tables[table.name] = parsed
            if manifest.get("counts") != {name: len(rows) for name, rows in tables.items()}:
                raise ValueError("Backup row counts do not match its contents")
            return manifest, tables, browser, payloads.get("dqn-checkpoint.npz")
    except (
        zipfile.BadZipFile,
        KeyError,
        ValueError,
        TypeError,
        UnicodeError,
        json.JSONDecodeError,
    ) as exc:
        raise HTTPException(422, f"Invalid backup: {exc}") from exc


async def _read_upload(file: UploadFile) -> bytes:
    raw = await file.read(MAX_ARCHIVE_BYTES + 1)
    if len(raw) > MAX_ARCHIVE_BYTES:
        raise HTTPException(413, "Backup archive exceeds 256 MB")
    return raw


@router.post("/export")
def export_backup(
    payload: ExportRequest,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    _require_local(request)
    data = _archive(db, payload.browser, settings)
    return Response(
        data,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="llmlab-backup.zip"',
        },
    )


@router.post("/inspect")
async def inspect_backup(file: UploadFile, request: Request) -> dict[str, Any]:
    _require_local(request)
    manifest, _, browser, checkpoint = _inspect(await _read_upload(file))
    return {
        "created_at": manifest["created_at"],
        "counts": manifest["counts"],
        "browser_items": len(browser),
        "checkpoint": checkpoint is not None,
    }


@router.post("/restore")
async def restore_backup(
    file: UploadFile,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    _require_local(request)
    manifest, tables, browser, checkpoint = _inspect(await _read_upload(file))
    if (
        db.scalar(
            select(Run.id).where(Run.status.in_(["queued", "running", "cancel_requested"])).limit(1)
        )
        or db.scalar(
            select(GameEpisode.id).where(GameEpisode.status.in_(["queued", "running"])).limit(1)
        )
        or db.scalar(
            select(GameTraining.id).where(GameTraining.status.in_(["queued", "running"])).limit(1)
        )
    ):
        raise HTTPException(409, "Stop active runs before restoring a backup")
    target = _checkpoint_path(settings)
    target.parent.mkdir(parents=True, exist_ok=True)
    previous = target.read_bytes() if target.exists() else None
    staged: Path | None = None
    try:
        if checkpoint is not None:
            with tempfile.NamedTemporaryFile(
                dir=target.parent, prefix="llmlab-checkpoint-", delete=False
            ) as temp:
                temp.write(checkpoint)
                staged = Path(temp.name)
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(delete(table))
        for table in Base.metadata.sorted_tables:
            rows = tables[table.name]
            if rows:
                db.execute(insert(table), rows)
        if staged is not None:
            os.replace(staged, target)
            staged = None
        elif target.exists():
            target.unlink()
        db.commit()
    except Exception:
        db.rollback()
        if previous is None:
            target.unlink(missing_ok=True)
        else:
            target.write_bytes(previous)
        raise
    finally:
        if staged is not None:
            staged.unlink(missing_ok=True)
    return {"restored": True, "counts": manifest["counts"], "browser": browser}
