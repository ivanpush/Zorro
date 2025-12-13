"""Review models - Configuration and runtime state"""

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from .finding import AgentId, Finding


class ReviewTier(str, Enum):
    """Review depth levels"""
    STANDARD = "standard"
    DEEP = "deep"


class FocusDimension(str, Enum):
    """Focus areas for review"""
    ARGUMENTATION = "argumentation"
    METHODOLOGY = "methodology"
    CLARITY = "clarity"
    COMPLETENESS = "completeness"


class ReviewConfig(BaseModel):
    """Configuration for a review job, frozen at start"""
    tier: ReviewTier = ReviewTier.STANDARD
    focus_dimensions: list[FocusDimension]
    domain_hint: str | None = None
    steering_memo: str | None = None  # From config chat

    # Feature flags
    enable_adversarial: bool = True
    enable_domain_validation: bool = True


class ReviewStatus(str, Enum):
    """Status of a review job"""
    PENDING = "pending"
    PARSING = "parsing"
    ANALYZING = "analyzing"
    SYNTHESIZING = "synthesizing"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentStatus(BaseModel):
    """Status of an individual agent"""
    status: Literal["pending", "running", "completed", "failed"]
    findings_count: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None


class ReviewJob(BaseModel):
    """Runtime state of a review"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: str
    config: ReviewConfig
    status: ReviewStatus = ReviewStatus.PENDING

    current_phase: str | None = None
    agent_statuses: dict[AgentId, AgentStatus] = Field(default_factory=dict)

    findings: list[Finding] = Field(default_factory=list)

    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    error: str | None = None


class DecisionAction(str, Enum):
    """User actions on findings"""
    ACCEPT = "accept"  # Accept finding, no edit
    ACCEPT_EDIT = "accept_edit"  # Accept proposed edit (possibly modified)
    DISMISS = "dismiss"  # Reject finding


class Decision(BaseModel):
    """User decision on a finding"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    finding_id: str
    action: DecisionAction
    final_text: str | None = None  # For 'accept_edit' with modifications
    timestamp: datetime = Field(default_factory=datetime.utcnow)