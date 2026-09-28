"""Read-only readiness checks for a selected local or cloud experiment."""

from typing import Any

from fastapi import APIRouter, Depends

from .model_catalog import discover_models
from .settings import Settings, get_settings

router = APIRouter(prefix="/api/v1", tags=["preflight"])


@router.get("/preflight")
async def preflight(generation_model_key: str = "", embedding_model_key: str = "",
                    settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    catalog = await discover_models(settings, refresh=True)
    available = {item["key"]: item for item in catalog["models"] if item["available"]}
    ollama = next((item for item in catalog["providers"] if item["id"] == "ollama"), None)

    def selected(key: str, capability: str) -> dict[str, Any]:
        if not key:
            return {"status": "not_selected", "model_key": None}
        model = available.get(key)
        if model is None:
            return {"status": "unavailable", "model_key": key}
        if not model["capabilities"].get(capability):
            return {"status": "wrong_capability", "model_key": key}
        return {"status": "ready", "model_key": key}

    return {"api": {"status": "ready"},
            "ollama": {"status": "ready" if ollama and ollama["reachable"] else "unavailable",
                       "detail": ollama["detail"] if ollama else "Ollama is not configured"},
            "generation": selected(generation_model_key, "generation"),
            "embedding": selected(embedding_model_key, "embeddings"),
            "providers": catalog["providers"]}
