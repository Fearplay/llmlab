"""Live comparison persistence and evidence-based scoring."""

import json
import os
import time

os.environ["DATABASE_URL"] = "sqlite:///./test-llmlab.db"

from fastapi.testclient import TestClient  # noqa: E402

from llmlab_api import inference_api, lab_api  # noqa: E402
from llmlab_api.contracts import (  # noqa: E402
    EmbeddingResult,
    ExecutionMode,
    GenerationResult,
    Usage,
)
from llmlab_api.main import app  # noqa: E402


def test_scoring_requires_reference_and_validates_schema() -> None:
    assert lab_api._grade("anything", {"evaluator": "partial_match"}) is None
    assert lab_api._grade(
        "Jedna hodina má 60 minut.",
        {"expected": "60 minut", "evaluator": "partial_match"},
    )["passed"]
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
        blind = client.get(f"/api/v1/experiments/{run_id}/blind")
        assert blind.status_code == 200
        pair = blind.json()["pairs"][0]
        assert {pair["A"], pair["B"]} == {"Paris", "London"}
        assert "model_key" not in pair
        vote = client.post(
            f"/api/v1/experiments/{run_id}/vote",
            json={"case_id": "prompt-1", "choice": "A"},
        )
        assert vote.status_code == 200
        assert vote.json()["models"]["A"].startswith("ollama:")
        assert vote.json()["votes"]["A"] >= 1
        summary = client.get("/api/v1/operations/summary")
        assert summary.status_code == 200
        assert summary.json()["input_tokens"] >= 20


def test_blind_arena_hides_model_identity_until_vote(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    async def fake_generate(request, _settings):  # type: ignore[no-untyped-def]
        return GenerationResult(
            text="Answer one" if request.model == "alpha" else "Answer two",
            provider="ollama",
            model=request.model,
            mode=ExecutionMode.LOCAL,
            usage=Usage(input_tokens=2, output_tokens=2),
            latency_ms=1,
            fixture=False,
        )

    monkeypatch.setattr(lab_api, "generate", fake_generate)
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/experiments",
            json={
                "model_keys": ["ollama:alpha", "ollama:beta"],
                "prompt": "Answer the question",
                "blind": True,
            },
        )
        assert created.status_code == 202
        run_id = created.json()["id"]
        assert created.json()["model"] == "anonymous"
        for _ in range(100):
            run = client.get(f"/api/v1/experiments/{run_id}").json()
            if run["status"] == "completed":
                break
            time.sleep(0.02)
        assert run["status"] == "completed"
        assert run["results"] == []
        assert "ollama:alpha" not in json.dumps(run)
        assert "ollama:beta" not in json.dumps(run)
        assert client.get(f"/api/v1/runs/{run_id}").json()["model"] == "anonymous"
        pair = client.get(f"/api/v1/experiments/{run_id}/blind").json()["pairs"][0]
        assert {pair["A"], pair["B"]} == {"Answer one", "Answer two"}
        vote = client.post(
            f"/api/v1/experiments/{run_id}/vote",
            json={
                "case_id": "prompt-1",
                "choice": "A",
            },
        )
        assert vote.status_code == 200
        assert set(vote.json()["models"].values()) == {"ollama:alpha", "ollama:beta"}


def test_dataset_retrieval_metrics_use_relevant_document_ids() -> None:
    with TestClient(app) as client:
        dataset = client.post(
            "/api/v1/datasets",
            json={
                "name": "Retrieval cases",
                "cases": [
                    {
                        "id": "return",
                        "input": "Return period?",
                        "relevant_document_ids": ["returns", "policy"],
                        "expected_facts": ["30 days"],
                        "forbidden_facts": ["14 days"],
                        "tags": ["policy"],
                    }
                ],
            },
        )
        assert dataset.status_code == 201
        dataset_id = dataset.json()["id"]
        result = client.post(
            "/api/v1/retrieval-evals",
            json={
                "dataset_id": dataset_id,
                "k": 2,
                "rankings": [{"case_id": "return", "document_ids": ["returns", "shipping"]}],
            },
        )
        assert result.status_code == 200
        assert result.json()["recall_at_k"] == 0.5
        assert result.json()["precision_at_k"] == 0.5
        assert result.json()["mrr"] == 1.0


def test_advanced_evaluators_expose_model_prompt_and_reason(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    async def fake_embed(_request, _settings):  # type: ignore[no-untyped-def]
        return EmbeddingResult(
            vectors=[[1.0, 0.0], [1.0, 0.0]],
            dimensions=2,
            provider="ollama",
            model="embed",
            mode=ExecutionMode.LOCAL,
            usage=Usage(input_tokens=8),
            fixture=False,
        )

    async def fake_generate(_request, _settings):  # type: ignore[no-untyped-def]
        return GenerationResult(
            text='{"score":0.8,"reason":"Supported by the supplied policy"}',
            provider="ollama",
            model="judge",
            mode=ExecutionMode.LOCAL,
            usage=Usage(input_tokens=20, output_tokens=10),
            latency_ms=12,
            fixture=False,
        )

    monkeypatch.setattr(lab_api, "embed", fake_embed)
    monkeypatch.setattr(lab_api, "generate", fake_generate)
    with TestClient(app) as client:
        semantic = client.post(
            "/api/v1/evaluations/advanced",
            json={
                "evaluator": "semantic",
                "answer": "30 days",
                "expected": "30 days",
                "model_key": "ollama:embed",
            },
        )
        assert semantic.status_code == 200
        assert semantic.json()["score"] == 1.0
        grounded = client.post(
            "/api/v1/evaluations/advanced",
            json={
                "evaluator": "groundedness",
                "question": "When?",
                "answer": "30 days",
                "evidence": ["Returns within 30 days"],
                "model_key": "ollama:judge",
            },
        )
        assert grounded.status_code == 200
        assert grounded.json()["score"] == 0.8
        assert "evidence" in grounded.json()["prompt"].lower()
        assert grounded.json()["reason"] == "Supported by the supplied policy"


def test_live_inference_stream_reports_first_chunk_and_usage(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    class FakeResponse:
        is_error = False

        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *_args):  # type: ignore[no-untyped-def]
            return None

        async def aiter_lines(self):  # type: ignore[no-untyped-def]
            yield '{"message":{"content":"Ahoj"},"done":false}'
            yield '{"message":{"content":"!"},"done":false}'
            yield '{"message":{"content":""},"done":true,"prompt_eval_count":7,"eval_count":2}'

    class FakeClient:
        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *_args):  # type: ignore[no-untyped-def]
            return None

        def stream(self, *_args, **_kwargs):  # type: ignore[no-untyped-def]
            return FakeResponse()

    monkeypatch.setattr(inference_api.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/inference/stream",
            json={
                "mode": "local",
                "provider": "ollama",
                "model": "test-model",
                "messages": [{"role": "user", "content": "Hi"}],
            },
        )
        assert response.status_code == 200
        events = [json.loads(line) for line in response.text.splitlines()]
        assert [item["text"] for item in events if item["type"] == "delta"] == ["Ahoj", "!"]
        assert events[-1]["type"] == "done"
        assert events[-1]["input_tokens"] == 7
        assert events[-1]["output_tokens"] == 2
        assert events[-1]["ttft_ms"] is not None
