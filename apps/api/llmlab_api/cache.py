import hashlib
import json
from typing import Any


def cache_key(namespace: str, payload: dict[str, Any], version: int = 1) -> str:
    """Build a stable key without leaking prompt text into Redis keys or logs."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    return f"llmlab:v{version}:{namespace}:{digest}"
