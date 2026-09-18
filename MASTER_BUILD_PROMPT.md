# LLMLab — master build prompt

You are the principal product engineer responsible for building **LLMLab**, a serious self-hosted platform for evaluating LLM applications and inspecting AI systems while they run. Work in the current repository. It may be empty.

Build the product, do not stop at a plan or a UI prototype. Work through the phases below in order. A phase is complete only when its behavior, tests, documentation, migrations, and failure states work. Keep the repository runnable after every phase.

## Product goal

LLMLab combines two connected products:

1. A professional evaluation platform for datasets, prompt and model experiments, regression detection, RAG evaluation, agent trajectories, human review, cost, and latency.
2. An interactive AI Lab where users can see tokenization, sampling, embeddings, retrieval, grounding, hallucination estimates, tool calls, and small-model training operate step by step.

The primary audience is an engineer learning practical AI systems by using the product. Prefer observable behavior over long lessons. Use concise contextual definitions and tooltips, then expose real inputs, intermediate data, outputs, provenance, and limitations.

The product is open source, single-instance, and self-hosted. Do not add accounts, organizations, RBAC, billing, or team management.

## Non-negotiable behavior

- Support complete Czech and English UI translations. Detect the browser locale on first visit, provide a persistent `CZ / EN` switch, and never hardcode user-facing copy outside locale files.
- Every generated or evaluated result must carry an execution mode: `fixture`, `local`, or `cloud`.
- Display the execution mode beside every result. Fixture output must never look live. Also show provider, model, timestamp, duration, token usage, cost or `unavailable`, and the effective configuration.
- The no-key path must be complete. `docker compose up --build` must start a useful seeded fixture experience without any cloud API key.
- Local mode must support Ollama generation and embeddings when available. Training Lab must run a small bounded PyTorch job on CPU.
- Cloud mode must support OpenAI, Anthropic, and Gemini. Also support configurable OpenAI-compatible endpoints.
- Model generation and embedding providers are independent selections. Never imply that every provider supports embeddings.
- Capability-gate generation, embeddings, structured output, streaming, token usage, and tool calling. Disable unavailable controls with a precise explanation. Never silently emulate an unsupported provider feature.
- Do not expose hidden chain-of-thought. Agent views may show only observable messages, tool calls, arguments, tool results, timestamps, errors, and concise user-facing summaries.
- Treat hallucination, faithfulness, correctness, and judge scores as measurements with uncertainty, not ground truth. Show the evaluator, rubric, evidence, and limitations.
- Store immutable dataset, prompt, evaluator, and pricing versions. Runs reference exact versions rather than mutable current records.
- Never send secrets to the browser, persist them in application tables, write them to logs, or include them in error payloads. Read cloud keys only from environment variables.

## Evidence and currency rules

Before implementing a provider adapter, evaluator based on an external definition, model capability, or model price:

1. Read the current official documentation.
2. Record the URL, access date, relevant SDK/API version, and decision in `docs/sources.md`.
3. Add a contract test for the normalized behavior.
4. Do not guess model identifiers, response fields, token accounting, or capabilities from memory.

Start with these sources and follow their current canonical links:

- OpenAI Responses: <https://developers.openai.com/api/reference/resources/responses/methods/create>
- OpenAI Evals: <https://developers.openai.com/api/reference/resources/evals>
- Anthropic Messages: <https://platform.claude.com/docs/en/api/http/messages>
- Gemini `generateContent`: <https://ai.google.dev/api/generate-content>
- Ollama OpenAI compatibility: <https://docs.ollama.com/api/openai-compatibility>
- Ragas metric concepts: <https://docs.ragas.io/en/stable/concepts/metrics/>

Keep pricing in a versioned, editable catalog with provider, model pattern, input/output/cached-token rates, currency, source URL, and `effective_from`. Seed values only after verification. Mark stale or unmatched pricing as unavailable; never silently calculate with a guessed rate.

## Technical architecture

Use current mutually compatible stable releases at implementation time and pin them in lockfiles.

- `apps/web`: Next.js App Router, TypeScript in strict mode, Tailwind CSS, accessible headless primitives, TanStack Query, TanStack Table, and Apache ECharts.
- `apps/api`: Python, FastAPI, Pydantic, SQLAlchemy 2, Alembic, PostgreSQL with pgvector, Redis, and Celery.
- `packages/cli`: Python CLI using Typer. Reuse application schemas and API client code rather than duplicating domain rules.
- Tooling: `pnpm` workspace for frontend packages and `uv` workspace for Python packages.
- Contracts: FastAPI/Pydantic is the canonical API schema. Generate TypeScript API types from OpenAPI and check generated output for drift in CI.
- Local environment: Docker Compose services for web, API, worker, PostgreSQL/pgvector, and Redis. Ollama remains an optional host service with a configurable base URL.
- Observability: structured JSON logs, request/run/case correlation IDs, OpenTelemetry hooks, health/readiness endpoints, and safe error envelopes.

