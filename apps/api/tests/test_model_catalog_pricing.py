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


def test_price_catalog_is_conservative() -> None:
    assert estimate_cost("ollama", "qwen:7b", 1000, 1000) == 0
    assert estimate_cost("openai", "unknown-model", 1000, 1000) is None
    assert estimate_cost("openai", "gpt-6-luna", 1_000_000, 1_000_000) == 0.95
    assert estimate_cost("anthropic", "claude-sonnet-4-6", 1000, 1000) == 0.018
    catalog = price_catalog()
    assert catalog["prices"]["anthropic:claude-sonnet-4-6"]["source"].startswith("https://")
