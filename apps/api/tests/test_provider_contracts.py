import json

import httpx
import pytest
import respx
from fastapi import HTTPException

from llmlab_api.contracts import EmbeddingRequest, ExecutionMode, GenerationRequest
from llmlab_api.providers import embed, generate, provider_views
from llmlab_api.settings import Settings


def request(provider: str, model: str) -> GenerationRequest:
    return GenerationRequest(
        mode=ExecutionMode.LOCAL if provider == "ollama" else ExecutionMode.CLOUD,
        provider=provider,
        model=model,
        messages=[{"role": "user", "content": "Hello"}],
    )


@pytest.mark.asyncio
@respx.mock
async def test_openai_responses_contract() -> None:
    respx.post("https://api.openai.com/v1/responses").mock(
        return_value=httpx.Response(
            200,
            json={"output_text": "ok", "usage": {"input_tokens": 4, "output_tokens": 2}},
        )
    )
    result = await generate(request("openai", "gpt-test"), Settings(openai_api_key="test"))
    assert result.text == "ok"
    assert result.usage.input_tokens == 4
    assert not result.fixture


@pytest.mark.asyncio
@respx.mock
async def test_openai_connection_failure_is_a_json_safe_gateway_error() -> None:
    respx.post("https://api.openai.com/v1/responses").mock(
        side_effect=httpx.ConnectError("network unavailable")
    )
    with pytest.raises(HTTPException) as caught:
        await generate(request("openai", "gpt-test"), Settings(openai_api_key="test"))
    assert getattr(caught.value, "status_code", None) == 502
    assert "ConnectError" in getattr(caught.value, "detail", "")


@pytest.mark.asyncio
@respx.mock
async def test_anthropic_messages_contract() -> None:
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(
            200,
            json={
                "content": [{"type": "text", "text": "ok"}],
                "usage": {"input_tokens": 4, "output_tokens": 2},
            },
        )
    )
    result = await generate(request("anthropic", "claude-test"), Settings(anthropic_api_key="test"))
    assert result.text == "ok"
    assert result.provider == "anthropic"


@pytest.mark.asyncio
@respx.mock
async def test_gemini_generate_content_contract() -> None:
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent"
    respx.post(url).mock(
        return_value=httpx.Response(
            200,
            json={
                "candidates": [{"content": {"parts": [{"text": "ok"}]}}],
                "usageMetadata": {"promptTokenCount": 4, "candidatesTokenCount": 2},
            },
        )
    )
    result = await generate(request("gemini", "gemini-test"), Settings(gemini_api_key="test"))
    assert result.text == "ok"
    assert result.usage.output_tokens == 2


@pytest.mark.asyncio
@respx.mock
async def test_ollama_native_contract() -> None:
    route = respx.post("http://ollama.test/api/chat").mock(
        return_value=httpx.Response(
            200,
            json={
                "message": {"content": "local ok"},
                "prompt_eval_count": 4, "eval_count": 2,
            },
        )
    )
    result = await generate(
        request("ollama", "local-test"), Settings(ollama_base_url="http://ollama.test/v1")
    )
    assert result.text == "local ok"
    assert result.mode is ExecutionMode.LOCAL
    assert result.usage.input_tokens == 4
    assert result.usage.cost_usd == 0
    payload = json.loads(route.calls[0].request.content)
    assert payload["think"] is False
    assert payload["options"]["num_predict"] == 512


@pytest.mark.asyncio
@respx.mock
async def test_ollama_native_embeddings() -> None:
    respx.post("http://ollama.test/api/embed").mock(return_value=httpx.Response(
        200, json={"embeddings": [[0.1, 0.2]], "prompt_eval_count": 3}
    ))
    result = await embed(
        EmbeddingRequest(mode=ExecutionMode.LOCAL, provider="ollama", model="embed:1",
                         inputs=["hello"]),
        Settings(ollama_base_url="http://ollama.test/v1"),
    )
    assert result.dimensions == 2
    assert result.usage.input_tokens == 3


def test_capability_matrix_does_not_invent_anthropic_embeddings() -> None:
    records = {record.id: record for record in provider_views(Settings(openai_api_key=""))}
    assert records["anthropic"].capabilities.embeddings is False
    assert records["openai"].configured is False
