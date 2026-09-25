from __future__ import annotations

import asyncio
import os

import pytest

from llmlab_api.contracts import RagRequest
from llmlab_api.knowledge import (
    DISCLAIMER,
    KnowledgeDocument,
    corpus_fingerprint,
    load_documents,
    repository_root,
    validate_documents,
)
from llmlab_api.rag import (
    MultilingualHashEmbedder,
    SentenceTransformerEmbedder,
    chunk_documents,
)
from llmlab_api.rag_service import RagService, normalize_citations
from llmlab_api.settings import Settings


def settings() -> Settings:
    return Settings(
        rag_embedding_model="llmlab/multilingual-hash-v1",
        rag_index_dir="apps/api/data/rag-test-index",
    )


def test_real_markdown_corpus_metadata_and_links_are_valid() -> None:
    documents = load_documents(repository_root() / "knowledge" / "en")
    assert len(documents) == 16
    assert len({document.document_id for document in documents}) == 16
    assert sum(len(document.body.split()) for document in documents) >= 10_000
    assert all(
        document.synthetic and document.version and document.language == "en"
        for document in documents
    )
    assert all(document.absolute_path.exists() for document in documents)


def test_markdown_chunking_preserves_heading_and_metadata() -> None:
    documents = load_documents(repository_root() / "knowledge" / "en")
    chunks = chunk_documents(documents, target_tokens=450, overlap_tokens=80)
    standard = next(
        chunk
        for chunk in chunks
        if chunk.chunk_id.startswith("ATLAS-RETURNS-001::standard-returns")
    )
    assert standard.section == "Standard returns"
    assert standard.path == "knowledge/en/returns.md"
    assert "21 calendar days" in standard.text
    assert "<!--" not in standard.text


def test_document_validator_rejects_duplicate_ids() -> None:
    path = repository_root() / "knowledge" / "en" / "returns.md"
    document = KnowledgeDocument(
        "DUP", "One", "1", "2026-01-01", "en", "public", "active", True, "one.md", path, DISCLAIMER
    )
    with pytest.raises(ValueError, match="Duplicate"):
        validate_documents([document, document])


def test_fingerprint_changes_with_content() -> None:
    original = repository_root() / "knowledge" / "en" / "returns.md"
    first = KnowledgeDocument(
        "ONE",
        "One",
        "1",
        "2026-01-01",
        "en",
        "public",
        "active",
        True,
        "one.md",
        original,
        DISCLAIMER,
    )
    changed = repository_root() / "knowledge" / "en" / "shipping.md"
    second = KnowledgeDocument(
        "ONE",
        "One",
        "1",
        "2026-01-01",
        "en",
        "public",
        "active",
        True,
        "one.md",
        changed,
        DISCLAIMER,
    )
    assert corpus_fingerprint([first], "model", 450, 80) != corpus_fingerprint(
        [second], "model", 450, 80
    )


def test_czech_and_english_retrieval_use_real_chunks() -> None:
    service = RagService(settings())
    czech = service.search("Jak dlouho můžu vrátit běžné zařízení?", 5)
    english = service.search("How quickly are approved refunds processed?", 5)
    assert czech["results"][0]["document_id"] == "ATLAS-RETURNS-001"
    assert czech["results"][0]["section"] == "Standard returns"
    assert english["results"][0]["document_id"] == "ATLAS-RETURNS-001"
    assert english["results"][0]["section"] == "Refund processing"


def test_out_of_scope_skips_generation_and_fixture_is_offline() -> None:
    service = RagService(settings())
    result = asyncio.run(service.run(RagRequest(question="Jaká je vzdálenost Země od Slunce?")))
    assert result["retrieval"]["generation_skipped"] is True
    assert result["sources"] == []
    assert result["usage"]["cost_usd"] == 0
    assert result["query_language"] == "cs"


def test_fixture_answer_is_czech_and_citation_path_exists() -> None:
    service = RagService(settings())
    result = asyncio.run(service.run(RagRequest(question="Jak dlouho můžu vrátit běžné zařízení?")))
    assert "21 kalendářních dnů" in result["answer"]
    assert "ATLAS-RETURNS-001" in result["answer"]
    assert all((repository_root() / source["path"]).exists() for source in result["sources"])
    assert result["fixture"] is True
    assert result["retrieval"]["embedding_model"] == MultilingualHashEmbedder.model_id


@pytest.mark.skipif(
    os.getenv("RUN_RAG_MODEL_INTEGRATION") != "1",
    reason="requires the optional rag dependency and a locally cached transformer model",
)
def test_real_multilingual_model_matches_czech_query_to_english_policy() -> None:
    embedder = SentenceTransformerEmbedder(
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    vectors = embedder.embed(
        [
            "Jak dlouho můžu vrátit běžné zařízení?",
            "Standard hardware can be returned within 21 calendar days of delivery.",
            "Encrypted backups are restored during quarterly recovery exercises.",
        ]
    )
    assert float(vectors[0] @ vectors[1]) > float(vectors[0] @ vectors[2])


def test_model_citations_are_completed_from_retrieved_sections() -> None:
    hits = [{"document_id": "ATLAS-RETURNS-001", "section": "Standard returns"}]
    assert normalize_citations("Return it in time. [ATLAS-RETURNS-001]", hits) == (
        "Return it in time. [ATLAS-RETURNS-001, Standard returns]"
    )
    assert normalize_citations("Return it in time.", hits).endswith(
        "[ATLAS-RETURNS-001, Standard returns]"
    )
    assert (
        normalize_citations("Return it in time. (ATLAS-RETURNS-001, Standard returns)", hits)
        == "Return it in time. [ATLAS-RETURNS-001, Standard returns]"
    )
    assert (
        normalize_citations("Return it in time. [[ATLAS-RETURNS-001, Standard returns]]", hits)
        == "Return it in time. [ATLAS-RETURNS-001, Standard returns]"
    )
