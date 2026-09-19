from __future__ import annotations

import hashlib
import importlib
import math
import re
import unicodedata
from collections import Counter
from dataclasses import asdict, dataclass
from typing import Any, Protocol

import numpy as np

from .knowledge import KnowledgeDocument

_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
_TOKEN = re.compile(r"[a-z0-9][a-z0-9_-]*", re.IGNORECASE)


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    document_id: str
    title: str
    section: str
    path: str
    language: str
    version: str
    text: str
    synthetic: bool
    retrieval_role: str = "primary"


@dataclass(frozen=True)
class SearchHit:
    chunk: Chunk
    dense_score: float
    lexical_score: float
    fused_score: float
    reranker_score: float | None = None


class Embedder(Protocol):
    model_id: str
    dimensions: int

    def embed(self, texts: list[str]) -> np.ndarray: ...


def chunk_documents(
    documents: list[KnowledgeDocument], target_tokens: int = 450, overlap_tokens: int = 80
) -> list[Chunk]:
    if target_tokens < 40 or overlap_tokens < 0 or overlap_tokens >= target_tokens:
        raise ValueError("Invalid chunk token configuration")
    chunks: list[Chunk] = []
    for document in documents:
        for section, content in _sections(document.body):
            content = re.sub(r"<!--.*?-->", "", content, flags=re.DOTALL).strip()
            paragraphs = [item.strip() for item in re.split(r"\n\s*\n", content) if item.strip()]
            windows: list[str] = []
            current: list[str] = []
            count = 0
            for paragraph in paragraphs:
                words = paragraph.split()
                if current and count + len(words) > target_tokens:
                    windows.append("\n\n".join(current))
                    tail = " ".join(" ".join(current).split()[-overlap_tokens:])
                    current = [tail] if tail else []
                    count = len(tail.split())
                if len(words) > target_tokens:
                    step = target_tokens - overlap_tokens
                    windows.extend(
                        " ".join(words[start : start + target_tokens])
                        for start in range(0, len(words), step)
                        if words[start : start + target_tokens]
                    )
                    current = []
                    count = 0
                else:
                    current.append(paragraph)
                    count += len(words)
            if current:
                windows.append("\n\n".join(current))
            slug = _slug(section)
            for index, text in enumerate(windows, start=1):
                chunks.append(
                    Chunk(
                        chunk_id=f"{document.document_id}::{slug}::{index:04d}",
                        document_id=document.document_id,
                        title=document.title,
                        section=section,
                        path=document.path,
                        language=document.language,
                        version=document.version,
                        text=text,
                        synthetic=document.synthetic,
                        retrieval_role=document.retrieval_role,
                    )
                )
    return chunks


class MultilingualHashEmbedder:
    """Transparent offline Czech-English fallback that computes normalized vectors."""

    model_id = "llmlab/multilingual-hash-v1"
    dimensions = 384

    def embed(self, texts: list[str]) -> np.ndarray:
        matrix = np.zeros((len(texts), self.dimensions), dtype=np.float32)
        for row, text in enumerate(texts):
            tokens = canonical_tokens(text)
            features = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:], strict=False)]
            for feature in features:
                digest = hashlib.blake2b(feature.encode(), digest_size=8).digest()
                slot = int.from_bytes(digest[:4], "little") % self.dimensions
                sign = 1.0 if digest[4] & 1 else -1.0
                matrix[row, slot] += sign * (1.4 if "_" in feature else 1.0)
            norm = float(np.linalg.norm(matrix[row]))
            if norm:
                matrix[row] /= norm
        return matrix


class SentenceTransformerEmbedder:
    def __init__(self, model_id: str, allow_download: bool = False) -> None:
        module: Any = importlib.import_module("sentence_transformers")

        self.model_id = model_id
        self._model = module.SentenceTransformer(model_id, local_files_only=not allow_download)
        dimensions = self._model.get_embedding_dimension()
        if dimensions is None:
            raise RuntimeError("Embedding model did not report its vector dimensions")
        self.dimensions = int(dimensions)

    def embed(self, texts: list[str]) -> np.ndarray:
        vectors = self._model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return np.asarray(vectors, dtype=np.float32)


def create_embedder(model_id: str, allow_download: bool = False) -> tuple[Embedder, str | None]:
    if model_id == MultilingualHashEmbedder.model_id:
        return MultilingualHashEmbedder(), None
    try:
        return SentenceTransformerEmbedder(model_id, allow_download), None
    except (ImportError, OSError, RuntimeError) as exc:
        warning = (
            f"Requested model {model_id} is unavailable locally; using "
            f"{MultilingualHashEmbedder.model_id} ({type(exc).__name__})."
        )
        return MultilingualHashEmbedder(), warning


