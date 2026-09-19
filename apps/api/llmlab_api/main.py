import asyncio
import hashlib
import json
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from .contracts import (
    EmbeddingRequest,
    EmbeddingResult,
    EvaluationRequest,
    EvaluationResult,
    ExecutionMode,
    GenerationRequest,
    GenerationResult,
    RagRequest,
    RagSearchRequest,
    RunCreate,
    RunStatus,
    RunView,
    TrainingRequest,
)
from .database import SessionLocal, create_tables, get_db
from .evaluators import evaluate
from .fixture import training_fixture
from .models import HumanReview, Run
from .providers import embed, generate, provider_views
from .rag_service import get_rag_service
from .settings import Settings, get_settings
from .state import can_transition
from .training import run_local_training
from .worker import run_fixture


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    create_tables()
    yield


app = FastAPI(title="LLMLab API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health/live", tags=["health"])
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ready"}


@app.get("/api/v1/providers", tags=["providers"])
def providers(settings: Settings = Depends(get_settings)) -> list[dict[str, Any]]:
    return [item.model_dump() for item in provider_views(settings)]


@app.post("/api/v1/generation", response_model=GenerationResult, tags=["providers"])
async def generation(
    request: GenerationRequest, settings: Settings = Depends(get_settings)
) -> GenerationResult:
    return await generate(request, settings)


@app.post("/api/v1/embeddings", response_model=EmbeddingResult, tags=["providers"])
async def embeddings(
    request: EmbeddingRequest, settings: Settings = Depends(get_settings)
) -> EmbeddingResult:
    return await embed(request, settings)


@app.post("/api/v1/evaluations", response_model=EvaluationResult, tags=["evaluations"])
def evaluations(request: EvaluationRequest) -> EvaluationResult:
    return evaluate(request)


@app.get("/api/v1/rag/status", tags=["rag"])
def rag_status(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    return get_rag_service(settings).status()


@app.get("/api/v1/rag/documents", tags=["rag"])
def rag_documents(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    status = get_rag_service(settings).status()
    return {
        "corpus_id": status["corpus_id"],
        "indexed_at": status["indexed_at"],
        "fingerprint": status["fingerprint"],
        "embedding_model": status["embedding_model"],
        "documents": status["documents"],
    }


@app.post("/api/v1/rag/reindex", tags=["rag"])
def rag_reindex(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    return get_rag_service(settings).rebuild()


@app.post("/api/v1/rag/search", tags=["rag"])
def rag_search(
    request: RagSearchRequest, settings: Settings = Depends(get_settings)
) -> dict[str, Any]:
    return get_rag_service(settings).search(request.question, request.top_k)


@app.post("/api/v1/rag/run", tags=["rag"])
async def rag_run(
    request: RagRequest, settings: Settings = Depends(get_settings)
) -> dict[str, Any]:
    try:
        return await get_rag_service(settings).run(request)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/api/v1/training/run", tags=["training"])
def training_run(request: TrainingRequest) -> dict[str, Any]:
    if request.mode is ExecutionMode.FIXTURE:
        return training_fixture(request.epochs)
    if request.mode is ExecutionMode.CLOUD:
        raise HTTPException(422, "Training Lab supports fixture or local execution only")
    return run_local_training(request)


@app.post("/api/v1/runs", response_model=RunView, status_code=202, tags=["runs"])
def create_run(
    request: RunCreate,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RunView:
    if request.mode is not ExecutionMode.FIXTURE:
        raise HTTPException(
            501, "Queued live-provider experiments are not enabled in this demo build"
        )
    run_id = f"run_{uuid.uuid4().hex[:10]}"
    config_json = json.dumps(request.config, sort_keys=True, separators=(",", ":"))
    row = Run(
        id=run_id,
        name=request.name,
        status=RunStatus.QUEUED.value,
        mode=request.mode.value,
        provider=request.provider,
        model=request.model,
        dataset_version=request.dataset_version,
        prompt_version=request.prompt_version,
        evaluator_versions=request.evaluator_versions,
        config_hash=hashlib.sha256(config_json.encode()).hexdigest(),
        git_sha=settings.git_sha,
        progress=0,
        usage={},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    try:
        task = run_fixture.delay(run_id)
        response.headers["X-Task-Id"] = task.id
    except Exception:
        row.status = RunStatus.FAILED.value
        row.error = "Queue unavailable"
        db.commit()
    return _run_view(row)


@app.get("/api/v1/runs", response_model=list[RunView], tags=["runs"])
def list_runs(db: Session = Depends(get_db)) -> list[RunView]:
    return [
        _run_view(row) for row in db.scalars(select(Run).order_by(Run.created_at.desc()).limit(100))
    ]


@app.get("/api/v1/runs/{run_id}", response_model=RunView, tags=["runs"])
def get_run(run_id: str, db: Session = Depends(get_db)) -> RunView:
    return _run_view(_get_run(db, run_id))


@app.post("/api/v1/runs/{run_id}/cancel", response_model=RunView, tags=["runs"])
def cancel_run(run_id: str, db: Session = Depends(get_db)) -> RunView:
    row = _get_run(db, run_id)
    current = RunStatus(row.status)
    if not can_transition(current, RunStatus.CANCEL_REQUESTED):
        raise HTTPException(409, f"Cannot cancel a {current.value} run")
    row.status = RunStatus.CANCEL_REQUESTED.value
    db.commit()
    db.refresh(row)
    return _run_view(row)


@app.get("/api/v1/runs/{run_id}/events", tags=["runs"])
def run_events(run_id: str, db: Session = Depends(get_db)) -> EventSourceResponse:
    _get_run(db, run_id)

    async def event_stream() -> AsyncIterator[dict[str, str]]:
        previous = ""
        sequence = 0
        while True:
            with SessionLocal() as stream_db:
                row = _get_run(stream_db, run_id)
                payload = json.dumps({"status": row.status, "progress": row.progress})
            if payload != previous:
                sequence += 1
                yield {"id": str(sequence), "event": "run", "data": payload}
                previous = payload
            if row.status in {"completed", "cancelled", "failed"}:
                break
            await asyncio.sleep(0.4)

    return EventSourceResponse(event_stream())


@app.post("/api/v1/reviews", status_code=201, tags=["reviews"])
def create_review(payload: dict[str, str], db: Session = Depends(get_db)) -> dict[str, Any]:
    if payload.get("verdict") not in {"good", "bad"}:
        raise HTTPException(422, "verdict must be good or bad")
    row = HumanReview(
        id=f"review_{uuid.uuid4().hex[:10]}",
        run_id=payload.get("run_id", "run_0191"),
        case_id=payload.get("case_id", ""),
        verdict=payload["verdict"],
        comment=payload.get("comment", ""),
    )
    db.add(row)
    db.commit()
    return {"id": row.id, "created_at": row.created_at, "saved": True}


def _get_run(db: Session, run_id: str) -> Run:
    row = db.scalar(select(Run).where(Run.id == run_id))
    if row is None:
        raise HTTPException(404, "Run not found")
    return row


def _run_view(row: Run) -> RunView:
    return RunView(
        id=row.id,
        name=row.name,
        status=RunStatus(row.status),
        mode=ExecutionMode(row.mode),
        provider=row.provider,
        model=row.model,
        dataset_version=row.dataset_version,
        prompt_version=row.prompt_version,
        evaluator_versions=row.evaluator_versions,
        config_hash=row.config_hash,
        git_sha=row.git_sha,
        progress=row.progress,
        usage=row.usage or {},
        created_at=row.created_at or datetime.now(UTC),
        completed_at=row.completed_at,
    )
