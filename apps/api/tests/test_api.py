import os

os.environ["DATABASE_URL"] = "sqlite:///./test-llmlab.db"

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
                "messages": [{"role": "user", "content": "Can I return worn footwear?"}],
            },
        )
        assert generation.status_code == 200
        assert generation.json()["fixture"] is True

        rag = client.post(
            "/api/v1/rag/run",
            json={"question": "What is the footwear return window?", "mode": "fixture"},
        )
        assert rag.status_code == 200
        assert rag.json()["chunks"]

        invalid_cloud_training = client.post(
            "/api/v1/training/run", json={"mode": "cloud", "epochs": 3}
        )
        assert invalid_cloud_training.status_code == 422
