"""Local-only provider credential settings backed by the OS credential store."""

from contextlib import suppress
from importlib import import_module
from importlib.util import find_spec
from typing import Protocol, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .settings import Settings, get_settings

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])
SERVICE = "LLMLab API"
ENV_FIELDS = {
    "openai": "openai_api_key",
    "anthropic": "anthropic_api_key",
    "gemini": "gemini_api_key",
    "openai_compatible": "openai_compatible_api_key",
}


class _Keyring(Protocol):
    def get_password(self, service: str, username: str) -> str | None: ...
    def set_password(self, service: str, username: str, password: str) -> None: ...
    def delete_password(self, service: str, username: str) -> None: ...


def _keyring() -> _Keyring | None:
    if find_spec("keyring") is None:
        return None
    return cast(_Keyring, import_module("keyring"))


def resolved_api_key(settings: Settings, provider: str) -> str:
    if provider not in ENV_FIELDS:
        return ""
    ring = _keyring()
    if ring is not None:
        try:
            stored = ring.get_password(SERVICE, provider)
            if stored:
                return stored
        except Exception:
            pass
    return str(getattr(settings, ENV_FIELDS[provider]))


def secret_source(settings: Settings, provider: str) -> str:
    ring = _keyring()
    if ring is not None:
        try:
            if ring.get_password(SERVICE, provider):
                return "keyring"
        except Exception:
            pass
    return "env" if getattr(settings, ENV_FIELDS[provider]) else "missing"


def _require_local(request: Request) -> None:
    host = request.client.host if request.client else ""
    if host not in {"127.0.0.1", "::1", "localhost", "testclient"}:
        raise HTTPException(403, "Provider key settings are available only from this computer")


class SecretUpdate(BaseModel):
    value: str = Field(min_length=1, max_length=4096)


@router.get("/providers")
def provider_secret_status(
    request: Request, settings: Settings = Depends(get_settings)
) -> dict[str, object]:
    _require_local(request)
    return {
        "keyring_available": _keyring() is not None,
        "providers": {
            provider: {"configured": bool(resolved_api_key(settings, provider)),
                       "source": secret_source(settings, provider)}
            for provider in ENV_FIELDS
        },
    }


@router.put("/providers/{provider}")
def save_provider_secret(
    provider: str,
    update: SecretUpdate,
    request: Request,
) -> dict[str, object]:
    _require_local(request)
    if provider not in ENV_FIELDS:
        raise HTTPException(404, "Unknown provider")
    ring = _keyring()
    if ring is None:
        raise HTTPException(503, "System keyring unavailable. Set the key in .env instead.")
    try:
        ring.set_password(SERVICE, provider, update.value)
    except Exception as exc:
        raise HTTPException(
            503, "System keyring unavailable. Set the key in .env instead."
        ) from exc
    return {"provider": provider, "configured": True, "source": "keyring"}


@router.delete("/providers/{provider}")
def delete_provider_secret(provider: str, request: Request) -> dict[str, object]:
    _require_local(request)
    if provider not in ENV_FIELDS:
        raise HTTPException(404, "Unknown provider")
    ring = _keyring()
    if ring is not None:
        with suppress(Exception):
            ring.delete_password(SERVICE, provider)
    return {"provider": provider, "configured": False}
