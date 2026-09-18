.PHONY: dev build test lint up down api-test web-test

dev:
	pnpm dev

build:
	pnpm build

test: web-test api-test

lint:
	pnpm lint
	cd apps/api && uv run ruff check .
	cd apps/api && uv run mypy llmlab_api

web-test:
	pnpm test

api-test:
	cd apps/api && uv run pytest

up:
	docker compose up --build

down:
	docker compose down

