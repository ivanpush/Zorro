"""SSE event types."""

from datetime import datetime
from typing import Literal, Union
from pydantic import BaseModel, Field

from app.models.finding import Finding


class BaseEvent(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    def to_sse(self) -> str:
        return f"data: {self.model_dump_json()}\n\n"


class PhaseStartedEvent(BaseEvent):
    type: Literal["phase_started"] = "phase_started"
    phase: str  # "researching", "assessing", "evaluating", "synthesizing"
    description: str = ""


class PhaseCompletedEvent(BaseEvent):
    type: Literal["phase_completed"] = "phase_completed"
    phase: str


class AgentStartedEvent(BaseEvent):
    type: Literal["agent_started"] = "agent_started"
    agent_id: str
    title: str = ""  # "Starting Methodology & Evidence analysis"
    subtitle: str = ""  # "Examining 1 sections for methodological rigor"


class AgentCompletedEvent(BaseEvent):
    type: Literal["agent_completed"] = "agent_completed"
    agent_id: str
    findings_count: int = 0
    time_ms: float = 0.0
    cost_usd: float = 0.0


class ChunkCompletedEvent(BaseEvent):
    """Event emitted when a chunk within an agent completes processing."""
    type: Literal["chunk_completed"] = "chunk_completed"
    agent_id: str
    chunk_index: int
    total_chunks: int
    findings_count: int = 0
    failed: bool = False
    error: str | None = None


class FindingDiscoveredEvent(BaseEvent):
    type: Literal["finding_discovered"] = "finding_discovered"
    finding: Finding


class ReviewCompletedEvent(BaseEvent):
    type: Literal["review_completed"] = "review_completed"
    total_findings: int
    findings: list[Finding] = []  # Final deduplicated findings
    metrics: dict = {}  # dev banner data


class ErrorEvent(BaseEvent):
    type: Literal["error"] = "error"
    message: str
    recoverable: bool


SSEEvent = Union[
    PhaseStartedEvent,
    PhaseCompletedEvent,
    AgentStartedEvent,
    AgentCompletedEvent,
    ChunkCompletedEvent,
    FindingDiscoveredEvent,
    ReviewCompletedEvent,
    ErrorEvent,
]