Organize backend code by domain and responsibility: API transport, domain models, repositories, services, provider adapters, evaluators, RAG, experiments, workers, and observability. Keep business rules out of route handlers and Celery task bodies.

Use idempotent jobs, bounded retries with exponential backoff and jitter, provider-aware concurrency limits, transaction-safe state changes, cancellation checks, and resumable aggregation. A worker retry must not duplicate a completed case or charge it twice.

## Canonical public contracts

Implement and document these concepts. Exact serialization may follow idiomatic Pydantic and TypeScript conventions, but field meaning must stay stable.

```python
ExecutionMode = Literal["fixture", "local", "cloud"]
RunStatus = Literal[
    "queued", "running", "cancel_requested",
    "cancelled", "completed", "failed",
]

class ProviderCapabilities(BaseModel):
    generation: bool
    embeddings: bool
    structured_output: bool
    streaming: bool
    tool_calling: bool
    token_usage: bool

class GenerationRequest(BaseModel):
    model: str
    messages: list[Message]
    temperature: float | None
    max_output_tokens: int | None
    response_schema: dict | None
    tools: list[ToolDefinition]
    metadata: dict[str, str]

class GenerationResult(BaseModel):
    text: str
    structured_output: dict | list | None
    tool_calls: list[ToolCall]
    provider: str
    model: str
    execution_mode: ExecutionMode
    input_tokens: int | None
    output_tokens: int | None
    cached_tokens: int | None
    latency_ms: int
    finish_reason: str | None
    raw_response: dict | None

class EmbeddingRequest(BaseModel):
    model: str
    inputs: list[str]

class EmbeddingResult(BaseModel):
    vectors: list[list[float]]
    provider: str
    model: str
    execution_mode: ExecutionMode
    input_tokens: int | None
    latency_ms: int

class EvaluationResult(BaseModel):
    score: float | None
    passed: bool | None
    label: str | None
    reason: str | None
    evidence: list[Evidence]
    evaluator_version_id: UUID
    metadata: dict
```

Define a typed `Evaluator` protocol and provider protocols for generation and embeddings. Add normalized error categories such as authentication, rate limit, timeout, unsupported capability, invalid response, safety block, and provider outage.

Define `TraceEvent` as a discriminated union for message, retrieval, model request, tool call, tool result, evaluation, retry, cache, and error events. Define `ToolCall` with stable call ID, name, validated arguments, result reference, timing, and status.

Expose versioned REST under `/api/v1`. Use cursor pagination for large collections. Use Server-Sent Events for run and training progress, including reconnect support and a final authoritative state fetch. Publish `schema_version: 1` for CLI YAML.

## Core data model

Create migrations and constraints for these domains:

- projects
- datasets, immutable dataset versions, and test cases with metadata slices
- prompts and immutable prompt versions with diffs
- provider/model configurations and capability snapshots
- evaluator definitions and immutable evaluator versions
- experiments, variants, runs, run cases, normalized model outputs, evaluation results, usage records, and pricing snapshots
- RAG corpora, documents, chunks, embedding records, retrieval results, generated answers, citations, and claim-support assessments
- traces, trace events, tool calls, and trajectory evaluations
- human reviews and judge/human agreement records
- training jobs, epochs, metrics, artifacts, and resource limits

Persist provenance for every run: dataset, prompt, evaluator and pricing version IDs; provider and model; execution mode; normalized parameters; configuration hash; source commit SHA when available; start/end times; usage; and retry counts.

## Product information architecture

Use this navigation hierarchy:

- Overview
- Experiments
- Datasets
- Prompts
- Providers
- Evaluators
- AI Lab
  - Prompt & Tokens
  - Embeddings
  - RAG Pipeline
  - Grounding & Hallucinations
  - Safety & Injection
  - Agents
  - Training
- Reviews
- Settings

Do not create dead routes or placeholder buttons. If a later-phase feature is not implemented yet, omit its navigation entry until it works.

## Design direction

Follow `design/UI_DIRECTION.md` as a product requirement.

Build a technical-editorial interface: IBM Plex Sans and IBM Plex Mono, warm neutral canvas, ink navigation, compact information density, firm alignment, thin borders, restrained corner radii, and blue as the action/data accent. Reserve green, amber, and red for semantic status.

Avoid generic AI startup styling: no gradients, glassmorphism, neon glows, decorative blobs, robot imagery, emoji, oversized marketing headings, floating cards, excessive pills, arbitrary icons, or default unmodified component-library layouts.

