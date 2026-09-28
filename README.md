# LLMLab

A local workbench for learning how language models behave, comparing real responses, and inspecting the evidence behind a run. Fields show short examples; live model requests run only after you click.

[Česká verze](README.cs.md)

## Contents

- [Preview](#preview)
- [Install the tools (beginners)](#installation)
- [Download LLMLab](#download)
- [Install project dependencies and start](#first-start)
- [Your first experiment](#first-experiment)
- [Troubleshooting](#troubleshooting)
- [Optional dependencies](#optional-dependencies)
- [Sections and AI labs](#sections)
- [Lab backups](#lab-backups)
- [Cloud models and cost](#cloud-models-and-cost)
- [Development and screenshots](#development)
- [License and third-party credits](#license)

## Preview

These screenshots use a clean browser profile, an illustrative local model catalog, and empty run and document lists. They contain no personal runs or credentials.

**Overview:** start a lab and inspect saved runs, token usage, and estimated API cost.

![LLMLab overview in English with an empty run history](docs/screenshots/overview-en.png)

**RAG pipeline:** prepare a document, choose chunking and models, then inspect the answer beside its evidence.

![LLMLab RAG pipeline in English with no uploaded documents](docs/screenshots/rag-en.png)

<a id="installation"></a>

## Install the tools (beginners)

There are two installation steps: tools installed on your computer, then libraries installed inside this project. `start.py` installs project libraries automatically; it cannot install Python, Node.js, pnpm, uv, or Ollama for you. Internet access is needed for the first installation and model downloads. Docker, a paid API key, and a dedicated GPU are not required for the basic local setup; model speed and memory requirements depend on your computer.

### Windows 10/11

Open **Start → PowerShell**. This is the terminal where you paste commands, one line at a time, and press Enter. Do not copy the surrounding Markdown fences. Commands below assume you use PowerShell.

| Tool | Why you need it | Installation |
| --- | --- | --- |
| Python 3.12+ | Runs the API and `start.py`. | Use the [Python installer](https://www.python.org/downloads/windows/). Enable **Add python.exe to PATH** if offered. |
| Node.js 22.13+ | Runs the web app; includes npm. | Use the [Node.js LTS installer](https://nodejs.org/en/download). Keep npm selected. |
| uv | Installs Python libraries in an isolated environment. | Run the command below; see [official uv instructions](https://docs.astral.sh/uv/getting-started/installation/#winget) for alternatives. |
| pnpm 11.19.0 | Installs the web libraries at the version pinned in `package.json`. | Install with npm below. |
| Ollama | Runs local language and embedding models. | Download and open [Ollama for Windows](https://ollama.com/download/windows). It runs separately from LLMLab. |

After installing Python and Node.js, **close PowerShell and open a new window**, then run:

```powershell
winget install --id astral-sh.uv -e
npm.cmd install --global pnpm@11.19.0
```

If `winget` is unavailable, use the [uv installation page](https://docs.astral.sh/uv/getting-started/installation/) instead. Close and reopen PowerShell again after installation. Check every tool:

```powershell
python --version
node --version
npm.cmd --version
pnpm.cmd --version
uv --version
ollama --version
```

Each command should print a version, rather than “command not found”. Python must be at least 3.12, Node.js at least 22.13, and pnpm should be 11.19.0. The `.cmd` suffix avoids PowerShell script-policy errors without changing your system policy.

### macOS and Linux

Install [Python 3.12+](https://www.python.org/downloads/), [Node.js 22.13+](https://nodejs.org/en/download), [uv](https://docs.astral.sh/uv/getting-started/installation/), and [Ollama](https://ollama.com/download) using their instructions for your operating system, then run `npm install --global pnpm@11.19.0`. Use `python3` in place of `python`, and `pnpm` in place of `pnpm.cmd`, in the steps below. If Ollama is not already running, keep `ollama serve` open in a separate terminal.

<a id="download"></a>

## Download LLMLab

The easiest route needs no Git installation: on [the repository page](https://github.com/Fearplay/llmlab), click **Code → Download ZIP**, then extract the ZIP. Open the extracted folder that contains `start.py` and `package.json`. On Windows, type `powershell` in File Explorer's address bar and press Enter to open a terminal in that folder.

If you already use [Git](https://git-scm.com/downloads), you can instead run:

```powershell
git clone https://github.com/Fearplay/llmlab.git LLMLab
cd LLMLab
```

All remaining project commands run from this folder. If the repository is renamed, copy its current clone URL from **Code** on GitHub; the local folder can still be named `LLMLab`.

<a id="first-start"></a>

## Install project dependencies and start

First, open Ollama. Download a small generation model for answers and an embedding model for document search:

```powershell
ollama pull qwen3.5:2b
ollama pull all-minilm
ollama list
```

Wait for both downloads to finish. [Qwen3.5 2B](https://ollama.com/library/qwen3.5:2b) is a smaller starting point than the 9B variant, but still needs several GB of free disk space and additional memory when loaded. [all-minilm](https://ollama.com/library/all-minilm) is an English-focused embedding model: for Czech or other languages, choose an appropriate multilingual embedding model in the app. LLMLab lists models actually available in your Ollama server.

To install the project libraries **before** launching anything, run:

```powershell
pnpm.cmd install --frozen-lockfile
uv sync --locked --project apps/api --cache-dir .uv-cache
```

The first command installs the web dependencies into `node_modules`; the second creates `apps/api/.venv` and installs the API dependencies. The lockfiles select matching package versions. You do not need to activate the environment, install packages one by one, or create a `.env` file for the basic local setup.

Start the application:

```powershell
python start.py
```

The launcher also performs these dependency checks itself, so the separate installation commands are optional. Leave this terminal open. When it prints `LLMLab: http://127.0.0.1:3000`, open **[LLMLab](http://127.0.0.1:3000)** in your browser. The **[API reference](http://127.0.0.1:8000/docs)** is optional, for developers. Local records are stored in `.local-data/lab.sqlite3`.

To stop, press **Ctrl+C** in the terminal. To start again later, open Ollama, open a terminal in the same project folder, and run `python start.py`. There is no need to download the same models again.

<a id="first-experiment"></a>

## Your first experiment

1. Choose **EN** or **CZ** in the top right.
2. Choose `qwen3.5:2b` in the model picker.
3. Open **AI Lab → Foundations → Prompt & tokens**.
4. Enter `Explain what a language model is in three short sentences.` and click **Run**.
5. Inspect the answer, elapsed time, and tokens. The saved run appears in **Run history**.

Local Ollama calls need no API key. To learn individual concepts, open **AI Lab** and choose one of the four groups. Fields include explanations and examples.

<a id="troubleshooting"></a>

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `python`, `node`, `uv`, or `ollama` is not recognized | Install the tool above and reopen the terminal. On Windows, if `python` opens the Store, rerun the Python installer with PATH enabled or try `py -3.12 start.py` if Python 3.12 is installed. |
| `npm.ps1` or `pnpm.ps1` cannot run | Use `npm.cmd` / `pnpm.cmd`, as in the Windows commands above. |
| `start.py` or `package.json` cannot be found | You are in the wrong folder. Open the extracted project folder, or use `cd "C:\path\to\LLMLab"` with your actual path. |
| Dependency installation fails or a download times out | Check internet access and disk space, then rerun the two dependency installation commands. Keep the lockfiles; do not replace them with unrelated package versions. |
| Ports 3000 or 8000 are already in use | Stop a previous LLMLab terminal with Ctrl+C, or stop the app using that port, then retry. |
| No models, or Ollama is unavailable | Open Ollama and run `ollama list`. If empty, download a model. Visit **Providers** and refresh the catalog. On macOS/Linux, start `ollama serve` if needed. |
| A model runs out of memory or responds slowly | Choose a smaller model, close memory-heavy apps, and reduce the context/output size. Larger models require more RAM/VRAM. |
| RAG has no embedding model | Run `ollama pull all-minilm`, refresh models, and select it in **RAG pipeline**. Use a multilingual model for non-English documents. |

If startup still fails, inspect the **first error in the terminal**. The browser URL becomes available only after the web server starts.

<a id="optional-dependencies"></a>

## Optional dependencies

The basic setup above covers prompts, model comparison, document uploads, and RAG with Ollama embeddings. These extras are for specific features or development; they are not required to start:

| Extra | Command from the project folder | Purpose |
| --- | --- | --- |
| Python development tools | `uv sync --locked --project apps/api --extra dev --cache-dir .uv-cache` | API tests, lint, and type checks. |
| PyTorch training API | `uv sync --locked --project apps/api --extra training --cache-dir .uv-cache` | Optional PyTorch training endpoint; large download. Flappy DQN uses NumPy and works with the base dependencies. |
| Local sentence-transformers | `uv sync --locked --project apps/api --extra rag --cache-dir .uv-cache` | Optional embedding backend; see [multilingual RAG](docs/multilingual-rag.md) for model configuration. |
| Browser tests | `pnpm.cmd --dir apps/web exec playwright install chromium` | Browser needed by Playwright tests; separate from normal use. |

Combine extras when needed, for example `--extra dev --extra training`. A normal `uv sync` keeps only the extras requested by that command; include all the extras you want to keep. `start.py` preserves extras you have already installed. Model weights downloaded by Ollama or sentence-transformers have their own licenses and are not shipped in this repository.

## Sections

The sidebar keeps these destinations in this order. **AI Lab** has its own overview and four expandable groups: **Foundations**, **Knowledge & RAG**, **Applications**, and **Model operations**. **Settings** and **Documentation** sit in the footer.

| Section | Route | What it does |
| --- | --- | --- |
| Overview | `/` | Start from a prompt, arena, RAG, or Flappy AI; inspect real run counts, token usage, estimated cost, and recent saved runs. |
| Model arena | `/arena` | Send one prompt or dataset to several available models; compare answers, latency, token usage, and estimated cost. |
| Datasets | `/datasets` | Create and import CSV, JSON, or JSONL test cases, choose evaluation checks, and run them against a model. |
| Prompts | `/prompts` | Save and compare prompt versions and inspect differences between them. |
| Providers | `/providers` | See available generation and embedding providers and test their connections. |
| Evaluators | `/evaluators` | Learn the scoring methods and inspect the latest evaluation from real model answers. |
| AI Lab | `/ai-lab` | Choose a concept from the four groups below; inspect explanations, examples, and experiments. |
| AI Lab → Prompt & Tokens | `/ai-lab/prompt-tokens` | Run prompts with system instructions, temperature, top-p, output limits, stop sequences, and supported JSON schemas; inspect token estimates and actual usage. |
| AI Lab → Embeddings | `/ai-lab/embeddings` | Compare the vectors for two texts using an available embedding model and inspect cosine similarity. |
| AI Lab → RAG Pipeline | `/ai-lab/rag` | Paste text or upload PDF, DOCX, TXT, or Markdown; inspect chunking, indexing, retrieval, answer excerpts, and citations. Citations alone do not establish factual support. |
| AI Lab → Safety & Injection | `/ai-lab/safety` | Try explained prompt injections and run three harmless probes against your own system prompt. |
| AI Lab → Agents | `/ai-lab/agents` | Inspect simulated tools or let an agent read LLMLab documents and datasets. Every write to a document, dataset, or note pauses for one-step approval. |
| AI Lab → Flappy AI | `/ai-lab/flappy` | Play prepared challenges and inspect replay decisions with pause, step controls, and speed selection. |
| Reviews | `/reviews` | Mark saved model answers useful or not useful and store notes alongside the run. |
| Run history | `/history` | Browse saved runs and open comparisons and detailed results. |
| Cost & operations | `/operations` | Inspect daily runs, model token totals, provider status, price catalog, and known API cost estimates. Unknown prices remain unknown. |
| Settings | `/settings` | Change local preferences, check API and model readiness, and export or restore a complete lab backup. |
| Documentation | `/docs` | Follow guided missions, inspect a progress map based on real runs, and add personal glossary notes. |

### AI labs

Concept labs distinguish explanatory calculations and simulations from real model calls. See each lab's explanations and run status.

| Group | Labs and routes |
| --- | --- |
| Foundations | Tokenization `/ai-lab/tokenizer`; Transformer `/ai-lab/transformer`; Generation `/ai-lab/generation`; Prompt & tokens `/ai-lab/prompt-tokens`; Context `/ai-lab/context`; Embeddings `/ai-lab/embeddings`. |
| Knowledge & RAG | Chunking `/ai-lab/chunking`; Retrieval `/ai-lab/retrieval`; Reranking `/ai-lab/reranking`; RAG pipeline `/ai-lab/rag`; Retrieval quality `/ai-lab/retrieval-evals`; Grounding `/ai-lab/grounding`. |
| Applications | Structured output `/ai-lab/structured-output`; Tool calling `/ai-lab/tools`; Agents `/ai-lab/agents`; MCP `/ai-lab/mcp`; Safety `/ai-lab/safety`; Flappy AI `/ai-lab/flappy`. |
| Model operations | Model routing `/ai-lab/routing`; Inference `/ai-lab/inference`; Cache `/ai-lab/cache`; KV cache `/ai-lab/kv-cache`; Quantization `/ai-lab/quantization`; Fine-tuning `/ai-lab/fine-tuning`. |

## Lab backups

Use **Settings → Back up the entire lab** to download a versioned ZIP with database records, saved browser preferences and learning notes, uploaded document originals when available, and the Flappy DQN checkpoint. API keys, `.env`, and downloaded models are excluded. Select a ZIP to inspect its contents. **Back up and restore** downloads the current state first, then replaces local data. Restoration validates checksums and database shape before writing; failed database imports roll back. Documents created before original-file storage retain their extracted text and index, but cannot offer the old original for download.

The local API exposes `/api/v1/backups/export`, `/inspect`, and `/restore`; `/api/v1/preflight`; document version routes under `/api/v1/user-documents/{id}/versions`; `/api/v1/agent/runs/{id}/approval`; and `/api/v1/agent/safety/assessments`. These routes also appear in the API reference at `http://127.0.0.1:8000/docs`.

The run comparison has its own route at `/experiments/compare`. Older links to `/experiments`, `/knowledge-base`, and `/ai-lab/training` redirect to their current sections. `/ai-lab/grounding` now has its own lab.

## Cloud models and cost

Add OpenAI, Anthropic, or Gemini credentials under **Settings → Cloud API keys**, or set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` in the server `.env`. The API never returns a stored secret to the browser. Local Ollama requires no key. The model picker reflects the current `GET /api/tags` response from Ollama and configured cloud providers.

For an OpenAI-compatible server, set `OPENAI_COMPATIBLE_BASE_URL` in the server `.env`. If that server requires authentication, add `OPENAI_COMPATIBLE_API_KEY` in Settings or `.env`.

Prices are conservative estimates for listed standard text API rates, not invoices. Context tiers, cached usage, tools, regions, and multimodal input may change the actual charge. See the [OpenAI](https://developers.openai.com/api/docs/pricing), [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), and [Gemini](https://ai.google.dev/gemini-api/docs/pricing) price lists.

## Development

Install [the base project dependencies](#first-start) and the `dev` extra first. On Windows, use `pnpm.cmd` for the commands below if PowerShell blocks `pnpm.ps1`.

```powershell
pnpm --dir apps/web lint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test
pnpm build
pnpm --dir apps/web exec playwright install chromium
pnpm test:e2e
uv run --project apps/api --extra dev pytest -q apps/api/tests
```

[CI](.github/workflows/ci.yml) runs lint, type checks, unit tests, a production build, Playwright checks at desktop, tablet, and mobile sizes, and API tests on every push and pull request. The navigation test protects the sidebar groups, order, labels, active section, and every linked route. Playwright runs against the production build in CI.

The frontend uses Next.js 16 and React 19. The API uses FastAPI and SQLAlchemy. `start.py` uses local SQLite even when `.env` contains Docker service addresses. Docker Compose remains available for PostgreSQL and Redis deployment, but is not needed for the local workflow. Existing records from another project are not imported automatically.

For reproducible README screenshots with synthetic API data and isolated browser storage, see [the screenshot workflow](docs/screenshots/README.md).

## License

LLMLab source code is under [MIT](LICENSE). Third-party packages and IBM Plex fonts retain their own terms; see [credits, license texts, and redistribution details](THIRD_PARTY_NOTICES.md), the generated [web runtime notices](THIRD_PARTY_NODE_NOTICES.txt), [web development notices](THIRD_PARTY_NODE_DEV_NOTICES.txt), and [API notices](THIRD_PARTY_PYTHON_NOTICES.txt). Docker images regenerate package notices for their platform; native binary/source obligations are described in the credits document.
