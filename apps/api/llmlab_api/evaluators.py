import json
import math
import re
from collections import Counter
from typing import Any

from jsonschema import ValidationError, validate  # type: ignore[import-untyped]

from .contracts import EvaluationRequest, EvaluationResult


def evaluate(request: EvaluationRequest) -> EvaluationResult:
    handlers = {
        "exact_match": _exact_match,
        "contains": _contains,
        "regex": _regex,
        "json_schema": _json_schema,
        "semantic": _semantic,
    }
    return handlers[request.evaluator](request)


def _exact_match(request: EvaluationRequest) -> EvaluationResult:
    normalize = bool(request.config.get("normalize", True))
    actual = _normalize(request.output) if normalize else request.output
    expected = _normalize(request.expected) if normalize else request.expected
    passed = actual == expected
    return _result(request, float(passed), passed, {"actual": actual, "expected": expected})


def _contains(request: EvaluationRequest) -> EvaluationResult:
    haystack = _normalize(request.output)
    needle = _normalize(request.expected)
    passed = needle in haystack
    return _result(request, float(passed), passed, {"needle": needle, "matched": passed})


def _regex(request: EvaluationRequest) -> EvaluationResult:
    pattern = str(request.expected)
    flags = re.IGNORECASE if request.config.get("ignore_case", False) else 0
    match = re.search(pattern, str(request.output), flags=flags)
    passed = match is not None
    return _result(
        request,
        float(passed),
        passed,
        {"pattern": pattern, "match": match.group(0) if match else None},
    )


def _json_schema(request: EvaluationRequest) -> EvaluationResult:
    schema = request.config.get("schema", request.expected)
    try:
        value = json.loads(request.output) if isinstance(request.output, str) else request.output
        validate(instance=value, schema=schema)
        return _result(request, 1, True, {"valid": True})
    except (json.JSONDecodeError, ValidationError) as error:
        return _result(request, 0, False, {"valid": False, "error": str(error)})


def _semantic(request: EvaluationRequest) -> EvaluationResult:
    score = cosine_bow(str(request.output), str(request.expected))
    threshold = float(request.config.get("threshold", 0.75))
    return _result(
        request,
        score,
        score >= threshold,
        {"method": "token-frequency cosine fixture", "threshold": threshold},
        [
            "Fixture similarity is lexical; use a configured embedding provider "
            "for semantic meaning."
        ],
    )


def cosine_bow(left: str, right: str) -> float:
    a = Counter(_tokens(left))
    b = Counter(_tokens(right))
    if not a or not b:
        return 0.0
    dot = sum(a[token] * b[token] for token in a.keys() & b.keys())
    norm_a = math.sqrt(sum(value * value for value in a.values()))
    norm_b = math.sqrt(sum(value * value for value in b.values()))
    return max(0.0, min(1.0, dot / (norm_a * norm_b)))


def _tokens(value: str) -> list[str]:
    return re.findall(r"[\w'-]+", value.casefold())


def _normalize(value: Any) -> Any:
    if isinstance(value, str):
        return " ".join(value.casefold().split())
    return value


def _result(
    request: EvaluationRequest,
    score: float,
    passed: bool,
    evidence: dict[str, Any],
    limitations: list[str] | None = None,
) -> EvaluationResult:
    return EvaluationResult(
        evaluator=request.evaluator,
        score=score,
        passed=passed,
        evidence=evidence,
        limitations=limitations or [],
    )
