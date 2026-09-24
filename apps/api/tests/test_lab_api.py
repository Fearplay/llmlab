"""Live comparison persistence and evidence-based scoring."""

import os
import time

os.environ["DATABASE_URL"] = "sqlite:///./test-llmlab.db"

from fastapi.testclient import TestClient  # noqa: E402

from llmlab_api import lab_api  # noqa: E402
from llmlab_api.contracts import ExecutionMode, GenerationResult, Usage  # noqa: E402
from llmlab_api.main import app  # noqa: E402


def test_scoring_requires_reference_and_validates_schema() -> None:
    assert lab_api._grade("anything", {"evaluator": "partial_match"}) is None
    assert lab_api._grade("Blue car", {"expected": "blue car", "evaluator": "exact_match"})[
        "passed"
    ]
    assert lab_api._grade(
        '{"answer": 42}',
        {"evaluator": "json_schema", "schema": {"type": "object", "required": ["answer"]}},
    )["passed"]
    assert not lab_api._grade(
        '{"answer": 42}',
        {"evaluator": "json_schema", "schema": {"type": "object", "required": ["missing"]}},
    )["passed"]


def test_live_arena_saves_results_and_costs(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    async def fake_generate(request, _settings):  # type: ignore[no-untyped-def]
        if request.model == "judge":
            raise RuntimeError("judge unavailable")
        return GenerationResult(
            text="Paris" if request.model == "right" else "London",
            provider="ollama",
            model=request.model,
            mode=ExecutionMode.LOCAL,
            usage=Usage(input_tokens=10, output_tokens=2),
            latency_ms=25,
            fixture=False,
        )

    monkeypatch.setattr(lab_api, "generate", fake_generate)
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/experiments",
            json={
                "name": "Capital comparison",
                "model_keys": ["ollama:right", "ollama:wrong"],
                "prompt": "Capital of France?",
                "expected": "Paris",
                "judge_model_key": "ollama:judge",
            },
        )
        assert created.status_code == 202
        run_id = created.json()["id"]
        for _ in range(100):
            run = client.get(f"/api/v1/experiments/{run_id}").json()
            if run["status"] in {"completed", "failed"}:
                break
            time.sleep(0.02)
        assert run["status"] == "completed"
        assert len(run["results"]) == 2
        assert run["metrics"]["quality_winner"] == "ollama:right"
        assert all(result["judge"].get("error") for result in run["results"])
        assert run["results"][0]["output"] == "Paris"
        assert run["usage"]["input_tokens"] == 20
        summary = client.get("/api/v1/operations/summary")
        assert summary.status_code == 200
        assert summary.json()["input_tokens"] >= 20
