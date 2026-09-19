import time
from typing import Any

import httpx
from fastapi import HTTPException

from .contracts import (
    EmbeddingRequest,
    EmbeddingResult,
    ExecutionMode,
    GenerationRequest,
    GenerationResult,
    ProviderCapabilities,
    ProviderView,
    Usage,
)
from .fixture import fixture_embeddings, fixture_generation
from .settings import Settings

CAPABILITIES = {
    "fixture": ProviderCapabilities(
        generation=True,
        embeddings=True,
        structured_output=True,
        streaming=True,
        tool_calling=True,
        token_usage=True,
    ),
    "ollama": ProviderCapabilities(
        generation=True,
        embeddings=True,
        structured_output=False,
        streaming=True,
        tool_calling=True,
        token_usage=True,
    ),
    "openai": ProviderCapabilities(
        generation=True,
        embeddings=True,
        structured_output=True,
        streaming=True,
        tool_calling=True,
        token_usage=True,
    ),
    "anthropic": ProviderCapabilities(
        generation=True,
        embeddings=False,
        structured_output=False,
        streaming=True,
        tool_calling=True,
        token_usage=True,
    ),
    "gemini": ProviderCapabilities(
        generation=True,
        embeddings=True,
        structured_output=False,
        streaming=True,
        tool_calling=True,
        token_usage=True,
    ),
    "openai_compatible": ProviderCapabilities(
        generation=True,
        embeddings=True,
        structured_output=False,
        streaming=True,
        tool_calling=False,
        token_usage=True,
    ),
}


def provider_views(settings: Settings) -> list[ProviderView]:
    return [
        ProviderView(
            id="fixture",
            name="Fixture engine",
            mode="local",
            configured=True,
            reachable=True,
            detail="Deterministic seeded outputs",
            default_model="fixture-gen-v2",
            capabilities=CAPABILITIES["fixture"],
        ),
        ProviderView(
            id="ollama",
            name="Ollama",
            mode="local",
            configured=True,
            reachable=None,
            detail=settings.ollama_base_url,
            default_model=settings.rag_local_model,
            capabilities=CAPABILITIES["ollama"],
        ),
        ProviderView(
            id="openai",
            name="OpenAI",
            mode="cloud",
            configured=bool(settings.openai_api_key),
            reachable=None,
            detail="Configured by OPENAI_API_KEY"
            if settings.openai_api_key
            else "OPENAI_API_KEY missing",
            default_model="gpt-5.4-mini",
            capabilities=CAPABILITIES["openai"],
        ),
        ProviderView(
            id="anthropic",
            name="Anthropic",
            mode="cloud",
            configured=bool(settings.anthropic_api_key),
            reachable=None,
            detail="Configured by ANTHROPIC_API_KEY"
            if settings.anthropic_api_key
            else "ANTHROPIC_API_KEY missing",
            capabilities=CAPABILITIES["anthropic"],
        ),
        ProviderView(
            id="gemini",
            name="Gemini",
            mode="cloud",
            configured=bool(settings.gemini_api_key),
            reachable=None,
            detail="Configured by GEMINI_API_KEY"
            if settings.gemini_api_key
            else "GEMINI_API_KEY missing",
            capabilities=CAPABILITIES["gemini"],
        ),
        ProviderView(
            id="openai_compatible",
            name="OpenAI-compatible",
            mode="cloud",
            configured=bool(settings.openai_compatible_base_url),
            reachable=None,
            detail=settings.openai_compatible_base_url or "Base URL missing",
            capabilities=CAPABILITIES["openai_compatible"],
        ),
    ]


async def generate(request: GenerationRequest, settings: Settings) -> GenerationResult:
    if request.mode is ExecutionMode.FIXTURE:
        return fixture_generation(request.messages, request.response_schema is not None)
    _require(request.provider, "generation")
    start = time.perf_counter()
    try:
        if request.provider in {"openai", "ollama", "openai_compatible"}:
            result = await _openai_compatible_generation(request, settings)
        elif request.provider == "anthropic":
            result = await _anthropic_generation(request, settings)
        elif request.provider == "gemini":
            result = await _gemini_generation(request, settings)
        else:
            raise HTTPException(400, f"Unknown provider: {request.provider}")
    except httpx.RequestError as exc:
        raise HTTPException(
            502,
            f"Could not reach provider {request.provider}: {type(exc).__name__}",
        ) from exc
    result.latency_ms = round((time.perf_counter() - start) * 1000)
    return result


async def embed(request: EmbeddingRequest, settings: Settings) -> EmbeddingResult:
    if request.mode is ExecutionMode.FIXTURE:
        return fixture_embeddings(request.inputs)
    _require(request.provider, "embeddings")
    if request.provider not in {"openai", "ollama", "openai_compatible"}:
        raise HTTPException(
            501, "This adapter does not expose embeddings yet; capability is not emulated."
        )
    base_url, api_key = _openai_base_and_key(request.provider, settings)
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{base_url.rstrip('/')}/embeddings",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": request.model, "input": request.inputs},
            )
            _raise_provider_error(response)
            body = _response_json(response)
    except httpx.RequestError as exc:
        raise HTTPException(
            502,
            f"Could not reach provider {request.provider}: {type(exc).__name__}",
        ) from exc
    vectors = [item["embedding"] for item in body["data"]]
    prompt_tokens = int(body.get("usage", {}).get("prompt_tokens", 0))
    return EmbeddingResult(
        vectors=vectors,
        dimensions=len(vectors[0]),
        provider=request.provider,
        model=request.model,
        mode=request.mode,
        usage=Usage(input_tokens=prompt_tokens),
        fixture=False,
    )


