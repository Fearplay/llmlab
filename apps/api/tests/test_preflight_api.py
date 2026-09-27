import pytest

from llmlab_api import preflight_api
from llmlab_api.settings import Settings


@pytest.mark.asyncio
async def test_preflight_distinguishes_provider_and_model_failures(monkeypatch) -> None:
    async def catalog(_settings, refresh=False):
        assert refresh is True
        return {
            "providers": [{"id": "ollama", "reachable": False, "detail": "connection refused"}],
            "models": [{"key": "ollama:embed", "available": True,
                        "capabilities": {"generation": False, "embeddings": True}}],
        }

    monkeypatch.setattr(preflight_api, "discover_models", catalog)
    result = await preflight_api.preflight(
        generation_model_key="ollama:embed", embedding_model_key="ollama:missing",
        settings=Settings(),
    )
    assert result["api"]["status"] == "ready"
    assert result["ollama"]["status"] == "unavailable"
    assert result["generation"]["status"] == "wrong_capability"
    assert result["embedding"]["status"] == "unavailable"