class BM25:
    def __init__(self, texts: list[str], k1: float = 1.5, b: float = 0.75) -> None:
        self.docs = [lexical_tokens(text) for text in texts]
        self.k1 = k1
        self.b = b
        self.lengths = [len(doc) for doc in self.docs]
        self.average = sum(self.lengths) / len(self.lengths) if self.lengths else 0.0
        self.frequencies = [Counter(doc) for doc in self.docs]
        document_frequency: Counter[str] = Counter()
        for doc in self.docs:
            document_frequency.update(set(doc))
        size = len(self.docs)
        self.idf = {
            term: math.log(1 + (size - count + 0.5) / (count + 0.5))
            for term, count in document_frequency.items()
        }

    def scores(self, query: str) -> list[float]:
        terms = lexical_tokens(query)
        if not self.average:
            return [0.0] * len(self.docs)
        results: list[float] = []
        for index, frequencies in enumerate(self.frequencies):
            normalizer = self.k1 * (1 - self.b + self.b * self.lengths[index] / self.average)
            score = sum(
                self.idf.get(term, 0.0)
                * (frequencies.get(term, 0) * (self.k1 + 1))
                / (frequencies.get(term, 0) + normalizer)
                for term in terms
                if frequencies.get(term, 0)
            )
            results.append(score)
        return results


def hybrid_search(
    question: str,
    chunks: list[Chunk],
    embeddings: np.ndarray,
    embedder: Embedder,
    top_k: int,
    dense_weight: float,
    lexical_weight: float,
) -> list[SearchHit]:
    if not chunks:
        return []
    total_weight = dense_weight + lexical_weight
    if total_weight <= 0:
        raise ValueError("At least one retrieval weight must be positive")
    dense_weight /= total_weight
    lexical_weight /= total_weight
    query = embedder.embed([question])[0]
    dense = np.dot(embeddings, query)
    lexical_raw = BM25([chunk.text for chunk in chunks]).scores(question)
    lexical_max = max(lexical_raw, default=0.0)
    hits: list[SearchHit] = []
    for index, chunk in enumerate(chunks):
        dense_score = max(0.0, min(1.0, float(dense[index])))
        lexical_score = lexical_raw[index] / lexical_max if lexical_max else 0.0
        authority_weight = 0.85 if chunk.retrieval_role == "secondary" else 1.0
        hits.append(
            SearchHit(
                chunk=chunk,
                dense_score=dense_score,
                lexical_score=lexical_score,
                fused_score=max(
                    0.0,
                    min(
                        1.0,
                        authority_weight
                        * (dense_weight * dense_score + lexical_weight * lexical_score),
                    ),
                ),
            )
        )
    return sorted(hits, key=lambda item: (-item.fused_score, item.chunk.chunk_id))[:top_k]


_CONCEPTS = {
    "jak": "how",
    "dlouho": "duration",
    "lhuta": "duration",
    "lhuty": "duration",
    "vratit": "return",
    "vraceni": "return",
    "refundace": "refund",
    "refundaci": "refund",
    "bezne": "standard",
    "bezny": "standard",
    "zarizeni": "hardware",
    "produkt": "product",
    "zasilka": "shipment",
    "doruceni": "delivery",
    "dorucena": "delivery",
    "odeslani": "shipping",
    "zaruka": "warranty",
    "zaruky": "warranty",
    "ucet": "account",
    "uctu": "account",
    "heslo": "password",
    "soukromi": "privacy",
    "incident": "incident",
    "predplatne": "subscription",
    "faktura": "invoice",
    "cestovni": "travel",
    "vyuctovani": "expense",
    "dostupnost": "availability",
    "bezpecnost": "security",
    "zamestnanec": "employee",
    "schvalene": "approved",
    "schvalena": "approved",
    "zpracovana": "processed",
    "rychle": "quickly",
    "kolik": "how-many",
    "dnu": "days",
}
_STOP = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "to",
    "what",
    "when",
    "where",
    "which",
    "who",
    "with",
    "you",
    "your",
    "je",
    "jaky",
    "jaka",
    "jake",
    "muzu",
    "se",
    "na",
    "do",
    "od",
    "pro",
    "s",
    "v",
    "ve",
}


def canonical_tokens(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    ascii_text = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    tokens = _TOKEN.findall(ascii_text)
    return [_CONCEPTS.get(token, token) for token in tokens if token not in _STOP]


def lexical_tokens(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    ascii_text = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    return [token for token in _TOKEN.findall(ascii_text) if token not in _STOP]


def _sections(body: str) -> list[tuple[str, str]]:
    matches = list(_HEADING.finditer(body))
    if not matches:
        return [("Document", body)]
    sections: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        content = body[start:end].strip()
        if content:
            sections.append((match.group(2).strip(), content))
    return sections


def _slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-") or "section"


def chunk_to_dict(chunk: Chunk) -> dict[str, str | bool]:
    return asdict(chunk)
