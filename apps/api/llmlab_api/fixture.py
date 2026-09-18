import hashlib
import math
import re
from typing import Any

from .contracts import EmbeddingResult, ExecutionMode, GenerationResult, Usage

DOCUMENTS: list[dict[str, Any]] = [
    {
        "id": 1,
        "title": "Footwear Return Policy",
        "source": "docs/returns_footwear.md",
        "text": (
            "Footwear items may be returned within 30 days of delivery for a full refund, "
            "provided they are in new and unworn condition with the original packaging."
        ),
    },
    {
        "id": 2,
        "title": "General Return Policy",
        "source": "docs/returns_general.md",
        "text": (
            "Most items can be returned within 30 days of delivery. "
            "Certain categories have different return windows."
        ),
    },
    {
        "id": 3,
        "title": "Footwear Exchanges",
        "source": "docs/returns_footwear.md",
        "text": (
            "You can exchange footwear for a different size or color within 30 days of delivery. "
            "Exchange shipping is free."
        ),
    },
    {
        "id": 4,
        "title": "Non-returnable Items",
        "source": "docs/policies_exclusions.md",
        "text": (
            "Final-sale items, customized products, and worn footwear are not eligible for return."
        ),
    },
    {
        "id": 5,
        "title": "Refund Processing Time",
        "source": "docs/refunds.md",
        "text": (
            "Once we receive your return, refunds are processed within 5–7 business days "
            "to the original payment method."
        ),
    },
]


def fixture_generation(messages: list[dict[str, str]], structured: bool) -> GenerationResult:
    joined = " ".join(item.get("content", "") for item in messages)
    answer = "Footwear can be returned within 30 days of delivery when new and unworn."
    if "worn" in joined.casefold():
        answer = "Worn footwear cannot be returned because eligible items must be new and unworn."
    if structured:
        answer = '{"answer":"' + answer + '","citations":["returns_footwear.md"],"confidence":0.96}'
    input_tokens = max(1, len(joined) // 4)
    output_tokens = max(1, len(answer) // 4)
    return GenerationResult(
        text=answer,
        provider="fixture",
        model="fixture-gen-v1",
        mode=ExecutionMode.FIXTURE,
        usage=Usage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=round((input_tokens * 0.15 + output_tokens * 0.60) / 1_000_000, 6),
        ),
        latency_ms=412,
        fixture=True,
    )


def fixture_embeddings(inputs: list[str]) -> EmbeddingResult:
    vectors = [_hashed_vector(value, dimensions=8) for value in inputs]
    return EmbeddingResult(
        vectors=vectors,
        dimensions=8,
        provider="fixture",
        model="fixture-embed-v1",
        mode=ExecutionMode.FIXTURE,
        usage=Usage(input_tokens=sum(max(1, len(value) // 4) for value in inputs), cost_usd=0),
        fixture=True,
    )


def rag_fixture(question: str, top_k: int) -> dict[str, Any]:
    query_terms = set(_tokens(question))
    scored: list[dict[str, Any]] = []
    for document in DOCUMENTS:
        document_terms = set(_tokens(document["text"] + " " + document["title"]))
        overlap = len(query_terms & document_terms) / max(1, len(query_terms))
        policy_boost = 0.52 if document["id"] == 1 else 0.18 / int(document["id"])
        scored.append({**document, "score": round(min(0.99, overlap + policy_boost), 3)})
    chunks = sorted(scored, key=lambda item: item["score"], reverse=True)[:top_k]
    return {
        "question": question,
        "answer": (
            "Footwear can be returned within 30 days of delivery when it is new, unworn, "
            "and in its original packaging. [1]"
        ),
        "chunks": chunks,
        "claims": [
            {
                "text": "The return window is 30 days from delivery.",
                "supported": True,
                "source_ids": [1],
                "confidence": 0.94,
            }
        ],
        "metrics": {"faithfulness": 0.92, "context_precision": 0.88, "answer_relevance": 0.95},
        "timings_ms": {
            "parse": 80,
            "chunk": 210,
            "embed": 180,
            "retrieve": 340,
            "rerank": 190,
            "generate": 320,
            "evaluate": 100,
        },
        "mode": "fixture",
        "fixture": True,
    }


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


def _tokens(value: str) -> list[str]:
    return re.findall(r"[\w'-]+", value.casefold())
