"""Live provider-native model discovery with a short cache and explicit availability."""

import asyncio
import hashlib
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends

from .secret_settings import resolved_api_key
from .settings import Settings, get_settings

router = APIRouter(prefix="/api/v1", tags=["models"])
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
TTL_SECONDS = 60


def ollama_api_base(settings: Settings) -> str:
    base = settings.ollama_base_url.rstrip("/")
    return base[:-3] if base.endswith("/v1") else base


def _model(
    provider: str, model_id: str, mode: str, generation: bool, embeddings: bool,
    *, vision: bool = False, structured_output: bool = False,
    context_window: int | None = None,
) -> dict[str, Any]:
    return {
        "key": f"{provider}:{model_id}", "provider": provider, "id": model_id,
        "mode": mode, "capabilities": {
            "generation": generation, "embeddings": embeddings, "vision": vision,
            "structured_output": structured_output,
        }, "available": True, "context_window": context_window,
    }


async def _ollama(client: httpx.AsyncClient, settings: Settings) -> list[dict[str, Any]]:
    base = ollama_api_base(settings)
    response = await client.get(f"{base}/api/tags")
    response.raise_for_status()
    records = response.json().get("models", [])
    result: list[dict[str, Any]] = []
    for record in records:
        model_id = record.get("name") or record.get("model")
        if not isinstance(model_id, str) or not model_id:
            continue
        try:
            detail_response = await client.post(f"{base}/api/show", json={"model": model_id})
            detail_response.raise_for_status()
            detail = detail_response.json()
        except (httpx.HTTPError, ValueError):
            detail = {}
        capabilities = detail.get("capabilities", [])
        # Missing /api/show capabilities is unknown, not proof of generation support.
        generation = "completion" in capabilities
        embeddings = "embedding" in capabilities
        vision = "vision" in capabilities
        model_info = detail.get("model_info") or {}
        context = next(
            (value for key, value in model_info.items()
             if key.endswith(".context_length") and isinstance(value, int)), None
        )
        result.append(_model("ollama", model_id, "local", generation, embeddings,
                             vision=vision, structured_output=generation,
                             context_window=context))
    return result


async def _openai(client: httpx.AsyncClient, key: str) -> list[dict[str, Any]]:
    response = await client.get("https://api.openai.com/v1/models",
                                headers={"Authorization": f"Bearer {key}"})
    response.raise_for_status()
    result = []
    for item in response.json().get("data", []):
        model_id = item.get("id", "")
        if not isinstance(model_id, str):
            continue
        embeddings = model_id.startswith("text-embedding-")
        generation = model_id.startswith(("gpt-", "o1", "o3", "o4", "chat-"))
        if generation or embeddings:
            result.append(_model("openai", model_id, "cloud", generation, embeddings,
                                 structured_output=generation))
    return result


async def _anthropic(client: httpx.AsyncClient, key: str) -> list[dict[str, Any]]:
    result = []
    after_id: str | None = None
    for _ in range(10):
        params = {"limit": "100"}
        if after_id:
            params["after_id"] = after_id
        response = await client.get(
            "https://api.anthropic.com/v1/models", params=params,
            headers={"x-api-key": key, "anthropic-version": "2023-06-01"}
        )
        response.raise_for_status()
        body = response.json()
        for item in body.get("data", []):
            model_id = item.get("id")
            if isinstance(model_id, str):
                result.append(_model("anthropic", model_id, "cloud", True, False,
                                     structured_output=True))
        if not body.get("has_more") or not body.get("data"):
            break
        after_id = body["data"][-1].get("id")
    return result


async def _gemini(client: httpx.AsyncClient, key: str) -> list[dict[str, Any]]:
    result = []
    page_token: str | None = None
    for _ in range(10):
        params = {"pageSize": "1000"}
        if page_token:
            params["pageToken"] = page_token
        response = await client.get("https://generativelanguage.googleapis.com/v1beta/models",
                                    params=params, headers={"x-goog-api-key": key})
        response.raise_for_status()
        body = response.json()
        for item in body.get("models", []):
            model_id = str(item.get("name", "")).removeprefix("models/")
            methods = item.get("supportedGenerationMethods", [])
            generation = "generateContent" in methods
            embeddings = "embedContent" in methods
            if model_id and (generation or embeddings):
                result.append(_model("gemini", model_id, "cloud", generation, embeddings,
                                     structured_output=generation,
                                     context_window=item.get("inputTokenLimit")))
        page_token = body.get("nextPageToken")
        if not page_token:
            break
    return result


async def _compatible(
    client: httpx.AsyncClient, settings: Settings, key: str
) -> list[dict[str, Any]]:
    response = await client.get(f"{settings.openai_compatible_base_url.rstrip('/')}/models",
                                headers={"Authorization": f"Bearer {key or 'not-required'}"})
    response.raise_for_status()
    return [
        _model("openai_compatible", item["id"], "cloud", True, False)
        for item in response.json().get("data", []) if isinstance(item.get("id"), str)
    ]


async def discover_models(settings: Settings, *, refresh: bool = False) -> dict[str, Any]:
    keys = {provider: resolved_api_key(settings, provider)
            for provider in ("openai", "anthropic", "gemini", "openai_compatible")}
    signature = repr((settings.ollama_base_url, settings.openai_compatible_base_url,
                      tuple((provider, hashlib.sha256(value.encode()).hexdigest())
                            for provider, value in keys.items())))
    cached = _CACHE.get(signature)
    if not refresh and cached and time.monotonic() - cached[0] < TTL_SECONDS:
        return cached[1]
    candidates = {
        "ollama": bool(settings.ollama_base_url),
        "openai": bool(keys["openai"]),
        "anthropic": bool(keys["anthropic"]),
        "gemini": bool(keys["gemini"]),
        "openai_compatible": bool(settings.openai_compatible_base_url),
    }
    async with httpx.AsyncClient(timeout=5) as client:
        jobs = {
            "ollama": lambda: _ollama(client, settings),
            "openai": lambda: _openai(client, keys["openai"]),
            "anthropic": lambda: _anthropic(client, keys["anthropic"]),
            "gemini": lambda: _gemini(client, keys["gemini"]),
            "openai_compatible": lambda: _compatible(client, settings, keys["openai_compatible"]),
        }
        names = [name for name, configured in candidates.items() if configured]
        outcomes = await asyncio.gather(*(jobs[name]() for name in names), return_exceptions=True)
    providers: list[dict[str, Any]] = []
    models: list[dict[str, Any]] = []
    for name, configured in candidates.items():
        if name not in names:
            providers.append({"id": name, "mode": "local" if name == "ollama" else "cloud",
                              "configured": False, "reachable": False,
                              "detail": "Provider is not configured"})
            continue
        outcome = outcomes[names.index(name)]
        if isinstance(outcome, BaseException):
            providers.append({"id": name, "mode": "local" if name == "ollama" else "cloud",
                              "configured": configured, "reachable": False,
                              "detail": type(outcome).__name__})
        else:
            providers.append({"id": name, "mode": "local" if name == "ollama" else "cloud",
                              "configured": configured, "reachable": True,
                              "detail": f"{len(outcome)} models"})
            models.extend(outcome)
    models.sort(key=lambda item: (item["mode"] != "local", item["provider"], item["id"]))
    value = {"models": models, "providers": providers}
    _CACHE[signature] = (time.monotonic(), value)
    return value


@router.get("/models")
async def list_models(
    refresh: bool = False, settings: Settings = Depends(get_settings)
) -> dict[str, Any]:
    return await discover_models(settings, refresh=refresh)
