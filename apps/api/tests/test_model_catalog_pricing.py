import httpx
import pytest
import respx

from llmlab_api.model_catalog import _CACHE, discover_models
from llmlab_api.pricing import estimate_cost, price_catalog
from llmlab_api.settings import Settings


@pytest.mark.asyncio
@respx.mock
async def test_ollama_catalog_uses_native_capabilities_and_cache() -> None:
    tags = respx.get("http://ollama.test/api/tags").mock(
        return_value=httpx.Response(200, json={"models": [
            {"name": "qwen:7b"}, {"name": "nomic-embed:latest"}
        ]})
    )
    respx.post("http://ollama.test/api/show").mock(side_effect=[
        httpx.Response(200, json={"capabilities": ["completion", "vision"],
                                  "model_info": {"qwen.context_length": 8192}}),
        httpx.Response(200, json={"capabilities": ["embedding"]}),
    ])
    settings = Settings(ollama_base_url="http://ollama.test/v1",
                        openai_api_key="", anthropic_api_key="", gemini_api_key="")
    _CACHE.clear()
    first = await discover_models(settings)
    second = await discover_models(settings)
    assert tags.call_count == 1
    assert first == second
    assert first["models"][0]["key"] == "ollama:nomic-embed:latest"
    models = {item["id"]: item for item in first["models"]}
    assert models["qwen:7b"]["capabilities"]["vision"] is True
    assert models["qwen:7b"]["context_window"] == 8192
    assert models["nomic-embed:latest"]["capabilities"]["generation"] is False


@pytest.mark.asyncio
@respx.mock
async def test_cloud_catalog_reports_network_failure_without_exposing_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("llmlab_api.secret_settings._keyring", lambda: None)
    respx.get("https://api.openai.com/v1/models").mock(
        side_effect=httpx.ConnectError("proxy rejected connection")
    )
    _CACHE.clear()
    catalog = await discover_models(Settings(ollama_base_url="", openai_api_key="test-secret"))
    openai = next(item for item in catalog["providers"] if item["id"] == "openai")
    assert openai["configured"] is True
    assert openai["reachable"] is False
    assert "network or proxy settings" in openai["detail"]
    assert "test-secret" not in openai["detail"]


@pytest.mark.asyncio
@respx.mock
async def test_cloud_catalog_distinguishes_invalid_key_from_connection_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("llmlab_api.secret_settings._keyring", lambda: None)
    respx.get("https://api.openai.com/v1/models").mock(return_value=httpx.Response(401))
    _CACHE.clear()
    catalog = await discover_models(Settings(ollama_base_url="", openai_api_key="test-secret"))
    openai = next(item for item in catalog["providers"] if item["id"] == "openai")
    assert openai["detail"] == "HTTP 401: check the API key"


def test_price_catalog_is_conservative() -> None:
    assert estimate_cost("ollama", "qwen:7b", 1000, 1000) == 0
    assert estimate_cost("openai", "unknown-model", 1000, 1000) is None
    assert estimate_cost("openai", "gpt-6-luna", 1_000_000, 1_000_000) == 0.95
    assert estimate_cost("anthropic", "claude-sonnet-4-6", 1000, 1000) == 0.018
    catalog = price_catalog()
    assert catalog["prices"]["anthropic:claude-sonnet-4-6"]["source"].startswith("https://")
