# Source decisions

Checked 2026-09-12. Provider adapters must be rechecked before model-specific capability or price changes.

| Area | Source | Decision |
| --- | --- | --- |
| OpenAI generation | <https://developers.openai.com/api/reference/resources/responses/methods/create> | Use `POST /v1/responses`; normalize output content, tools, status, and usage. Do not assume the first output item is text. |
| OpenAI evals | <https://developers.openai.com/api/reference/resources/evals> | LLMLab owns its cross-provider evaluator contracts while keeping terminology compatible with datasets, runs, and graders. |
| Anthropic | <https://platform.claude.com/docs/en/api/http/messages> | Use Messages API and its provider-native usage fields. |
| Gemini | <https://ai.google.dev/api/generate-content> | Use `generateContent`; normalize candidates, blocking, and usage metadata. |
| Ollama | <https://docs.ollama.com/api/openai-compatibility> | Use documented OpenAI-compatible endpoints only for supported capabilities. |
| RAG metrics | <https://docs.ragas.io/en/stable/concepts/metrics/> | Keep retrieval metrics separate from answer faithfulness/relevance. Labels include evaluator and limitations. |

No live model price is hardcoded. Fixture costs are demo records, not provider price claims.

