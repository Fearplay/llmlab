from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ExecutionMode(StrEnum):
    FIXTURE = "fixture"
    LOCAL = "local"
    CLOUD = "cloud"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    CANCEL_REQUESTED = "cancel_requested"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    FAILED = "failed"


class ProviderCapabilities(BaseModel):
    generation: bool
    embeddings: bool
    structured_output: bool
    streaming: bool
    tool_calling: bool
    token_usage: bool


class ProviderView(BaseModel):
    id: str
    name: str
    mode: Literal["local", "cloud"]
    configured: bool
    reachable: bool | None
    detail: str
    default_model: str | None = None
    capabilities: ProviderCapabilities


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cached_tokens: int = 0
    cost_usd: float | None = None


class GenerationRequest(BaseModel):
    mode: ExecutionMode = ExecutionMode.FIXTURE
    provider: str = "fixture"
    model: str = "fixture-gen-v1"
    messages: list[dict[str, str]]
    temperature: float = Field(0.2, ge=0, le=2)
    top_p: float = Field(0.9, ge=0, le=1)
    seed: int | None = None
    response_schema: dict[str, Any] | None = None


class GenerationResult(BaseModel):
    text: str
    provider: str
    model: str
    mode: ExecutionMode
    usage: Usage
    latency_ms: int
    fixture: bool


class EmbeddingRequest(BaseModel):
    mode: ExecutionMode = ExecutionMode.FIXTURE
    provider: str = "fixture"
    model: str = "fixture-hash-embed-v2"
    inputs: list[str] = Field(min_length=1, max_length=256)


class EmbeddingResult(BaseModel):
    vectors: list[list[float]]
    dimensions: int
    provider: str
    model: str
    mode: ExecutionMode
    usage: Usage
    fixture: bool


class EvaluationRequest(BaseModel):
    evaluator: Literal["exact_match", "contains", "regex", "json_schema", "semantic"]
    output: Any
    expected: Any = None
    config: dict[str, Any] = Field(default_factory=dict)


class EvaluationResult(BaseModel):
    evaluator: str
    score: float = Field(ge=0, le=1)
    passed: bool
    evidence: dict[str, Any]
    limitations: list[str]


class RunCreate(BaseModel):
    name: str = "Fixture experiment"
    mode: ExecutionMode = ExecutionMode.FIXTURE
    provider: str = "fixture"
    model: str = "fixture-gen-v1"
    dataset_version: str = "support-v4"
    prompt_version: str = "prompt-v18"
    evaluator_versions: list[str] = Field(default_factory=lambda: ["exact-v1", "faithfulness-v1"])
    config: dict[str, Any] = Field(default_factory=dict)


class RunView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: RunStatus
    mode: ExecutionMode
    provider: str
    model: str
    dataset_version: str
    prompt_version: str
    evaluator_versions: list[str]
    config_hash: str
    git_sha: str
    progress: int = 0
    usage: Usage = Field(default_factory=Usage)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None


class TraceEvent(BaseModel):
    sequence: int
    type: Literal["status", "progress", "metric", "tool_call", "tool_result", "error"]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    payload: dict[str, Any]


class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any]
    result: Any | None = None
    duration_ms: int | None = None


class RagRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    mode: ExecutionMode = ExecutionMode.FIXTURE
    top_k: int = Field(5, ge=1, le=20)
    provider: str = Field("fixture", min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    model: str = Field(
        "fixture-grounded-v2",
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:/-]*$",
    )
    response_language: Literal["auto", "en", "cs"] = "auto"


class RagSearchRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(5, ge=1, le=20)


class TrainingRequest(BaseModel):
    mode: ExecutionMode = ExecutionMode.FIXTURE
    epochs: int = Field(8, ge=2, le=50)
    learning_rate: float = Field(0.01, gt=0, le=1)
    seed: int = 42
