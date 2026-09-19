# LLMLab

**A self-hosted workbench for evaluating prompts, models, RAG pipelines, and agents with reproducible evidence.**

[Česká verze](README.cs.md) · [Architecture decision](docs/adr/0001-fixture-first.md) · [Source notes](docs/sources.md)

![LLMLab project dashboard](design/mockups/01-project-dashboard.png)

LLMLab treats AI-system changes like software changes: version the inputs, run a controlled experiment, inspect individual failures, and keep the exact provenance of every result. A deterministic fixture mode makes the full product explorable without API keys or paid requests.

## Real multilingual RAG

RAG, Embeddings, Grounding, and Knowledge Base use a tracked synthetic English corpus for the
fictional Atlas Works organisation. Czech and English questions run through a real local vector +
BM25 retrieval pipeline; only Fixture generation is deterministic. See
[the multilingual RAG guide](docs/multilingual-rag.md) for models, index lifecycle, modes, privacy,
API contracts, adding documents, and current limitations.

## Why LLMLab

- Compare prompt and model variants on the same immutable dataset.
- Inspect quality, pass rate, latency, cost, regressions, and paired cases.
- Trace RAG retrieval, reranking, evidence, claims, and grounding findings.
- Exercise agent tool calls without exposing private chain-of-thought.
- Test prompt injection boundaries and human-review workflows.
- Run bounded local training and observe loss, gradients, validation, and overfitting.
- Switch between deterministic fixture, local Ollama, and configured cloud providers.
- Use the complete interface in English or Czech, with light and dark themes.

## Product status

LLMLab is a production-oriented reference implementation, not a hosted service. The repository includes a complete UI, API contracts, persistence, queueing, tests, Docker services, and deterministic sample flows.

| Capability | Status |
| --- | --- |
| Fixture evaluation flows | Complete and deterministic |
| Local Ollama generation | Available after configuration |
| OpenAI, Anthropic, Gemini, compatible APIs | Available after server-side key configuration |
| PostgreSQL persistence and Redis/Celery queue | Included in Docker Compose |
| Live RAG over a custom vector collection | Requires integration |
| Queued live-provider experiment batches | Requires integration |
| Authentication, authorization, rate limits, backups | Deployment responsibility |

Fixture values are always labeled. LLMLab never presents a seeded result as a live provider response.

## Quick start with Docker

Requirements: Docker Engine with Docker Compose.

~~~bash
cp .env.example .env
docker compose up --build
~~~

On PowerShell:

~~~powershell
Copy-Item .env.example .env
docker compose up --build
~~~

