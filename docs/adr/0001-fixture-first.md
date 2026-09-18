# ADR 0001: Fixture-first product

## Status

Accepted.

## Decision

LLMLab ships a complete deterministic fixture dataset and runs without provider keys. Live local and cloud results use the same normalized contracts and carry explicit provenance.

## Consequences

- Reviewers can inspect every core flow without cost or credentials.
- Fixture values must never be presented as live measurements.
- Provider capability and availability remain runtime concerns, not hidden fallbacks.

