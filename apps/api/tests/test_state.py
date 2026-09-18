import pytest

from llmlab_api.contracts import RunStatus
from llmlab_api.state import can_transition, require_transition


def test_valid_run_lifecycle() -> None:
    assert can_transition(RunStatus.QUEUED, RunStatus.RUNNING)
    assert can_transition(RunStatus.RUNNING, RunStatus.COMPLETED)
    assert not can_transition(RunStatus.COMPLETED, RunStatus.RUNNING)


def test_invalid_transition_fails() -> None:
    with pytest.raises(ValueError):
        require_transition(RunStatus.COMPLETED, RunStatus.RUNNING)