Use the mockups in `design/mockups/` as direction, not pixel-perfect screenshots. Preserve their hierarchy and density while implementing accessible responsive behavior and real application states.

Every screen must include considered loading, empty, partial, permission/capability, offline, error, retry, and long-content states. Keyboard navigation, visible focus, semantic headings, screen-reader labels, color-independent status communication, reduced motion, and WCAG AA contrast are required.

## Implementation phases

### Phase 1 — foundation and fixture product

- Create monorepo, pinned dependencies, Docker Compose, migrations, seed command, health checks, CI, linting, formatting, type checking, and test harnesses.
- Implement the design tokens, application shell, responsive navigation, generated OpenAPI client, and complete Czech/English locale structure.
- Implement `fixture`, `local`, and `cloud` provenance types and a provider capability registry.
- Seed a polished customer-support project with immutable dataset, prompt, evaluator, experiment, completed runs, regressions, RAG corpus, trace, and training history.
- Make the three reference screens fully functional against fixture data.

### Phase 2 — datasets, prompts, providers, and runs

- Implement projects, CSV/JSON/JSONL dataset import with preview and row-level validation, immutable versions, metadata slices, prompt versioning, and provider configuration health checks.
- Implement Fake, OpenAI, Anthropic, Gemini, Ollama, and configurable OpenAI-compatible generation adapters.
- Implement embedding adapters only where official capability exists; keep embedding configuration independent from generation.
- Implement run creation, queueing, worker execution, cancellation, retries, progress SSE, case drill-down, normalized usage, and reproducibility metadata.

### Phase 3 — evaluators

- Implement strict and normalized exact match, contains, regex, JSON Schema, semantic similarity, rubric-based LLM judge, and pairwise judge.
- Every evaluator has an immutable version, declared input requirements, output range, pass threshold, implementation kind, and limitations.
- LLM judge output must use structured validation. Store judge prompt, rubric, provider/model, raw result, parse failures, retries, and rationale intended for users.
- Pairwise judging randomizes answer position and can repeat with swapped positions. Report ties, position consistency, and variance.
- Do not present embedding similarity as factual correctness.

### Phase 4 — comparisons and quality gates

- Compare paired baseline and candidate cases. Classify improvements, unchanged cases, regressions, missing cases, and newly added cases.
- Show metric deltas, pass rate, cost, tokens, p50/p95/p99 latency, Pareto cost-quality view, and slices by metadata.
- Implement configurable quality gates and a paired bootstrap confidence interval with a stored random seed and documented assumptions.
- Implement content-addressed generation and evaluation caching. Include all behavior-affecting inputs and version IDs in canonical hashes.

### Phase 5 — interactive AI Lab

Build real interactive modules using the same providers, storage, and evaluators as the product.

**Prompt & Tokens**

- Compare prompt versions, temperature/top-p where supported, token counts, output variation, structured schema validation, latency, and cost.
- Label provider token counts as measured and fallback estimates as estimated.

**Embeddings**

- Enter a small corpus and query, calculate embeddings, inspect nearest neighbors and cosine similarity, and compare lexical with semantic retrieval.
- A 2D projection must state that it is a lossy visualization and not the original embedding space.

**RAG Pipeline**

- Accept bundled demo documents plus pasted text and safe TXT/Markdown/PDF uploads. Do not promise OCR.
- Expose parse, chunk, embed, retrieve, optional rerank, prompt assembly, generation, citation, and evaluation stages.
- Let users change chunk strategy, chunk size, overlap, retrieval method, `top_k`, embedding provider/model, generator, and optional reranker.
- Display chunk boundaries, ranks, similarity scores, retrieved context, final prompt, answer citations, timing, tokens, and cost per stage.
- Evaluate retrieval separately from generation. Include context precision/recall when reference data exists, response relevance, correctness, and faithfulness.

**Grounding & Hallucinations**

- Split an answer into inspectable claims and connect supported claims to retrieved source spans.
- Mark unsupported or contradicted claims as evaluator findings, never absolute truth. Display evaluator confidence and evidence.

**Safety & Injection**

- Include harmless bundled examples of instructions embedded in retrieved documents.
- Compare an unprotected pipeline with a defended pipeline that separates trusted instructions from untrusted content.
- Never execute instructions contained in uploaded documents.

### Phase 6 — Agent Lab

- Provide a bounded tool sandbox with deterministic tools such as calculator, corpus search, and fixture order lookup.
- Show the observable trajectory as timestamped trace events: messages, tool definitions, calls, validated arguments, results, errors, retries, and final answer.
- Evaluate goal completion, tool selection, argument correctness, tool-call precision/recall where labels exist, step count, redundant calls, and latency/cost.
- Never display or claim access to private model reasoning.

### Phase 7 — Training Lab

