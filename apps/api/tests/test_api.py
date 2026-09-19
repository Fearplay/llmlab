import os

os.environ["DATABASE_URL"] = "sqlite:///./test-llmlab.db"
os.environ["RAG_EMBEDDING_MODEL"] = "llmlab/multilingual-hash-v1"

from fastapi.testclient import TestClient  # noqa: E402

from llmlab_api.main import app  # noqa: E402


def test_fixture_api_flow() -> None:
    with TestClient(app) as client:
        assert client.get("/health/ready").status_code == 200
        providers = client.get("/api/v1/providers")
        assert providers.status_code == 200
        assert providers.json()[0]["id"] == "fixture"

        generation = client.post(
            "/api/v1/generation",
            json={
                "mode": "fixture",
                "messages": [{"role": "user", "content": "Show a deterministic fixture."}],
            },
        )
        assert generation.status_code == 200
        assert generation.json()["fixture"] is True

        rag = client.post(
            "/api/v1/rag/run",
            json={"question": "How quickly are approved refunds processed?", "mode": "fixture"},
        )
        assert rag.status_code == 200
        assert rag.json()["results"]
        assert rag.json()["sources"][0]["path"] == "knowledge/en/returns.md"

        status = client.get("/api/v1/rag/status")
        assert status.status_code == 200
        assert status.json()["document_count"] == 16

        search = client.post(
            "/api/v1/rag/search",
            json={"question": "Jak dlouho můžu vrátit běžné zařízení?", "top_k": 3},
        )
        assert search.status_code == 200
        assert search.json()["query_language"] == "cs"

        invalid_cloud_training = client.post(
            "/api/v1/training/run", json={"mode": "cloud", "epochs": 3}
        )
        assert invalid_cloud_training.status_code == 422
