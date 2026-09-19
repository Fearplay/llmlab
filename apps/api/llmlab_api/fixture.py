import hashlib
import math
from typing import Any

from .contracts import EmbeddingResult, ExecutionMode, GenerationResult, Usage


def fixture_generation(messages: list[dict[str, str]], structured: bool) -> GenerationResult:
    joined = " ".join(item.get("content", "") for item in messages)
    answer = (
        "This deterministic fixture demonstrates a generator response. "
        "Use the RAG Pipeline for answers grounded in the Atlas Works corpus."
    )
    if structured:
        answer = '{"answer":"Deterministic fixture output","citations":[],"confidence":null}'
    return GenerationResult(
        text=answer,
        provider="fixture",
        model="fixture-gen-v2",
        mode=ExecutionMode.FIXTURE,
        usage=Usage(
            input_tokens=max(1, len(joined) // 4),
            output_tokens=max(1, len(answer) // 4),
            cost_usd=0,
        ),
        latency_ms=1,
        fixture=True,
    )


def fixture_embeddings(inputs: list[str]) -> EmbeddingResult:
    vectors = [_hashed_vector(value, dimensions=8) for value in inputs]
    return EmbeddingResult(
        vectors=vectors,
        dimensions=8,
        provider="fixture",
        model="fixture-hash-embed-v2",
        mode=ExecutionMode.FIXTURE,
        usage=Usage(input_tokens=sum(max(1, len(value) // 4) for value in inputs), cost_usd=0),
        fixture=True,
    )


def training_fixture(epochs: int) -> dict[str, Any]:
    train = [0.82, 0.61, 0.46, 0.35, 0.28, 0.22, 0.17, 0.13, 0.10, 0.08, 0.06, 0.05]
    validation = [0.86, 0.66, 0.53, 0.44, 0.40, 0.39, 0.41, 0.45, 0.50, 0.56, 0.61, 0.68]
    size = min(epochs, len(train))
    return {
        "mode": "fixture",
        "fixture": True,
        "model": "tiny-bow-classifier",
        "epochs": [
            {
                "epoch": index + 1,
                "train_loss": train[index],
                "validation_loss": validation[index],
                "validation_accuracy": round(min(0.958, 0.74 + index * 0.031), 3),
                "gradient_norm": round(0.84 / math.sqrt(index + 1), 3),
            }
            for index in range(size)
        ],
        "best_epoch": min(size, 6),
        "warning": "Validation loss rises after epoch 6; later epochs overfit."
        if size > 6
        else None,
    }


def _hashed_vector(text: str, dimensions: int) -> list[float]:
    digest = hashlib.sha256(text.casefold().encode()).digest()
    raw = [(digest[index] / 127.5) - 1 for index in range(dimensions)]
    norm = math.sqrt(sum(value * value for value in raw)) or 1
    return [round(value / norm, 6) for value in raw]
