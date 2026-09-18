import pytest

from llmlab_api.contracts import EvaluationRequest
from llmlab_api.evaluators import evaluate


@pytest.mark.parametrize(
    ("evaluation", "score"),
    [
        (EvaluationRequest(evaluator="exact_match", output=" Refund ", expected="refund"), 1),
        (
            EvaluationRequest(evaluator="contains", output="return in 30 days", expected="30 days"),
            1,
        ),
        (EvaluationRequest(evaluator="regex", output="Order A-2048", expected=r"A-\d+"), 1),
        (
            EvaluationRequest(
                evaluator="json_schema",
                output='{"answer":"ok"}',
                config={"schema": {"type": "object", "required": ["answer"]}},
            ),
            1,
        ),
    ],
)
def test_deterministic_evaluators(evaluation: EvaluationRequest, score: float) -> None:
    result = evaluate(evaluation)
    assert result.score == score
    assert result.passed


def test_semantic_fixture_discloses_limitation() -> None:
    result = evaluate(
        EvaluationRequest(
            evaluator="semantic",
            output="return footwear in thirty days",
            expected="footwear return in thirty days",
            config={"threshold": 0.7},
        )
    )
    assert result.passed
    assert result.limitations
