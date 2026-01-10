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
    phase: str


class PhaseCompletedEvent(BaseEvent):
    type: Literal["phase_completed"] = "phase_completed"
    phase: str


class AgentStartedEvent(BaseEvent):
    type: Literal["agent_started"] = "agent_started"
    agent_id: str


class AgentCompletedEvent(BaseEvent):
    type: Literal["agent_completed"] = "agent_completed"
    agent_id: str
    findings_count: int
    time_ms: float
    cost_usd: float


class FindingDiscoveredEvent(BaseEvent):
    type: Literal["finding_discovered"] = "finding_discovered"
    finding: Finding


class ReviewCompletedEvent(BaseEvent):
    type: Literal["review_completed"] = "review_completed"
    total_findings: int
    metrics: dict  # dev banner data


class ErrorEvent(BaseEvent):
    type: Literal["error"] = "error"
    message: str
    recoverable: bool


SSEEvent = Union[
    PhaseStartedEvent,
    PhaseCompletedEvent,
    AgentStartedEvent,
    AgentCompletedEvent,
    FindingDiscoveredEvent,
    ReviewCompletedEvent,
    ErrorEvent,
]
