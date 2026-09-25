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
from .model_catalog import ollama_api_base
from .pricing import estimate_cost
from .secret_settings import resolved_api_key
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
        structured_output=True,
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
        structured_output=True,
        streaming=True,
        tool_calling=True,
        token_usage=True,
    ),
    "gemini": ProviderCapabilities(
        generation=True,
        embeddings=True,
        structured_output=True,
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
            configured=bool(resolved_api_key(settings, "openai")),
            reachable=None,
            detail="Configured by OPENAI_API_KEY"
            if resolved_api_key(settings, "openai")
            else "OPENAI_API_KEY missing",
            default_model="gpt-5.4-mini",
            capabilities=CAPABILITIES["openai"],
        ),
        ProviderView(
            id="anthropic",
            name="Anthropic",
            mode="cloud",
            configured=bool(resolved_api_key(settings, "anthropic")),
            reachable=None,
            detail="Configured by ANTHROPIC_API_KEY"
            if resolved_api_key(settings, "anthropic")
            else "ANTHROPIC_API_KEY missing",
            capabilities=CAPABILITIES["anthropic"],
        ),
        ProviderView(
            id="gemini",
            name="Gemini",
            mode="cloud",
            configured=bool(resolved_api_key(settings, "gemini")),
            reachable=None,
            detail="Configured by GEMINI_API_KEY"
            if resolved_api_key(settings, "gemini")
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
        if request.provider == "ollama":
            result = await _ollama_generation(request, settings)
        elif request.provider in {"openai", "openai_compatible"}:
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
    result.usage.cost_usd = estimate_cost(
        request.provider, request.model, result.usage.input_tokens,
        result.usage.output_tokens, result.usage.cached_tokens,
    )
    if result.applied_settings.get("cache_write_tokens"):
        result.usage.cost_usd = None
    if request.provider not in {"ollama", "fixture"} and not result.applied_settings.get(
        "usage_reported", False
    ):
        result.usage.cost_usd = None
    return result


async def embed(request: EmbeddingRequest, settings: Settings) -> EmbeddingResult:
    if request.mode is ExecutionMode.FIXTURE:
        return fixture_embeddings(request.inputs)
    _require(request.provider, "embeddings")
    if request.provider == "ollama":
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(
                    f"{ollama_api_base(settings)}/api/embed",
                    json={"model": request.model, "input": request.inputs},
                )
                _raise_provider_error(response)
                body = _response_json(response)
        except httpx.RequestError as exc:
            raise HTTPException(502, f"Could not reach Ollama: {type(exc).__name__}") from exc
        vectors = body.get("embeddings", [])
        if len(vectors) != len(request.inputs) or not vectors:
            raise HTTPException(502, "Ollama returned an unexpected embedding count")
        return EmbeddingResult(
            vectors=vectors, dimensions=len(vectors[0]), provider="ollama",
            model=request.model, mode=request.mode,
            usage=Usage(input_tokens=int(body.get("prompt_eval_count", 0)), cost_usd=0),
            fixture=False,
        )
    if request.provider == "gemini":
        api_key = resolved_api_key(settings, "gemini")
        if not api_key:
            raise HTTPException(409, "GEMINI_API_KEY is not configured")
        model_path = f"models/{request.model}"
        payload = {"requests": [
            {"model": model_path, "content": {"parts": [{"text": item}]}}
            for item in request.inputs
        ]}
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/{model_path}:batchEmbedContents",
                    headers={"x-goog-api-key": api_key}, json=payload,
                )
                _raise_provider_error(response)
                body = _response_json(response)
        except httpx.RequestError as exc:
            raise HTTPException(502, f"Could not reach Gemini: {type(exc).__name__}") from exc
        vectors = [item.get("values", []) for item in body.get("embeddings", [])]
        if len(vectors) != len(request.inputs) or not vectors:
            raise HTTPException(502, "Gemini returned an unexpected embedding count")
        usage_body = body.get("usageMetadata", {})
        input_tokens = int(usage_body.get("totalTokenCount", 0))
        return EmbeddingResult(
            vectors=vectors, dimensions=len(vectors[0]), provider="gemini",
            model=request.model, mode=request.mode,
            usage=Usage(input_tokens=input_tokens,
                        cost_usd=estimate_cost("gemini", request.model, input_tokens)),
            fixture=False,
        )
    if request.provider not in {"openai", "openai_compatible"}:
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
        usage=Usage(input_tokens=prompt_tokens,
                    cost_usd=estimate_cost(request.provider, request.model, prompt_tokens)),
        fixture=False,
    )


