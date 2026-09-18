import math
import re
from collections import Counter
from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str


def chunk_text(text: str, size: int = 480, overlap: int = 80) -> list[Chunk]:
    if size <= 0:
        raise ValueError("size must be positive")
    if overlap < 0 or overlap >= size:
        raise ValueError("overlap must be non-negative and smaller than size")
    words = text.split()
    if not words:
        return []
    step = size - overlap
    return [
        Chunk(index=index, text=" ".join(words[start : start + size]))
        for index, start in enumerate(range(0, len(words), step))
        if words[start : start + size]
    ]


def retrieve(query: str, chunks: list[Chunk], top_k: int = 5) -> list[tuple[Chunk, float]]:
    if top_k <= 0:
        return []
    scored = [(chunk, _cosine_tokens(query, chunk.text)) for chunk in chunks]
    return sorted(scored, key=lambda item: (-item[1], item[0].index))[:top_k]


def _cosine_tokens(left: str, right: str) -> float:
    a = Counter(re.findall(r"\w+", left.casefold()))
    b = Counter(re.findall(r"\w+", right.casefold()))
    if not a or not b:
        return 0.0
    dot = sum(a[key] * b[key] for key in a.keys() & b.keys())
    denominator = math.sqrt(sum(value**2 for value in a.values())) * math.sqrt(
        sum(value**2 for value in b.values())
    )
    return dot / denominator if denominator else 0.0