Open [http://localhost:3000](http://localhost:3000). No provider key is required.

Services:

- Web UI: http://localhost:3000
- API and OpenAPI: http://localhost:8000 and http://localhost:8000/docs
- PostgreSQL with pgvector: localhost:5432
- Redis: localhost:6379

Stop the stack:

~~~bash
docker compose down
~~~

Add **--volumes** only when you intentionally want to remove local PostgreSQL and Redis data.

## Execution modes

| Mode | Purpose | Network and cost |
| --- | --- | --- |
| **Fixture** | Reproducible walkthroughs and tests | No provider key, no paid request |
| **Local** | Generation and embeddings through Ollama | Stays on the configured Ollama host |
| **Cloud** | OpenAI, Anthropic, Gemini, or compatible endpoints | Runs only after an explicit user action |

Every result records its mode, provider, model, configuration, token usage when available, and timing. Provider keys stay in the API service and must never use the **NEXT_PUBLIC_** prefix.

## Architecture

~~~text
Browser
  |
  +-- Next.js 16 / React 19 web app
  |       |
  |       +-- /api/v1 proxy
  |
  +-- FastAPI service
          +-- PostgreSQL + pgvector
          +-- Redis
          +-- Celery worker
          +-- provider adapters
          +-- evaluators and RAG contracts
          +-- Server-Sent Events for run progress
~~~

The web application falls back to bundled fixture data when the API is unavailable. Docker Compose enables the complete persistence, queue, and event-streaming path.

## Repository layout

~~~text
apps/
  web/          Next.js product UI and Playwright tests
  api/          FastAPI service, migrations, worker, and pytest suite
packages/
  cli/          Python API client
config/         Versioned model pricing metadata
design/         UI direction, mockups, and image prompts
docs/           Architecture decisions and source notes
examples/       Reproducible experiment definitions
~~~

## Local development

Requirements:

- Node.js 22 or newer
- pnpm 11.19
- Python 3.12 or newer
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL and Redis, or Docker for those services

Install and start the web app:

~~~bash
pnpm install
pnpm dev
~~~

Start the API in another terminal:

~~~bash
cd apps/api
uv sync --extra training --extra dev
uv run uvicorn llmlab_api.main:app --reload
~~~

The default URLs are http://localhost:3000 for the UI and http://localhost:8000 for the API.

## Configuration

Copy **.env.example** to **.env**. These are the main settings:

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | PostgreSQL connection used by the API |
| REDIS_URL | Redis broker and result transport |
| OPENAI_API_KEY | Optional OpenAI access |
| ANTHROPIC_API_KEY | Optional Anthropic access |
| GEMINI_API_KEY | Optional Gemini access |
| OPENAI_COMPATIBLE_BASE_URL | Optional compatible API base URL |
| OPENAI_COMPATIBLE_API_KEY | Optional compatible API key |
| OLLAMA_BASE_URL | Ollama-compatible local endpoint |
| GIT_SHA | Revision stored with reproducibility metadata |

Never commit **.env**. The tracked **.env.example** contains only safe placeholders and local defaults.

## Common workflows

### Evaluate without credentials

1. Keep execution mode on **Fixture**.
2. Create or edit a prompt version.
3. Start an experiment from the overview.
4. Compare the candidate with its baseline.
5. Inspect regressions and evaluator evidence.

### Use a local model

1. Start Ollama and pull a supported model.
2. Set **OLLAMA_BASE_URL**.
3. Select **Local** in Prompt Lab.
4. Enter or choose the exact model ID.
5. Run the prompt and inspect measured usage and latency.

### Use a cloud model

1. Set the provider key in the API environment.
2. Restart the API service.
3. Check provider capability status in **Providers**.
4. Select **Cloud** in Prompt Lab.
5. Choose a verified model ID or type another ID available to the account.

## Verification

Run web checks:

~~~bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
~~~

Run API checks:

~~~bash
cd apps/api
uv run ruff check .
uv run mypy llmlab_api
uv run pytest
~~~

Default tests make no paid provider requests. Live-provider checks must stay opt-in.

## Production checklist

Before exposing LLMLab outside a trusted local network:

- Replace all local database passwords.
- Put TLS and an authenticated reverse proxy in front of web and API services.
- Add organization-specific authentication, authorization, and tenant isolation.
- Restrict CORS to deployed origins.
- Store provider keys in a secret manager and rotate them regularly.
- Configure database backups, retention, and restore drills.
- Add rate limits, request-size limits, audit logging, and alerting.
- Pin and scan container images and dependencies.
- Review data retention for prompts, retrieved documents, model outputs, and human reviews.
- Validate evaluator thresholds on domain-specific data before using them as release gates.

## Design principles

LLMLab uses a dense evaluation-workbench layout rather than a generic card dashboard. Information hierarchy comes from provenance strips, tables, evidence panels, and explicit states. All interactive controls support keyboard focus, reduced motion, responsive layouts, and both color themes.

See [design/UI_DIRECTION.md](design/UI_DIRECTION.md) for the visual system.

## Contributing

Keep fixtures deterministic, mark provenance visibly, and add tests for behavior changes. Run the relevant web and API checks before opening a pull request. Do not add live network calls to the default test suite.

## License

Released under the [MIT License](LICENSE).