def _stops(request: GenerationRequest) -> list[str]:
    return [*request.stop, *([request.stop_sequence] if request.stop_sequence else [])]


async def _ollama_generation(request: GenerationRequest, settings: Settings) -> GenerationResult:
    options: dict[str, Any] = {
        "temperature": request.temperature,
        "top_p": request.top_p,
        "num_predict": request.max_tokens,
    }
    stops = _stops(request)
    if stops:
        options["stop"] = stops
    if request.seed is not None:
        options["seed"] = request.seed
    payload: dict[str, Any] = {
        "model": request.model,
        "messages": request.messages,
        "stream": False,
        "think": False,
        "options": options,
    }
    if request.response_schema is not None:
        payload["format"] = request.response_schema
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(f"{ollama_api_base(settings)}/api/chat", json=payload)
        _raise_provider_error(response)
        body = _response_json(response)
    return GenerationResult(
        text=str(body.get("message", {}).get("content", "")),
        provider="ollama", model=request.model, mode=request.mode,
        usage=Usage(
            input_tokens=int(body.get("prompt_eval_count", 0)),
            output_tokens=int(body.get("eval_count", 0)),
            cached_tokens=int(body.get("prompt_eval_cached_count", 0)),
            cost_usd=0,
        ), latency_ms=0, fixture=False,
        applied_settings={"temperature": request.temperature, "top_p": request.top_p,
                          "max_tokens": request.max_tokens, "stop": stops,
                          "response_schema": request.response_schema is not None,
                          "think": False},
    )


async def _openai_compatible_generation(
    request: GenerationRequest, settings: Settings
) -> GenerationResult:
    base_url, api_key = _openai_base_and_key(request.provider, settings)
    stops = _stops(request)
    applied: dict[str, Any] = {"max_tokens": request.max_tokens}
    if request.provider == "openai":
        if stops:
            raise HTTPException(
                422, "Stop sequences are not supported by the OpenAI Responses adapter"
            )
        payload: dict[str, Any] = {
            "model": request.model, "input": request.messages,
            "max_output_tokens": request.max_tokens,
        }
        # Reasoning models can reject sampling controls; report only the controls sent.
        if not request.model.startswith(("gpt-5", "gpt-6", "o1", "o3", "o4")):
            payload["temperature"] = request.temperature
            payload["top_p"] = request.top_p
            applied.update(temperature=request.temperature, top_p=request.top_p)
        if request.response_schema:
            payload["text"] = {
                "format": {
                    "type": "json_schema",
                    "name": "llmlab_output",
                    "strict": True,
                    "schema": request.response_schema,
                }
            }
            applied["response_schema"] = True
        endpoint = "/responses"
    else:
        payload = {
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "max_tokens": request.max_tokens,
            "stream": False,
        }
        if stops:
            payload["stop"] = stops
        if request.response_schema:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "llmlab_output", "schema": request.response_schema},
            }
        applied.update(temperature=request.temperature, top_p=request.top_p,
                       stop=stops, response_schema=request.response_schema is not None)
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
        cached_tokens = int(usage_body.get("input_tokens_details", {}).get("cached_tokens", 0))
    else:
        text = body["choices"][0]["message"].get("content", "")
        usage_body = body.get("usage", {})
        input_tokens = int(usage_body.get("prompt_tokens", 0))
        output_tokens = int(usage_body.get("completion_tokens", 0))
        cached_tokens = int(usage_body.get("prompt_tokens_details", {}).get("cached_tokens", 0))
    applied["usage_reported"] = "usage" in body
    return GenerationResult(
        text=text,
        provider=request.provider,
        model=request.model,
        mode=request.mode,
        usage=Usage(input_tokens=input_tokens, output_tokens=output_tokens,
                    cached_tokens=cached_tokens),
        latency_ms=0,
        fixture=False,
        applied_settings=applied,
    )