- Implement a real CPU-bounded PyTorch text-classification training job using a small bundled dataset and deterministic seed.
- Show train/validation split, batches, epochs, loss, accuracy, learning rate, gradient norm, confusion matrix, checkpoints, early stopping, and overfitting behavior.
- Stream job progress through SSE and support safe cancellation. Enforce runtime, memory, epoch, row, and artifact size limits.
- Add tokenizer inspection and a small transformer attention visualization. State clearly that attention weights are not guaranteed explanations.
- Make LoRA an optional capability-gated local extension. Do not download a large model automatically or imply that full LLM training runs on ordinary CPU hardware.

### Phase 8 — review, developer workflow, and hardening

- Implement human review queues, rubric scoring, comments, reviewer agreement, and LLM-judge versus human agreement.
- Implement `llmlab dataset import`, `llmlab run`, `llmlab compare`, and `llmlab export` against `schema_version: 1` YAML.
- Provide a GitHub Actions example that runs fixture evals and fails on configured gates without cloud spend.
- Add JSON/JSONL/CSV exports, a reproducibility manifest, structured logs, traces, metrics, backup/restore instructions, and production deployment notes.

## Required screens

### Project Dashboard

Show project context, fixture/local/cloud availability, recent run status, metric deltas, latency/cost, a quality-versus-cost plot, recent experiments, and regressions requiring review. Avoid a row of oversized generic statistic cards; use one coherent analytical workspace.

### Interactive RAG Lab

Use a three-region analytical layout: controls and run configuration, pipeline/stage visualization, and evidence inspector. Let the user inspect a selected chunk or claim without losing the pipeline context.

### Run Comparison

Show baseline and candidate provenance, quality-gate result, per-metric deltas, confidence interval, Pareto view, improvement/regression counts, filters, and a dense paired-case table. Selecting a case opens baseline output, candidate output, evaluator evidence, and source context.

## Testing and review gates

Use `pytest`, provider contract fixtures, migration tests, frontend unit/component tests, Playwright, and accessibility checks. Choose current stable tools and document commands.

Required coverage includes:

- evaluator normalization, thresholds, invalid schemas, adversarial regex input, semantic-similarity limitations, judge parse failures, position swapping, and variance
- chunk boundaries, overlap, empty documents, Unicode, retrieval ranking, missing references, claim-source mapping, and poisoned context
- pricing version selection, unavailable prices, token normalization, cache keys, retry idempotency, cancellation, state transitions, and aggregation after partial failure
- capability gating and normalized responses/errors for every provider adapter
- API migrations, repository transactions, Redis/Celery integration, SSE reconnect/final state, and generated OpenAPI type drift
- fixture experiment, dataset import, RAG run, comparison, case drill-down, agent trace, bounded training run, locale switch, loading/empty/error states, and keyboard flow
- layout at 1440, 1024, and 390 px; long Czech copy; reduced motion; focus visibility; color-independent statuses; no overflow

Live provider smoke tests are opt-in and run only when their environment variables exist. Tests must not spend cloud money by default.

At the end of every phase:

1. Run formatter checks without hiding rewrites, lint, strict type checks, unit tests, integration tests relevant to the phase, production builds, and Playwright flows.
2. Inspect the rendered UI at all required widths.
3. Search for TODOs, dead links, dead buttons, placeholder handlers, secrets, hardcoded locale strings, unlabeled fixture data, swallowed exceptions, and unbounded external calls.
4. Review migrations, API compatibility, capability claims, source citations, and user-facing limitations.
5. Fix all failures before starting the next phase.

Do not reduce quality gates to make CI green. Do not leave tests skipped except explicit live-provider tests with a documented reason.

## Acceptance criteria

- A fresh clone needs only Docker and Docker Compose for the seeded fixture product.
- `docker compose up --build` applies migrations, loads idempotent seed data, and starts healthy web, API, worker, database, and Redis services.
- The fixture flow works without API keys from dashboard through run comparison and case evidence.
- Local Ollama and cloud providers activate through capability checks without changing application code.
- Czech and English cover all visible product copy, validation messages, empty states, chart labels, and tooltips.
- All visible actions work. No shipped view contains placeholder controls or fabricated live status.
- Run records are reproducible and contain exact provenance.
- RAG stages, agent traces, and training jobs expose real observable intermediate data.
- CI passes linting, type checking, tests, builds, accessibility checks, and the core Playwright journey.
- README explains setup, execution modes, architecture, limitations, screenshots, demo flow, and how to verify a real provider without exposing credentials.

When a choice is not specified, choose the smallest robust design consistent with these requirements. Record important decisions in concise ADRs. Preserve existing user work. Ask only when a decision changes scope, incurs external cost, requires a secret, or risks destructive data loss.
