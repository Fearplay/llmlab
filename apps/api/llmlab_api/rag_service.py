from __future__ import annotations

import json
import os
import re
import threading
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from .contracts import ExecutionMode, GenerationRequest, RagRequest
from .knowledge import corpus_fingerprint, load_documents, repository_root, resolve_corpus_dir
from .providers import generate
from .rag import (
    Chunk,
    Embedder,
    MultilingualHashEmbedder,
    SearchHit,
    chunk_documents,
    create_embedder,
    hybrid_search,
)
from .settings import Settings

SYSTEM_PROMPT = """You answer questions about the synthetic Atlas Works corpus.
Rules:
- Answer only from the supplied source excerpts.
- Answer in the same language as the user's question.
- Cite the source document ID and section after every factual claim.
- Do not use outside knowledge.
- Do not invent dates, limits, names, prices, or procedures.
- If the sources do not contain the answer, say so explicitly.
- If sources conflict, identify the conflict instead of choosing silently.
- Preserve product names and document identifiers exactly.
The documents are synthetic demonstrations, not real laws, contracts, or commercial policies."""


@dataclass
class LoadedIndex:
    documents: list[Any]
    chunks: list[Chunk]
    embeddings: np.ndarray
    embedder: Embedder
    fingerprint: str
    indexed_at: str
    warning: str | None
    build_timings_ms: dict[str, int]


