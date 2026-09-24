"""Persisted model comparisons and evaluations for the local lab."""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import uuid
from collections import Counter
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .contracts import ExecutionMode, GenerationRequest
from .database import SessionLocal, get_db
from .models import Dataset, Run
from .pricing import estimate_usage_cost
from .providers import generate
from .settings import get_settings

router = APIRouter(prefix="/api/v1", tags=["lab"])
_tasks: dict[str, asyncio.Task[None]] = {}
_local_limit = asyncio.Semaphore(1)
_cloud_limit = asyncio.Semaphore(3)


class DatasetCase(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    input: str = Field(min_length=1, max_length=8000)
    expected: str | None = None
    evidence: list[str] = Field(default_factory=list, max_length=20)
    schema_: dict[str, Any] | None = Field(default=None, alias="schema")
    evaluator: Literal["exact_match", "partial_match", "contains", "json_schema"] = "partial_match"


class DatasetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    cases: list[DatasetCase] = Field(min_length=1, max_length=500)


class ExperimentCreate(BaseModel):
    name: str = Field(default="Model comparison", min_length=1, max_length=180)
    kind: Literal["arena", "evaluation"] = "arena"
    model_keys: list[str] = Field(min_length=1, max_length=8)
    prompt: str = Field(default="", max_length=8000)
    system_prompt: str = Field(default="Odpovídej jasně a stručně.", max_length=4000)
    expected: str | None = Field(default=None, max_length=8000)
    evidence: list[str] = Field(default_factory=list, max_length=20)
    dataset_id: str | None = None
    temperature: float = Field(default=0.2, ge=0, le=2)
    top_p: float = Field(default=1.0, ge=0, le=1)
    max_tokens: int = Field(default=512, ge=1, le=4096)
    judge_model_key: str | None = None
    order_check: bool = False


def _dataset_view(row: Dataset) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "version": row.version,
        "cases": row.cases,
        "created_at": row.created_at.isoformat(),
    }


