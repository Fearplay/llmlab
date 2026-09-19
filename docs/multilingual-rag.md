# Multilingual RAG in LLMLab

LLMLab ships a tracked, English-only synthetic corpus for the fictional organisation Atlas
Works. The corpus is under `knowledge/en/`. It is demonstration content, not a real law,
contract, employer handbook, security promise, or commercial policy.

## What is real and what is fixture

All three RAG modes use the same real local retrieval pipeline: Markdown loading, metadata and
link validation, heading-aware chunking, vector embedding, persistent cosine search, BM25, and
weighted score fusion. Retrieved chunks, file paths, sections, and scores are computed for the
question. They are not browser fixtures.

- **Fixture:** real local retrieval plus a deterministic, offline grounded generator. It makes no
  network request and costs USD 0.
- **Local:** real local retrieval plus an Ollama generator. No cloud provider is contacted.
- **Cloud:** real local retrieval plus the selected OpenAI, Anthropic, Gemini, or OpenAI-compatible
  generator. Cloud execution happens only after the user presses Run.

The browser shows the exact embedding model actually used. `RAG_EMBEDDING_MODEL=BAAI/bge-m3`
is the production preference. Install `uv sync --extra rag` and allow the one-time download with
`RAG_ALLOW_MODEL_DOWNLOAD=true`. A lighter option is
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. If the configured transformer is
not available locally, LLMLab explicitly reports and uses `llmlab/multilingual-hash-v1`, a small
offline Czech-English semantic-hashing fallback. It is useful for the bundled demonstration but
is not represented as BGE-M3.

## Index lifecycle

Generated files live in `apps/api/data/rag-index/` and are ignored by Git. The manifest fingerprint
includes every document's content, the actual embedding model, and chunk target/overlap settings.
A mismatch triggers a safe rebuild. Use **Knowledge Base → Rebuild index** or call:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/rag/reindex
```

Deleting the generated index directory is safe while the API is stopped; the next request rebuilds
it. Large models and their caches are not stored in the repository.

## Adding a document

Add an English Markdown file directly under `knowledge/en/`. Do not add symlinks. Include unique
`document_id`, title, version, effective date, language, audience, status, and `synthetic: true` in
YAML front matter. Repeat the required synthetic disclaimer near the top. Cross-document links use
`[[ATLAS-DOCUMENT-ID]]`; validation rejects unknown IDs. Headings become section metadata, and
paragraphs remain intact until the token target requires a split.

Documents are primary retrieval sources unless front matter declares
`retrieval_role: secondary`. Secondary material remains searchable, but its fused score receives a
small, visible authority adjustment so a specific governing policy can outrank a broad operations
manual that repeats the same vocabulary.

## Privacy and cloud boundaries

Provider keys stay in the API process and are never returned by RAG endpoints. Retrieval and the
index remain local. In Cloud mode, the provider receives the question, grounded system instruction,
and only the top retrieved chunks. The complete corpus and vector index are not sent. Do not use
this synthetic demo for private production documents without authentication, access control, log
redaction, and a reviewed retention policy.

## API and limits

- `GET /api/v1/rag/status` — corpus, actual model, dimensions, fingerprint, documents.
- `POST /api/v1/rag/search` — dense, lexical, fused, and optional reranker fields.
- `POST /api/v1/rag/run` — retrieval, guard, generation, evidence, usage, and timings.
- `POST /api/v1/rag/reindex` — rebuild the allow-listed corpus directory.

Questions are limited to 2,000 characters and `top_k` to 20. An out-of-scope result stops before
generation and returns no sources. The reindex endpoint is isolated for future authentication.

## Current limitations

The persisted store uses exact NumPy cosine search rather than pgvector or FAISS. Its interface is
isolated from orchestration for later replacement. The Grounding screen exposes the latest real
answer and evidence, but claim-level evaluator status is truthfully shown as **not evaluated**.
The optional reranker is configuration-visible but not executed; its score is `null`. The offline
fixture generator is deliberately small; use Ollama or a cloud model for natural synthesis.
