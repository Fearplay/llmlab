import pytest

from llmlab_api.metrics import estimate_cost, paired_bootstrap


def test_cost_is_per_million_tokens() -> None:
    assert estimate_cost(1_000_000, 500_000, 1.0, 2.0) == 2.0


def test_paired_bootstrap_is_seeded() -> None:
    baseline = [0, 0, 1, 1, 0, 1]
    candidate = [1, 1, 1, 1, 1, 1]
    first = paired_bootstrap(baseline, candidate, samples=500, seed=42)
    second = paired_bootstrap(baseline, candidate, samples=500, seed=42)
    assert first == second
    assert first.delta > 0


def test_bootstrap_rejects_unpaired_data() -> None:
    with pytest.raises(ValueError):
        paired_bootstrap([1], [1, 2])