async def _openai_compatible_generation(
    request: GenerationRequest, settings: Settings
) -> GenerationResult:
    base_url, api_key = _openai_base_and_key(request.provider, settings)
    if request.provider == "openai":
        payload: dict[str, Any] = {"model": request.model, "input": request.messages}
        if request.response_schema:
            payload["text"] = {
                "format": {
                    "type": "json_schema",
                    "name": "llmlab_output",
                    "strict": True,
                    "schema": request.response_schema,
                }
            }
        endpoint = "/responses"
    else:
        payload = {
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": False,
        }
        endpoint = "/chat/completions"
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            f"{base_url.rstrip('/')}{endpoint}",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        )
        _raise_provider_error(response)
        body = _response_json(response)
    if request.provider == "openai":
        text = body.get("output_text") or "".join(
            part.get("text", "")
            for item in body.get("output", [])
            for part in item.get("content", [])
            if part.get("type") == "output_text"
        )
        usage_body = body.get("usage", {})
        input_tokens = int(usage_body.get("input_tokens", 0))
        output_tokens = int(usage_body.get("output_tokens", 0))
    else:
        text = body["choices"][0]["message"].get("content", "")
        usage_body = body.get("usage", {})
        input_tokens = int(usage_body.get("prompt_tokens", 0))
        output_tokens = int(usage_body.get("completion_tokens", 0))
    return GenerationResult(
        text=text,
        provider=request.provider,
        model=request.model,
        mode=request.mode,
        usage=Usage(input_tokens=input_tokens, output_tokens=output_tokens),
        latency_ms=0,
        fixture=False,
    )


async def _anthropic_generation(request: GenerationRequest, settings: Settings) -> GenerationResult:
    if not settings.anthropic_api_key:
        raise HTTPException(409, "ANTHROPIC_API_KEY is not configured")
    system = "\n".join(item["content"] for item in request.messages if item.get("role") == "system")
    messages = [item for item in request.messages if item.get("role") != "system"]
    payload = {
        "model": request.model,
        "max_tokens": 1024,
        "messages": messages,
        "temperature": request.temperature,
        "system": system,
    }
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": settings.anthropic_api_key, "anthropic-version": "2023-06-01"},
            json=payload,
        )
        _raise_provider_error(response)
        body = _response_json(response)
    text = "".join(
        item.get("text", "") for item in body.get("content", []) if item.get("type") == "text"
    )
    return GenerationResult(
        text=text,
        provider="anthropic",
        model=request.model,
        mode=request.mode,
        usage=Usage(
            input_tokens=int(body.get("usage", {}).get("input_tokens", 0)),
            output_tokens=int(body.get("usage", {}).get("output_tokens", 0)),
        ),
        latency_ms=0,
        fixture=False,
    )


async def _gemini_generation(request: GenerationRequest, settings: Settings) -> GenerationResult:
    if not settings.gemini_api_key:
        raise HTTPException(409, "GEMINI_API_KEY is not configured")
    contents = [
        {
            "role": "model" if item.get("role") == "assistant" else "user",
            "parts": [{"text": item.get("content", "")}],
        }
        for item in request.messages
        if item.get("role") != "system"
    ]
    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": request.temperature, "topP": request.top_p},
    }
    system = "\n".join(item["content"] for item in request.messages if item.get("role") == "system")
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{request.model}:generateContent",
            headers={"x-goog-api-key": settings.gemini_api_key},
            json=payload,
        )
        _raise_provider_error(response)
        body = _response_json(response)
    text = "".join(part.get("text", "") for part in body["candidates"][0]["content"]["parts"])
    usage = body.get("usageMetadata", {})
    return GenerationResult(
        text=text,
        provider="gemini",
        model=request.model,
        mode=request.mode,
        usage=Usage(
            input_tokens=int(usage.get("promptTokenCount", 0)),
            output_tokens=int(usage.get("candidatesTokenCount", 0)),
        ),
        latency_ms=0,
        fixture=False,
    )


def _openai_base_and_key(provider: str, settings: Settings) -> tuple[str, str]:
    values = {
        "openai": ("https://api.openai.com/v1", settings.openai_api_key),
        "ollama": (settings.ollama_base_url, "ollama"),
        "openai_compatible": (
            settings.openai_compatible_base_url,
            settings.openai_compatible_api_key or "not-required",
        ),
    }
    base_url, api_key = values[provider]
    if not base_url or (provider == "openai" and not api_key):
        raise HTTPException(409, f"{provider} is not configured")
    return base_url, api_key


def _require(provider: str, capability: str) -> None:
    available = CAPABILITIES.get(provider)
    if not available:
        raise HTTPException(400, f"Unknown provider: {provider}")
    if not getattr(available, capability):
        raise HTTPException(422, f"Provider {provider} does not support {capability}")


def _raise_provider_error(response: httpx.Response) -> None:
    if response.is_error:
        provider_message = ""
        try:
            payload = response.json()
            if isinstance(payload, dict):
                error = payload.get("error")
                if isinstance(error, dict) and isinstance(error.get("message"), str):
                    provider_message = error["message"]
                elif isinstance(payload.get("detail"), str):
                    provider_message = payload["detail"]
        except ValueError:
            provider_message = response.text
        detail = f"Provider request failed ({response.status_code})"
        if provider_message:
            detail = f"{detail}: {provider_message[:400]}"
        raise HTTPException(response.status_code, detail)


def _response_json(response: httpx.Response) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError as exc:
        raise HTTPException(502, "Provider returned invalid JSON") from exc
    if not isinstance(body, dict):
        raise HTTPException(502, "Provider returned an unexpected JSON shape")
    return body
