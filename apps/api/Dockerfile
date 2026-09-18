FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --extra training
COPY . .
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "llmlab_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
