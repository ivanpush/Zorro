"""SSE Event models for real-time updates"""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

from .finding import AgentId, Finding


class EventType(str, Enum):
    """Types of SSE events"""
    PHASE_STARTED = "phase_started"
    PHASE_COMPLETED = "phase_completed"
    AGENT_STARTED = "agent_started"
    AGENT_COMPLETED = "agent_completed"
    FINDING_DISCOVERED = "finding_discovered"
    REVIEW_COMPLETED = "review_completed"
    ERROR = "error"


class BaseEvent(BaseModel):
    """Base class for all SSE events"""
    type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PhaseStartedEvent(BaseEvent):
    """Emitted when a review phase begins"""
    type: Literal[EventType.PHASE_STARTED] = EventType.PHASE_STARTED
    phase: str


class PhaseCompletedEvent(BaseEvent):
    """Emitted when a review phase completes"""
    type: Literal[EventType.PHASE_COMPLETED] = EventType.PHASE_COMPLETED
    phase: str


class AgentStartedEvent(BaseEvent):
    """Emitted when an agent begins analysis"""
    type: Literal[EventType.AGENT_STARTED] = EventType.AGENT_STARTED
    agent_id: AgentId


class AgentCompletedEvent(BaseEvent):
    """Emitted when an agent completes analysis"""
    type: Literal[EventType.AGENT_COMPLETED] = EventType.AGENT_COMPLETED
    agent_id: AgentId
    findings_count: int


class FindingDiscoveredEvent(BaseEvent):
    """Emitted when a new finding is discovered"""
    type: Literal[EventType.FINDING_DISCOVERED] = EventType.FINDING_DISCOVERED
    finding: Finding


class ReviewCompletedEvent(BaseEvent):
    """Emitted when entire review completes"""
    type: Literal[EventType.REVIEW_COMPLETED] = EventType.REVIEW_COMPLETED
    total_findings: int


class ErrorEvent(BaseEvent):
    """Emitted on errors"""
    type: Literal[EventType.ERROR] = EventType.ERROR
    message: str
    recoverable: bool