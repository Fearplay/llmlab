# LLMLab

A local workbench for learning how language models behave, comparing real responses, and inspecting the evidence behind a run. The app starts empty: examples appear only when you explicitly load them.

[Česká verze](README.cs.md)

## Start locally

Install Python 3.12+, Node.js 22+, `pnpm`, `uv`, and [Ollama](https://ollama.com/). Ollama runs separately; LLMLab discovers the models you have installed.

```powershell
ollama pull qwen3.5:9b
ollama pull all-minilm
python start.py
```

Open **http://127.0.0.1:3000**. The API reference is at **http://127.0.0.1:8000/docs**. The start command installs the locked dependencies, launches the API and web app, and stores local data in `.local-data/lab.sqlite3`. Stop it with `Ctrl+C`.

Pick an available model at the top right, then try **Prompts & tokens**. Your input, model settings, response, timing, and reported token usage are saved under **Run history**.

## Explore

| Area | What you can do |
| --- | --- |
| Prompts & tokens | Follow nine lessons and vary system instructions, temperature, top-p, output limit, stop sequences, and JSON schema. |
| Model arena | Run the same prompt on up to eight available models. Compare answers, latency, tokens, and estimated cost. Reference based grading, an optional judge model, and evidence order checks are available. |
| Datasets & evaluation | Create datasets manually or import CSV, JSON, or JSONL. Run exact, partial, contains, or JSON schema checks. |
| RAG | Upload your own PDF, DOCX, TXT, or Markdown files; try four chunking methods, embeddings, top-k retrieval, optional BM25 reranking, and excerpt citations. Citation markers do not prove every claim is factually supported. |
| Agents & safety | Use bounded simulated file, database, and calculator tools with memory and reflection settings. Safety exercises use a fake key and simulated operations. |
| Flappy AI | Play yourself or run random, rule, LLM, or trained DQN agents. Inspect scores, decisions, replays, and DQN checkpoints. LLM agents receive game state, not image frames. |
| Cost & operations | See daily runs, token charts, model totals, and estimates based on provider price lists. Unknown prices remain unknown. |

## Cloud models and cost

Add OpenAI, Anthropic, or Gemini credentials under **Settings → Connections**, or set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` in the server `.env`. The API never returns a stored secret to the browser. Local Ollama requires no key. The model picker reflects the current `GET /api/tags` response from Ollama and configured cloud providers.

Prices are conservative estimates for listed standard text API rates, not invoices. Context tiers, cached usage, tools, regions, and multimodal input may change the actual charge. See the [OpenAI](https://developers.openai.com/api/docs/pricing), [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), and [Gemini](https://ai.google.dev/gemini-api/docs/pricing) price lists.

## Development

```powershell
pnpm --dir apps/web lint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test
uv run --project apps/api --extra dev pytest -q apps/api/tests
```

The frontend uses Next.js 16 and React 19. The API uses FastAPI and SQLAlchemy. `start.py` uses local SQLite even when `.env` contains Docker service addresses. Docker Compose remains available for PostgreSQL and Redis deployment, but is not needed for the local workflow. Existing records from another project are not imported automatically.
