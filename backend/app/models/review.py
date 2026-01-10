"""Review configuration and job models."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field
import uuid

from app.models.finding import Finding
from app.models.metrics import ReviewMetrics


class ReviewConfig(BaseModel):
    """Review configuration from frontend."""
    panel_mode: bool = False  # 3-model adversary with voting
    focus_chips: list[str] = Field(default_factory=list)
    steering_memo: str | None = None
    enable_domain: bool = True


class ReviewJob(BaseModel):
    """Full review job state."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str
    config: ReviewConfig
    status: Literal["pending", "running", "completed", "failed"] = "pending"

    current_phase: str | None = None
    findings: list[Finding] = Field(default_factory=list)
    metrics: ReviewMetrics = Field(default_factory=ReviewMetrics)

    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    error: str | None = None