async def _anthropic_generation(request: GenerationRequest, settings: Settings) -> GenerationResult:
    api_key = resolved_api_key(settings, "anthropic")
    if not api_key:
        raise HTTPException(409, "ANTHROPIC_API_KEY is not configured")
    system = "\n".join(item["content"] for item in request.messages if item.get("role") == "system")
    messages = [item for item in request.messages if item.get("role") != "system"]
    payload = {
        "model": request.model,
        "max_tokens": request.max_tokens,
        "messages": messages,
        "system": system,
    }
    applied: dict[str, Any] = {"max_tokens": request.max_tokens}
    if not any(f"-{version}" in request.model for version in ("4-7", "4-8", "5-", "5.")):
        if request.temperature > 1:
            raise HTTPException(422, "Anthropic temperature must not exceed 1")
        payload["temperature"] = request.temperature
        payload["top_p"] = request.top_p
        applied.update(temperature=request.temperature, top_p=request.top_p)
    stops = _stops(request)
    if stops:
        payload["stop_sequences"] = stops
        applied["stop"] = stops
    if request.response_schema:
        payload["output_config"] = {
            "format": {"type": "json_schema", "schema": request.response_schema}
        }
        applied["response_schema"] = True
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            json=payload,
        )
        _raise_provider_error(response)
        body = _response_json(response)
    text = "".join(
        item.get("text", "") for item in body.get("content", []) if item.get("type") == "text"
    )
    usage_body = body.get("usage", {})
    cache_read = int(usage_body.get("cache_read_input_tokens", 0))
    cache_write = int(usage_body.get("cache_creation_input_tokens", 0))
    if cache_write:
        applied["cache_write_tokens"] = cache_write
    applied["usage_reported"] = "usage" in body
    return GenerationResult(
        text=text,
        provider="anthropic",
        model=request.model,
        mode=request.mode,
        usage=Usage(
            input_tokens=int(usage_body.get("input_tokens", 0)) + cache_read + cache_write,
            output_tokens=int(usage_body.get("output_tokens", 0)),
            cached_tokens=cache_read,
        ),
        latency_ms=0,
        fixture=False,
        applied_settings=applied,
    )


async def _gemini_generation(request: GenerationRequest, settings: Settings) -> GenerationResult:
    api_key = resolved_api_key(settings, "gemini")
    if not api_key:
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
        "generationConfig": {
            "temperature": request.temperature, "topP": request.top_p,
            "maxOutputTokens": request.max_tokens,
        },
    }
    stops = _stops(request)
    if len(stops) > 5:
        raise HTTPException(422, "Gemini supports at most five stop sequences")
    if stops:
        payload["generationConfig"]["stopSequences"] = stops
    if request.response_schema:
        payload["generationConfig"]["responseFormat"] = {
            "text": {"mimeType": "APPLICATION_JSON", "schema": request.response_schema}
        }
    system = "\n".join(item["content"] for item in request.messages if item.get("role") == "system")
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{request.model}:generateContent",
            headers={"x-goog-api-key": api_key},
            json=payload,
        )
        _raise_provider_error(response)
        body = _response_json(response)
    candidates = body.get("candidates", [])
    text = (
        "".join(part.get("text", "") for part in candidates[0]["content"]["parts"])
        if candidates else ""
    )
    usage = body.get("usageMetadata", {})
    return GenerationResult(
        text=text,
        provider="gemini",
        model=request.model,
        mode=request.mode,
        usage=Usage(
            input_tokens=int(usage.get("promptTokenCount", 0)),
            output_tokens=int(usage.get("candidatesTokenCount", 0))
            + int(usage.get("thoughtsTokenCount", 0)),
            cached_tokens=int(usage.get("cachedContentTokenCount", 0)),
        ),
        latency_ms=0,
        fixture=False,
        applied_settings={"temperature": request.temperature, "top_p": request.top_p,
                          "max_tokens": request.max_tokens, "stop": stops,
                          "response_schema": request.response_schema is not None,
                          "usage_reported": "usageMetadata" in body},
    )


def _openai_base_and_key(provider: str, settings: Settings) -> tuple[str, str]:
    values = {
        "openai": ("https://api.openai.com/v1", resolved_api_key(settings, "openai")),
        "openai_compatible": (
            settings.openai_compatible_base_url,
            resolved_api_key(settings, "openai_compatible") or "not-required",
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
