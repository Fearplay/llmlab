from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from llmlab_api import user_rag_api
from llmlab_api.contracts import EmbeddingResult, ExecutionMode, GenerationResult, Usage
from llmlab_api.database import get_db
from llmlab_api.models import Base
from llmlab_api.settings import Settings, get_settings


def test_upload_search_answer_and_delete(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    app = FastAPI()
    app.include_router(user_rag_api.router)

    def session() -> Iterator[Session]:
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = session
    app.dependency_overrides[get_settings] = lambda: Settings(
        ollama_base_url="http://ollama.test/v1", openai_api_key="",
        anthropic_api_key="", gemini_api_key="",
    )

    async def valid(*args: object, **kwargs: object) -> None:
        return None

    async def fake_embed(request: object, settings: object) -> EmbeddingResult:
        inputs = request.inputs  # type: ignore[attr-defined]
        vectors = [[1.0, 0.0] if "refund" in item.lower() else [0.0, 1.0]
                   for item in inputs]
        return EmbeddingResult(vectors=vectors, dimensions=2, provider="ollama",
                               model="embed:1", mode=ExecutionMode.LOCAL,
                               usage=Usage(input_tokens=5), fixture=False)

    async def fake_generate(request: object, settings: object) -> GenerationResult:
        return GenerationResult(text="Refund is within 30 days [1].", provider="ollama",
                                model="qwen:7b", mode=ExecutionMode.LOCAL,
                                usage=Usage(input_tokens=40, output_tokens=10),
                                latency_ms=20, fixture=False)

    monkeypatch.setattr(user_rag_api, "_validate_model", valid)
    monkeypatch.setattr(user_rag_api, "embed", fake_embed)
    monkeypatch.setattr(user_rag_api, "generate", fake_generate)
    with TestClient(app) as client:
        upload = client.post("/api/v1/user-documents", data={
            "strategy": "paragraph", "chunk_size": "40", "overlap": "0",
            "embedding_model_key": "ollama:embed:1",
        }, files={"file": ("policy.md", b"Refund within 30 days.\n\nShipping in 7 days.")})
        assert upload.status_code == 201, upload.text
        document = upload.json()["document"]
        assert document["chunk_count"] == 2
        chunks = client.get(f"/api/v1/user-documents/{document['id']}/chunks").json()["chunks"]
        assert len(chunks) == 2
        answer = client.post("/api/v1/user-rag/ask", json={
            "question": "What is the refund period?", "generation_model_key": "ollama:qwen:7b",
            "document_ids": [document["id"]], "bm25_rerank": True,
        })
        assert answer.status_code == 200, answer.text
        body = answer.json()
        assert body["grounded"] is True
        assert body["citations"][0]["chunk_id"] == chunks[0]["id"]
        assert body["run_id"].startswith("run_")
        assert client.delete(f"/api/v1/user-documents/{document['id']}").status_code == 204
        assert client.get("/api/v1/user-documents").json()["documents"] == []


@pytest.mark.asyncio
async def test_chunk_methods_are_distinct(monkeypatch: pytest.MonkeyPatch) -> None:
    text = "First sentence. Second sentence.\n\nAnother paragraph is here."

    async def fake_embeddings(
        texts: list[str], model: str, settings: Settings
    ) -> list[list[float]]:
        return [[1.0, 0.0], [0.0, 1.0], [1.0, 0.0]]

    monkeypatch.setattr(user_rag_api, "_embed_texts", fake_embeddings)
    settings = Settings()
    lengths = {}
    for strategy in ("fixed", "sentence", "paragraph", "semantic"):
        chunks = await user_rag_api._chunk_slices(text, strategy, 40, 0, "ollama:embed:1",
                                                   settings)
        lengths[strategy] = len(chunks)
        assert all(text[item.start:item.end].strip() for item in chunks)
    assert lengths["paragraph"] == 2
    assert lengths["semantic"] >= lengths["paragraph"]
