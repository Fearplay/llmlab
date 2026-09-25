"""Versioned, conservative USD estimates from first-party standard API price lists.

Only explicitly listed model IDs receive a price. Provider-specific discounts,
regional multipliers, tools, media, and negotiated rates are outside this table.
"""

from dataclasses import asdict, dataclass
from decimal import Decimal

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["pricing"])
CATALOG_VERSION = "2026-09-24"
SOURCES = {
    "openai": "https://developers.openai.com/api/docs/pricing",
    "anthropic": "https://platform.claude.com/docs/en/about-claude/pricing",
    "gemini": "https://ai.google.dev/gemini-api/docs/pricing",
}


@dataclass(frozen=True)
class Price:
    input_per_million_usd: Decimal
    output_per_million_usd: Decimal
    cached_input_per_million_usd: Decimal | None = None
    tier: str = "standard"


PRICES: dict[str, Price] = {
    "openai:gpt-6-astra": Price(Decimal("10"), Decimal("50"), Decimal("1")),
    "openai:gpt-6-sol": Price(Decimal("2"), Decimal("10"), Decimal("0.2")),
    "openai:gpt-6-luna": Price(Decimal("0.1"), Decimal("0.5"), Decimal("0.01")),
    "anthropic:claude-sonnet-4-6": Price(Decimal("3"), Decimal("15"), Decimal("0.3")),
    "anthropic:claude-haiku-4-5": Price(Decimal("1"), Decimal("5"), Decimal("0.1")),
    "anthropic:claude-opus-4-6": Price(Decimal("5"), Decimal("25"), Decimal("0.5")),
    "gemini:gemini-3.5-flash-lite": Price(Decimal("0.3"), Decimal("2.5"), Decimal("0.03")),
    "gemini:gemini-3.1-flash-lite": Price(Decimal("0.25"), Decimal("1.5"), Decimal("0.025")),
}


def price_catalog() -> dict[str, object]:
    return {
        "version": CATALOG_VERSION,
        "currency": "USD",
        "unit": "1M tokens",
        "sources": SOURCES,
        "prices": {
            key: {**asdict(value), "input_per_million_usd": float(value.input_per_million_usd),
                  "output_per_million_usd": float(value.output_per_million_usd),
                  "cached_input_per_million_usd": (
                      float(value.cached_input_per_million_usd)
                      if value.cached_input_per_million_usd is not None else None
                  ), "source": SOURCES[key.split(":", 1)[0]], "verified_at": CATALOG_VERSION,
                  **({"long_context_threshold": 272_000,
                      "long_input_per_million_usd": float(value.input_per_million_usd * 2),
                      "long_output_per_million_usd": float(
                          value.output_per_million_usd * Decimal("1.5")
                      ),
                      "long_cached_input_per_million_usd": float(
                          (value.cached_input_per_million_usd or Decimal(0)) * 2
                      )} if key.startswith("openai:gpt-6-") else {})}
            for key, value in PRICES.items()
        },
        "limitations": "Text token estimates for standard paid API rates only; invoice may differ.",
    }


@router.get("/prices")
def list_prices() -> dict[str, object]:
    return price_catalog()


def price_for(model_key: str) -> dict[str, object] | None:
    price = PRICES.get(model_key)
    if price is None:
        return None
    provider = model_key.split(":", 1)[0]
    return {
        "model_key": model_key,
        "input_per_million_usd": float(price.input_per_million_usd),
        "output_per_million_usd": float(price.output_per_million_usd),
        "cached_input_per_million_usd": (
            float(price.cached_input_per_million_usd)
            if price.cached_input_per_million_usd is not None else None
        ),
        "tier": price.tier,
        "source": SOURCES[provider],
        "verified_at": CATALOG_VERSION,
        **({"long_context_threshold": 272_000,
            "long_input_per_million_usd": float(price.input_per_million_usd * 2),
            "long_output_per_million_usd": float(price.output_per_million_usd * Decimal("1.5")),
            "long_cached_input_per_million_usd": float(
                (price.cached_input_per_million_usd or Decimal(0)) * 2
            )} if model_key.startswith("openai:gpt-6-") else {}),
    }


def estimate_usage_cost(model_key: str, usage: dict[str, object]) -> dict[str, object]:
    def count(name: str) -> int:
        value = usage.get(name)
        return int(value) if isinstance(value, int | float | str) else 0

    provider, _, model = model_key.partition(":")
    estimate = estimate_cost(
        provider, model,
        count("input_tokens"), count("output_tokens"), count("cached_tokens"),
    )
    if "cost_usd" in usage and usage["cost_usd"] is None and provider not in {
        "ollama", "fixture"
    }:
        estimate = None
    if provider not in {"ollama", "fixture"} and not any(
        count(name) for name in ("input_tokens", "output_tokens", "cached_tokens")
    ):
        estimate = None
    return {
        "estimated_usd": estimate,
        "price": price_for(model_key),
        "status": "local_api_free" if provider in {"ollama", "fixture"}
        else "estimated" if estimate is not None else "unknown",
        "verified_at": CATALOG_VERSION,
    }


def estimate_cost(
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int = 0,
    cached_tokens: int = 0,
) -> float | None:
    """Return None for unknown prices or usage; local API fee is zero."""
    if min(input_tokens, output_tokens, cached_tokens) < 0 or cached_tokens > input_tokens:
        raise ValueError("Invalid token counts")
    if provider in {"ollama", "fixture"}:
        return 0.0
    price = PRICES.get(f"{provider}:{model}")
    if price is None:
        return None
    if cached_tokens and price.cached_input_per_million_usd is None:
        return None
    long_context = provider == "openai" and model.startswith("gpt-6-") and input_tokens > 272_000
    input_rate = price.input_per_million_usd * (2 if long_context else 1)
    output_rate = price.output_per_million_usd * (Decimal("1.5") if long_context else 1)
    cached_rate = (price.cached_input_per_million_usd or Decimal(0)) * (
        2 if long_context else 1
    )
    raw = (
        Decimal(input_tokens - cached_tokens) * input_rate
        + Decimal(output_tokens) * output_rate
        + Decimal(cached_tokens) * cached_rate
    ) / Decimal(1_000_000)
    return float(raw)
