from .contracts import RunStatus

TRANSITIONS: dict[RunStatus, set[RunStatus]] = {
    RunStatus.QUEUED: {RunStatus.RUNNING, RunStatus.CANCEL_REQUESTED, RunStatus.FAILED},
    RunStatus.RUNNING: {RunStatus.CANCEL_REQUESTED, RunStatus.COMPLETED, RunStatus.FAILED},
    RunStatus.CANCEL_REQUESTED: {RunStatus.CANCELLED, RunStatus.FAILED},
    RunStatus.CANCELLED: set(),
    RunStatus.COMPLETED: set(),
    RunStatus.FAILED: set(),
}


def can_transition(current: RunStatus, target: RunStatus) -> bool:
    return target in TRANSITIONS[current]


def require_transition(current: RunStatus, target: RunStatus) -> None:
    if not can_transition(current, target):
        raise ValueError(f"invalid run transition: {current} -> {target}")
