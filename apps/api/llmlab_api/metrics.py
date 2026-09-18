import math
import random
from dataclasses import dataclass


@dataclass(frozen=True)
class BootstrapResult:
    delta: float
    lower: float
    upper: float
    p_value: float


def paired_bootstrap(
    baseline: list[float], candidate: list[float], samples: int = 2000, seed: int = 42
) -> BootstrapResult:
    if len(baseline) != len(candidate) or not baseline:
        raise ValueError("paired non-empty samples must have equal length")
    if samples < 100:
        raise ValueError("at least 100 bootstrap samples are required")
    differences = [right - left for left, right in zip(baseline, candidate, strict=True)]
    observed = sum(differences) / len(differences)
    rng = random.Random(seed)
    draws = sorted(
        sum(rng.choice(differences) for _ in differences) / len(differences) for _ in range(samples)
    )
    lower = draws[math.floor(samples * 0.025)]
    upper = draws[min(samples - 1, math.floor(samples * 0.975))]
    opposite = sum(1 for draw in draws if (draw <= 0 if observed > 0 else draw >= 0))
    p_value = min(1.0, 2 * (opposite + 1) / (samples + 1))
    return BootstrapResult(observed, lower, upper, p_value)


def estimate_cost(
    input_tokens: int, output_tokens: int, input_per_million: float, output_per_million: float
) -> float:
    if min(input_tokens, output_tokens, input_per_million, output_per_million) < 0:
        raise ValueError("usage and prices cannot be negative")
    return (input_tokens * input_per_million + output_tokens * output_per_million) / 1_000_000