@router.get("/datasets")
def list_datasets(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [
        _dataset_view(row)
        for row in db.scalars(select(Dataset).order_by(Dataset.created_at.desc()))
    ]


@router.post("/datasets", status_code=201)
def create_dataset(request: DatasetCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    ids = [case.id for case in request.cases]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Case IDs must be unique")
    row = Dataset(
        id=f"ds_{uuid.uuid4().hex[:12]}",
        name=request.name,
        cases=[case.model_dump(by_alias=True) for case in request.cases],
        version=1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _dataset_view(row)


@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.get(Dataset, dataset_id)
    if row is None:
        raise HTTPException(404, "Dataset not found")
    return _dataset_view(row)


@router.delete("/datasets/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)) -> None:
    row = db.get(Dataset, dataset_id)
    if row is None:
        raise HTTPException(404, "Dataset not found")
    db.delete(row)
    db.commit()


def _run_view(row: Run) -> dict[str, Any]:
    return {
        "id": row.id,
        "kind": row.kind,
        "name": row.name,
        "status": row.status,
        "mode": row.mode,
        "provider": row.provider,
        "model": row.model,
        "spec": row.spec or {},
        "results": row.results or [],
        "metrics": row.metrics or {},
        "trace": row.trace or [],
        "usage": row.usage or {},
        "progress": row.progress,
        "error": row.error,
        "created_at": row.created_at.isoformat(),
        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
    }


@router.get("/experiments")
def list_experiments(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = db.scalars(select(Run).order_by(Run.created_at.desc()).limit(200))
    return [_run_view(row) for row in rows]


@router.get("/operations/summary")
def operations_summary(db: Session = Depends(get_db)) -> dict[str, Any]:
    rows = list(db.scalars(select(Run).order_by(Run.created_at.desc()).limit(10000)))
    by_model: dict[str, dict[str, Any]] = {}
    by_day: dict[str, dict[str, Any]] = {}
    priced = 0
    unknown = 0
    total = 0.0
    input_tokens = 0
    output_tokens = 0
    for row in rows:
        day = row.created_at.date().isoformat()
        day_row = by_day.setdefault(day, {"date": day, "runs": 0, "estimated_usd": 0.0})
        day_row["runs"] += 1
        for item in row.results or []:
            entries = [(item.get("model_key") or row.model, item)]
            entries += [
                (
                    item.get(extra, {}).get("model_key") or item.get("model_key") or row.model,
                    item[extra],
                )
                for extra in ("judge", "order_check")
                if isinstance(item.get(extra), dict)
            ]
            for model_key, entry in entries:
                usage = entry.get("usage")
                if not isinstance(usage, dict):
                    continue
                model_row = by_model.setdefault(
                    model_key,
                    {
                        "model_key": model_key,
                        "calls": 0,
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "estimated_usd": 0.0,
                        "unknown_calls": 0,
                    },
                )
                model_row["calls"] += 1
                used_input = int(usage.get("input_tokens") or 0)
                used_output = int(usage.get("output_tokens") or 0)
                model_row["input_tokens"] += used_input
                model_row["output_tokens"] += used_output
                input_tokens += used_input
                output_tokens += used_output
                amount = entry.get("cost", {}).get("estimated_usd")
                if amount is None:
                    unknown += 1
                    model_row["unknown_calls"] += 1
                else:
                    priced += 1
                    total += float(amount)
                    model_row["estimated_usd"] += float(amount)
                    day_row["estimated_usd"] += float(amount)
    return {
        "runs": len(rows),
        "priced_calls": priced,
        "unknown_calls": unknown,
        "estimated_usd": round(total, 8),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "by_model": sorted(
            by_model.values(), key=lambda item: (-item["estimated_usd"], item["model_key"])
        ),
        "by_day": sorted(by_day.values(), key=lambda item: item["date"]),
    }


@router.get("/experiments/{run_id}")
def get_experiment(run_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.get(Run, run_id)
    if row is None:
        raise HTTPException(404, "Experiment not found")
    return _run_view(row)


@router.post("/experiments", status_code=202)
async def create_experiment(
    request: ExperimentCreate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    if len(request.model_keys) != len(set(request.model_keys)):
        raise HTTPException(422, "Choose each model once")
    if request.kind == "arena" and len(request.model_keys) < 2:
        raise HTTPException(422, "Arena needs at least two models")
    if request.kind == "evaluation" and not request.dataset_id:
        raise HTTPException(422, "Choose a dataset")
    if request.kind == "arena" and not request.prompt.strip() and not request.dataset_id:
        raise HTTPException(422, "Enter a prompt or choose a dataset")
    if request.dataset_id and db.get(Dataset, request.dataset_id) is None:
        raise HTTPException(404, "Dataset not found")
    for key in request.model_keys + ([request.judge_model_key] if request.judge_model_key else []):
        _split_model_key(key)
    spec = request.model_dump()
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    mode = "local" if all(key.startswith("ollama:") for key in request.model_keys) else "cloud"
    row = Run(
        id=run_id,
        kind=request.kind,
        name=request.name,
        status="queued",
        mode=mode,
        provider="multi",
        model=", ".join(request.model_keys)[:160],
        dataset_version=request.dataset_id or "custom",
        prompt_version="inline",
        evaluator_versions=["exact-v1", "token-f1-v1", "json-schema-v1"],
        config_hash=hashlib.sha256(json.dumps(spec, sort_keys=True).encode()).hexdigest(),
        git_sha=get_settings().git_sha,
        progress=0,
        usage={},
        spec=spec,
        results=[],
        metrics={},
        trace=[],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _schedule(run_id)
    return _run_view(row)


@router.post("/experiments/{run_id}/cancel")
def cancel_experiment(run_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.get(Run, run_id)
    if row is None:
        raise HTTPException(404, "Experiment not found")
    if row.status not in {"queued", "running"}:
        raise HTTPException(409, "Run has already finished")
    row.status = "cancel_requested"
    db.commit()
    task = _tasks.get(run_id)
    if task:
        task.cancel()
    return _run_view(row)


def _split_model_key(key: str) -> tuple[str, str, ExecutionMode]:
    provider, separator, model = key.partition(":")
    if (
        not separator
        or not model
        or provider not in {"ollama", "openai", "anthropic", "gemini", "openai_compatible"}
    ):
        raise HTTPException(422, f"Invalid model key: {key}")
    return provider, model, ExecutionMode.LOCAL if provider == "ollama" else ExecutionMode.CLOUD


def _schedule(run_id: str) -> None:
    task = asyncio.create_task(_execute(run_id))
    _tasks[run_id] = task
    task.add_done_callback(lambda _: _tasks.pop(run_id, None))


def resume_pending() -> None:
    """Resume queued work; never repeat a call that was in flight at shutdown."""
    with SessionLocal() as db:
        for row in db.scalars(select(Run).where(Run.status == "running")):
            row.status = "failed"
            row.error = "Server restarted during this run. Provider calls were not repeated."
            row.completed_at = datetime.now(UTC)
        pending = [
            row.id
            for row in db.scalars(select(Run).where(Run.status == "queued"))
            if row.kind in {"arena", "evaluation"}
        ]
        db.commit()
    for run_id in pending:
        _schedule(run_id)


async def _execute(run_id: str) -> None:
    with SessionLocal() as db:
        row = db.get(Run, run_id)
        if row is None or row.status != "queued":
            return
        row.status = "running"
        db.commit()
        spec = ExperimentCreate.model_validate(row.spec)
        dataset = db.get(Dataset, spec.dataset_id) if spec.dataset_id else None
        cases = (
            dataset.cases
            if dataset
            else [
                {
                    "id": "prompt-1",
                    "input": spec.prompt,
                    "expected": spec.expected,
                    "evidence": spec.evidence,
                    "evaluator": "partial_match",
                }
            ]
        )
    total = len(cases) * len(spec.model_keys)
    results: list[dict[str, Any]] = []
    try:
        for model_key in spec.model_keys:
            for case in cases:
                with SessionLocal() as db:
                    row = db.get(Run, run_id)
                    if row is None or row.status == "cancel_requested":
                        raise asyncio.CancelledError()
                item = await _run_case(spec, model_key, case)
                results.append(item)
                with SessionLocal() as db:
                    row = db.get(Run, run_id)
                    if row is None:
                        return
                    row.results = list(results)
                    row.progress = round(100 * len(results) / total)
                    row.trace = [
                        *row.trace,
                        {
                            "event": "case_complete",
                            "model_key": model_key,
                            "case_id": case["id"],
                            "status": item["status"],
                        },
                    ]
                    db.commit()
        with SessionLocal() as db:
            row = db.get(Run, run_id)
            if row is None:
                return
            row.metrics = _summarize(results)
            row.usage = _aggregate_usage(results)
            row.status = (
                "completed" if any(item["status"] == "completed" for item in results) else "failed"
            )
            row.completed_at = datetime.now(UTC)
            db.commit()
    except asyncio.CancelledError:
        with SessionLocal() as db:
            row = db.get(Run, run_id)
            if row:
                row.status = "cancelled"
                row.results = results
                row.completed_at = datetime.now(UTC)
                db.commit()
    except Exception as error:
        with SessionLocal() as db:
            row = db.get(Run, run_id)
            if row:
                row.status = "failed"
                row.error = str(error)[:500]
                row.results = results
                row.completed_at = datetime.now(UTC)
                db.commit()


async def _run_case(spec: ExperimentCreate, model_key: str, case: dict[str, Any]) -> dict[str, Any]:
    provider, model, mode = _split_model_key(model_key)
    evidence = case.get("evidence") or []
    context = "\n\n".join(f"[{index + 1}] {part}" for index, part in enumerate(evidence))
    prompt = case["input"] + (f"\n\nPodklady:\n{context}" if context else "")
    request = GenerationRequest(
        mode=mode,
        provider=provider,
        model=model,
        messages=[
            {"role": "system", "content": spec.system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=spec.temperature,
        top_p=spec.top_p,
        max_tokens=spec.max_tokens,
    )
    try:
        async with _local_limit if mode is ExecutionMode.LOCAL else _cloud_limit:
            response = await generate(request, get_settings())
    except Exception as error:
        return {
            "case_id": case["id"],
            "model_key": model_key,
            "status": "failed",
            "error": str(error)[:500],
            "output": "",
            "usage": None,
            "latency_ms": None,
            "grade": None,
        }
    grade = _grade(response.text, case)
    output: dict[str, Any] = {
        "case_id": case["id"],
        "model_key": model_key,
        "status": "completed",
        "output": response.text,
        "latency_ms": response.latency_ms,
        "usage": response.usage.model_dump(),
        "grade": grade,
        "provider": response.provider,
        "model": response.model,
    }
    output["cost"] = estimate_usage_cost(model_key, output["usage"])
    if spec.order_check and len(evidence) > 1:
        try:
            request.messages[-1]["content"] = (
                case["input"]
                + "\n\nPodklady:\n"
                + "\n\n".join(
                    f"[{index + 1}] {part}" for index, part in enumerate(reversed(evidence))
                )
            )
            async with _local_limit if mode is ExecutionMode.LOCAL else _cloud_limit:
                reversed_result = await generate(request, get_settings())
            output["order_check"] = {
                "reversed_output": reversed_result.text,
                "same_answer": _normalize(response.text) == _normalize(reversed_result.text),
                "latency_ms": reversed_result.latency_ms,
                "usage": reversed_result.usage.model_dump(),
            }
            output["order_check"]["cost"] = estimate_usage_cost(
                model_key, output["order_check"]["usage"]
            )
        except Exception as error:
            output["order_check"] = {"error": str(error)[:500], "model_key": model_key}
    if spec.judge_model_key:
        try:
            output["judge"] = await _judge(spec.judge_model_key, case, response.text)
        except Exception as error:
            output["judge"] = {"error": str(error)[:500], "model_key": spec.judge_model_key}
    return output


async def _judge(model_key: str, case: dict[str, Any], answer: str) -> dict[str, Any]:
    provider, model, mode = _split_model_key(model_key)
    payload = {
        "question": case["input"],
        "expected": case.get("expected"),
        "evidence": case.get("evidence", []),
        "answer": answer,
    }
    request = GenerationRequest(
        mode=mode,
        provider=provider,
        model=model,
        temperature=0,
        top_p=1,
        max_tokens=256,
        messages=[
            {
                "role": "system",
                "content": (
                    "Return JSON with score 0..1 and a short reason. Judge only against "
                    "supplied reference and evidence; say unverifiable if absent."
                ),
            },
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
    )
    async with _local_limit if mode is ExecutionMode.LOCAL else _cloud_limit:
        result = await generate(request, get_settings())
    return {
        "model_key": model_key,
        "opinion": result.text,
        "usage": result.usage.model_dump(),
        "latency_ms": result.latency_ms,
        "cost": estimate_usage_cost(model_key, result.usage.model_dump()),
    }


def _normalize(value: str) -> str:
    return " ".join(value.casefold().split())


def _grade(answer: str, case: dict[str, Any]) -> dict[str, Any] | None:
    expected = case.get("expected")
    schema = case.get("schema")
    evaluator = case.get("evaluator", "partial_match")
    if evaluator == "json_schema" and schema:
        from jsonschema import ValidationError, validate  # type: ignore[import-untyped]

        try:
            validate(json.loads(answer), schema)
            return {"method": "json_schema", "score": 1.0, "passed": True}
        except (ValueError, ValidationError) as error:
            return {
                "method": "json_schema",
                "score": 0.0,
                "passed": False,
                "reason": str(error)[:200],
            }
    if not isinstance(expected, str) or not expected.strip():
        return None
    if evaluator == "exact_match":
        score = float(_normalize(answer) == _normalize(expected))
    elif evaluator == "contains":
        score = float(_normalize(expected) in _normalize(answer))
    else:
        actual_tokens = Counter(re.findall(r"\w+", answer.casefold()))
        expected_tokens = Counter(re.findall(r"\w+", expected.casefold()))
        shared = sum((actual_tokens & expected_tokens).values())
        precision = shared / sum(actual_tokens.values()) if actual_tokens else 0
        recall = shared / sum(expected_tokens.values()) if expected_tokens else 0
        score = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {
        "method": evaluator,
        "score": round(score, 4),
        "passed": score >= 0.7,
        "expected": expected,
    }


def _summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    by_model: dict[str, list[dict[str, Any]]] = {}
    for item in results:
        by_model.setdefault(item["model_key"], []).append(item)
    rows = []
    for model_key, items in by_model.items():
        scored = [item["grade"]["score"] for item in items if item.get("grade")]
        elapsed = [item["latency_ms"] for item in items if item.get("latency_ms") is not None]
        rows.append(
            {
                "model_key": model_key,
                "cases": len(items),
                "completed": sum(item["status"] == "completed" for item in items),
                "quality": round(sum(scored) / len(scored), 4) if scored else None,
                "average_latency_ms": round(sum(elapsed) / len(elapsed)) if elapsed else None,
                "scored_cases": len(scored),
            }
        )
    ranked = sorted(
        (row for row in rows if row["quality"] is not None),
        key=lambda row: row["quality"],
        reverse=True,
    )
    winner = (
        ranked[0]["model_key"]
        if len(ranked) > 1 and ranked[0]["quality"] > ranked[1]["quality"]
        else None
    )
    return {"models": rows, "quality_winner": winner, "quality_available": bool(ranked)}


def _aggregate_usage(results: list[dict[str, Any]]) -> dict[str, Any]:
    usages = []
    estimates: list[float | None] = []
    for item in results:
        if isinstance(item.get("usage"), dict):
            usages.append(item["usage"])
            estimates.append(item.get("cost", {}).get("estimated_usd"))
        for extra in ("order_check", "judge"):
            if isinstance(item.get(extra), dict) and isinstance(item[extra].get("usage"), dict):
                usages.append(item[extra]["usage"])
                estimates.append(item[extra].get("cost", {}).get("estimated_usd"))
    costs = [usage.get("cost_usd") for usage in usages]
    known_costs = [float(cost) for cost in costs if cost is not None]
    known_estimates = [float(cost) for cost in estimates if cost is not None]
    return {
        "input_tokens": sum(int(usage.get("input_tokens") or 0) for usage in usages),
        "output_tokens": sum(int(usage.get("output_tokens") or 0) for usage in usages),
        "cost_usd": sum(known_costs) if costs and len(known_costs) == len(costs) else None,
        "estimated_cost_usd": sum(known_estimates)
        if estimates and len(known_estimates) == len(estimates)
        else None,
    }