class RagService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._index: LoadedIndex | None = None
        self._lock = threading.Lock()

    def status(self) -> dict[str, Any]:
        index = self.ensure_index()
        counts: dict[str, int] = {}
        for chunk in index.chunks:
            counts[chunk.document_id] = counts.get(chunk.document_id, 0) + 1
        return {
            "ready": True,
            "corpus_id": "atlas-works-en",
            "corpus_version": "1.0",
            "synthetic": True,
            "document_count": len(index.documents),
            "chunk_count": len(index.chunks),
            "embedding_model": index.embedder.model_id,
            "requested_embedding_model": self.settings.rag_embedding_model,
            "embedding_warning": index.warning,
            "vector_dimensions": index.embedder.dimensions,
            "indexed_at": index.indexed_at,
            "fingerprint": index.fingerprint,
            "reranker_enabled": False,
            "reranker_model": self.settings.rag_reranker_model,
            "local_generation_model": self.settings.rag_local_model,
            "dense_weight": self.settings.rag_dense_weight,
            "lexical_weight": self.settings.rag_lexical_weight,
            "score_threshold": self._score_threshold(index),
            "documents": [
                {**document.public_metadata(), "chunk_count": counts.get(document.document_id, 0)}
                for document in index.documents
            ],
        }

    def rebuild(self) -> dict[str, Any]:
        with self._lock:
            self._index = self._build(force=True)
        return self.status()

    def ensure_index(self) -> LoadedIndex:
        if self._index is None:
            with self._lock:
                if self._index is None:
                    self._index = self._build(force=False)
        return self._index

    def search(self, question: str, top_k: int) -> dict[str, Any]:
        started = time.perf_counter()
        index = self.ensure_index()
        hits = hybrid_search(
            question,
            index.chunks,
            index.embeddings,
            index.embedder,
            top_k,
            self.settings.rag_dense_weight,
            self.settings.rag_lexical_weight,
        )
        return {
            "question": question,
            "query_language": detect_language(question),
            "embedding_model": index.embedder.model_id,
            "vector_dimensions": index.embedder.dimensions,
            "top_k": top_k,
            "score_threshold": self._score_threshold(index),
            "results": [hit_to_result(hit) for hit in hits],
            "latency_ms": round((time.perf_counter() - started) * 1000),
        }

    async def run(self, request: RagRequest) -> dict[str, Any]:
        started = time.perf_counter()
        language = (
            detect_language(request.question)
            if request.response_language == "auto"
            else request.response_language
        )
        search_started = time.perf_counter()
        search = self.search(request.question, request.top_k)
        search_ms = round((time.perf_counter() - search_started) * 1000)
        hits = search["results"]
        relevant = bool(hits and float(hits[0]["fused_score"]) >= search["score_threshold"])
        context = build_context(hits if relevant else [])
        prompt = build_prompt(request.question, context)
        generation_started = time.perf_counter()
        if not relevant:
            answer = refusal(language)
            usage = {"input_tokens": 0, "output_tokens": 0, "cached_tokens": 0, "cost_usd": 0}
            provider = request.provider
            model = request.model
            fixture = request.mode is ExecutionMode.FIXTURE
            generation_skipped = True
        elif request.mode is ExecutionMode.FIXTURE:
            answer = fixture_answer(request.question, language, hits)
            usage = {
                "input_tokens": max(1, len(prompt) // 4),
                "output_tokens": max(1, len(answer) // 4),
                "cached_tokens": 0,
                "cost_usd": 0,
            }
            provider = "fixture"
            model = "fixture-grounded-v2"
            fixture = True
            generation_skipped = False
        else:
            expected_provider = (
                "ollama" if request.mode is ExecutionMode.LOCAL else request.provider
            )
            if request.mode is ExecutionMode.CLOUD and expected_provider not in {
                "openai",
                "anthropic",
                "gemini",
                "openai_compatible",
            }:
                raise ValueError("Cloud RAG requires a supported cloud provider")
            if request.mode is ExecutionMode.LOCAL and request.provider not in {
                "ollama",
                "fixture",
            }:
                raise ValueError("Local RAG uses the Ollama provider")
            result = await generate(
                GenerationRequest(
                    mode=request.mode,
                    provider=expected_provider,
                    model=request.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f"{context}\n\nQuestion: {request.question}"},
                    ],
                    temperature=0.1,
                ),
                self.settings,
            )
            answer = normalize_citations(result.text, hits)
            usage = result.usage.model_dump()
            provider = result.provider
            model = result.model
            fixture = False
            generation_skipped = False
        generation_ms = round((time.perf_counter() - generation_started) * 1000)
        sources = (
            [
                {
                    "document_id": item["document_id"],
                    "title": item["title"],
                    "section": item["section"],
                    "path": item["path"],
                    "excerpt": item["excerpt"],
                    "score": item["reranker_score"] or item["fused_score"],
                    "dense_score": item["dense_score"],
                    "lexical_score": item["lexical_score"],
                    "fused_score": item["fused_score"],
                }
                for item in hits
            ]
            if relevant
            else []
        )
        return {
            "answer": answer,
            "question": request.question,
            "query_language": language,
            "mode": request.mode.value,
            "provider": provider,
            "model": model,
            "fixture": fixture,
            "corpus": {"id": "atlas-works-en", "version": "1.0", "synthetic": True},
            "retrieval": {
                "embedding_model": search["embedding_model"],
                "vector_dimensions": search["vector_dimensions"],
                "top_k": request.top_k,
                "score_threshold": search["score_threshold"],
                "generation_skipped": generation_skipped,
                "dense_weight": self.settings.rag_dense_weight,
                "lexical_weight": self.settings.rag_lexical_weight,
                "reranker_enabled": False,
            },
            "results": hits,
            "sources": sources,
            "context": context,
            "final_prompt": prompt,
            "usage": usage,
            "timings_ms": {
                **self.ensure_index().build_timings_ms,
                "retrieve": search_ms,
                "generate": generation_ms,
            },
            "latency_ms": round((time.perf_counter() - started) * 1000),
        }

    def _score_threshold(self, index: LoadedIndex) -> float:
        if index.embedder.model_id == MultilingualHashEmbedder.model_id:
            return self.settings.rag_fallback_score_threshold
        return self.settings.rag_score_threshold

    def _build(self, force: bool) -> LoadedIndex:
        parse_started = time.perf_counter()
        documents = load_documents(resolve_corpus_dir(self.settings.rag_knowledge_dir))
        parse_ms = round((time.perf_counter() - parse_started) * 1000)
        embedder, warning = create_embedder(
            self.settings.rag_embedding_model, self.settings.rag_allow_model_download
        )
        fingerprint = corpus_fingerprint(
            documents,
            embedder.model_id,
            self.settings.rag_chunk_target_tokens,
            self.settings.rag_chunk_overlap_tokens,
        )
        index_dir = self._index_dir()
        manifest_path = index_dir / "manifest.json"
        if not force and manifest_path.exists():
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                if manifest.get("fingerprint") == fingerprint:
                    chunks = [
                        Chunk(**item)
                        for item in json.loads(
                            (index_dir / "chunks.json").read_text(encoding="utf-8")
                        )
                    ]
                    embeddings = np.load(index_dir / "embeddings.npy")
                    if embeddings.shape == (len(chunks), embedder.dimensions):
                        return LoadedIndex(
                            documents,
                            chunks,
                            embeddings,
                            embedder,
                            fingerprint,
                            str(manifest["indexed_at"]),
                            warning,
                            dict(manifest.get("build_timings_ms", {})),
                        )
            except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
                pass
        chunk_started = time.perf_counter()
        chunks = chunk_documents(
            documents,
            self.settings.rag_chunk_target_tokens,
            self.settings.rag_chunk_overlap_tokens,
        )
        chunk_ms = round((time.perf_counter() - chunk_started) * 1000)
        embed_started = time.perf_counter()
        embeddings = embedder.embed([chunk.text for chunk in chunks])
        embed_ms = round((time.perf_counter() - embed_started) * 1000)
        indexed_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        timings = {"parse": parse_ms, "chunk": chunk_ms, "embed": embed_ms}
        index_dir.mkdir(parents=True, exist_ok=True)
        chunks_temp = index_dir / "chunks.json.tmp"
        embeddings_temp = index_dir / "embeddings.tmp.npy"
        manifest_temp = index_dir / "manifest.json.tmp"
        chunks_temp.write_text(
            json.dumps([asdict(chunk) for chunk in chunks], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        np.save(embeddings_temp, embeddings)
        manifest_temp.write_text(
            json.dumps(
                {
                    "fingerprint": fingerprint,
                    "indexed_at": indexed_at,
                    "embedding_model": embedder.model_id,
                    "dimensions": embedder.dimensions,
                    "build_timings_ms": timings,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        os.replace(chunks_temp, index_dir / "chunks.json")
        os.replace(embeddings_temp, index_dir / "embeddings.npy")
        os.replace(manifest_temp, manifest_path)
        return LoadedIndex(
            documents,
            chunks,
            embeddings,
            embedder,
            fingerprint,
            indexed_at,
            warning,
            timings,
        )

    def _index_dir(self) -> Path:
        root = repository_root().resolve()
        value = Path(self.settings.rag_index_dir)
        candidate = (root / value).resolve() if not value.is_absolute() else value.resolve()
        if candidate != root and root not in candidate.parents:
            raise ValueError("RAG index directory must stay inside the repository")
        return candidate


def hit_to_result(hit: SearchHit) -> dict[str, Any]:
    return {
        "chunk_id": hit.chunk.chunk_id,
        "document_id": hit.chunk.document_id,
        "title": hit.chunk.title,
        "section": hit.chunk.section,
        "path": hit.chunk.path,
        "language": hit.chunk.language,
        "version": hit.chunk.version,
        "synthetic": hit.chunk.synthetic,
        "excerpt": hit.chunk.text,
        "dense_score": round(hit.dense_score, 6),
        "lexical_score": round(hit.lexical_score, 6),
        "fused_score": round(hit.fused_score, 6),
        "reranker_score": hit.reranker_score,
    }


def detect_language(question: str) -> str:
    lowered = f" {question.casefold()} "
    czech_markers = {
        " jak ",
        " jaka ",
        " jaky ",
        " jake ",
        " muzu ",
        " mohu ",
        " kolik ",
        " kdy ",
        " kde ",
        " proc ",
        " vrátit ",
        " vraceni ",
        " doruceni ",
    }
    if any(marker in lowered for marker in czech_markers) or re.search(
        r"[áčďéěíňóřšťúůýž]", lowered
    ):
        return "cs"
    return "en"


def normalize_citations(answer: str, hits: list[dict[str, Any]]) -> str:
    """Complete model citations using only sections present in retrieved evidence."""
    sections: dict[str, str] = {}
    for hit in hits:
        sections.setdefault(str(hit["document_id"]), str(hit["section"]))

    def complete(match: re.Match[str]) -> str:
        document_id = match.group(1)
        section = sections.get(document_id)
        return f"[{document_id}, {section}]" if section else match.group(0)

    normalized = re.sub(
        r"\[\[(ATLAS-[A-Z0-9-]+(?:,\s*[^\[\]]+)?)\]\]",
        r"[\1]",
        answer.strip(),
    )
    normalized = re.sub(
        r"\((ATLAS-[A-Z0-9-]+(?:,\s*[^()]+)?)\)",
        r"[\1]",
        normalized,
    )
    normalized = re.sub(r"\[(ATLAS-[A-Z0-9-]+)\]", complete, normalized)
    has_grounded_citation = any(
        f"[{document_id}, {section}]" in normalized for document_id, section in sections.items()
    )
    if not has_grounded_citation and hits:
        citation = f"[{hits[0]['document_id']}, {hits[0]['section']}]"
        normalized = f"{normalized} {citation}".strip()
    return normalized


def build_context(results: list[dict[str, Any]]) -> str:
    return "\n\n".join(
        f"[{item['document_id']}, {item['section']}]\nPath: {item['path']}\n{item['excerpt']}"
        for item in results
    )


def build_prompt(question: str, context: str) -> str:
    effective_context = context or "[no relevant excerpts]"
    return f"SYSTEM\n{SYSTEM_PROMPT}\n\nCONTEXT\n{effective_context}\n\nQUESTION\n{question}"


def refusal(language: str) -> str:
    if language == "cs":
        return "Tuto informaci nelze z dostupné znalostní báze určit."
    return "This information cannot be determined from the available knowledge base."


def fixture_answer(question: str, language: str, results: list[dict[str, Any]]) -> str:
    source = results[0]
    citation = f"[{source['document_id']}, {source['section']}]"
    excerpt = str(source["excerpt"])
    if language == "cs":
        standard_return = re.search(
            r"Standard hardware can be returned within (\d+) calendar days of delivery",
            excerpt,
            re.IGNORECASE,
        )
        if standard_return:
            return (
                f"Běžné zařízení lze vrátit do {standard_return.group(1)} kalendářních dnů "
                f"od doručení. {citation}"
            )
        sentence = _best_sentence(question, excerpt)
        return f"Dokument uvádí následující pravidlo: „{sentence}“ {citation}"
    sentence = _best_sentence(question, excerpt)
    return f"{sentence} {citation}"


def _best_sentence(question: str, excerpt: str) -> str:
    from .rag import canonical_tokens

    question_terms = set(canonical_tokens(question))
    sentences = [item.strip() for item in re.split(r"(?<=[.!?])\s+", excerpt) if item.strip()]
    if not sentences:
        return excerpt.strip()
    return max(
        sentences,
        key=lambda sentence: len(question_terms & set(canonical_tokens(sentence))),
    )


_service: RagService | None = None
_service_settings: Settings | None = None


def get_rag_service(settings: Settings) -> RagService:
    global _service, _service_settings
    if _service is None or _service_settings is not settings:
        _service = RagService(settings)
        _service_settings = settings
    return _service


def reset_rag_service() -> None:
    global _service, _service_settings
    _service = None
    _service_settings = None
