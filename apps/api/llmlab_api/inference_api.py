"""Small streaming probe for the inference teaching lab."""

from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from .contracts import ExecutionMode, GenerationRequest
from .model_catalog import ollama_api_base
from .pricing import estimate_cost
from .providers import _openai_base_and_key
from .settings import Settings, get_settings

router = APIRouter(prefix="/api/v1/inference", tags=["inference"])


def _line(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False) + "\n"


@router.post("/stream")
async def stream_inference(
    request: GenerationRequest, settings: Settings = Depends(get_settings)
) -> StreamingResponse:
    if request.mode is ExecutionMode.FIXTURE or request.provider not in {
        "ollama",
        "openai",
        "openai_compatible",
    }:
        raise HTTPException(422, "Select an Ollama, OpenAI, or OpenAI-compatible live model")

    async def events() -> AsyncIterator[str]:
        started = time.perf_counter()
        first: float | None = None
        input_tokens: int | None = None
        output_tokens: int | None = None
        try:
            if request.provider == "ollama":
                payload: dict[str, Any] = {
                    "model": request.model,
                    "messages": request.messages,
                    "stream": True,
                    "think": False,
                    "options": {
                        "temperature": request.temperature,
                        "top_p": request.top_p,
                        "num_predict": request.max_tokens,
                    },
                }
                url = f"{ollama_api_base(settings)}/api/chat"
                headers: dict[str, str] = {}
            else:
                base, key = _openai_base_and_key(request.provider, settings)
                headers = {"Authorization": f"Bearer {key}"}
                if request.provider == "openai":
                    url = f"{base.rstrip('/')}/responses"
                    payload = {
                        "model": request.model,
                        "input": request.messages,
                        "max_output_tokens": request.max_tokens,
                        "stream": True,
                    }
                    if not request.model.startswith(("gpt-5", "gpt-6", "o1", "o3", "o4")):
                        payload.update(temperature=request.temperature, top_p=request.top_p)
                else:
                    url = f"{base.rstrip('/')}/chat/completions"
                    payload = {
                        "model": request.model,
                        "messages": request.messages,
                        "temperature": request.temperature,
                        "top_p": request.top_p,
                        "max_tokens": request.max_tokens,
                        "stream": True,
                        "stream_options": {"include_usage": True},
                    }
            async with (
                httpx.AsyncClient(timeout=90) as client,
                client.stream("POST", url, json=payload, headers=headers) as response,
            ):
                if response.is_error:
                    message = (await response.aread()).decode("utf-8", errors="replace")[:300]
                    raise HTTPException(response.status_code, message)
                async for raw in response.aiter_lines():
                    if not raw or raw.startswith(":"):
                        continue
                    if request.provider == "ollama":
                        event = json.loads(raw)
                        delta = str(event.get("message", {}).get("content", ""))
                        if event.get("done"):
                            input_tokens = int(event.get("prompt_eval_count", 0))
                            output_tokens = int(event.get("eval_count", 0))
                    else:
                        if not raw.startswith("data:"):
                            continue
                        data = raw[5:].strip()
                        if data == "[DONE]":
                            continue
                        event = json.loads(data)
                        delta = ""
                        if request.provider == "openai":
                            if event.get("type") == "response.output_text.delta":
                                delta = str(event.get("delta", ""))
                            if event.get("type") == "response.completed":
                                usage = event.get("response", {}).get("usage", {})
                                input_tokens = int(usage.get("input_tokens", 0))
                                output_tokens = int(usage.get("output_tokens", 0))
                        else:
                            choices = event.get("choices") or []
                            if choices:
                                delta = str(choices[0].get("delta", {}).get("content") or "")
                            if event.get("usage"):
                                input_tokens = int(event["usage"].get("prompt_tokens", 0))
                                output_tokens = int(event["usage"].get("completion_tokens", 0))
                    if delta:
                        if first is None:
                            first = time.perf_counter()
                        yield _line({"type": "delta", "text": delta})
            total_ms = round((time.perf_counter() - started) * 1000)
            ttft_ms = round((first - started) * 1000) if first is not None else None
            cost = (
                estimate_cost(request.provider, request.model, input_tokens, output_tokens)
                if input_tokens is not None and output_tokens is not None
                else None
            )
            yield _line(
                {
                    "type": "done",
                    "ttft_ms": ttft_ms,
                    "total_ms": total_ms,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "output_tokens_per_second": round(
                        output_tokens / max(0.001, (total_ms - (ttft_ms or 0)) / 1000), 2
                    )
                    if output_tokens is not None and ttft_ms is not None
                    else None,
                    "cost_usd": cost,
                }
            )
        except (httpx.HTTPError, ValueError, KeyError, TypeError, HTTPException) as error:
            yield _line({"type": "error", "message": str(error)[:300]})

    return StreamingResponse(
        events(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store"}
    )
