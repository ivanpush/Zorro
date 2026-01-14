"""Review configuration, job, and output models."""

from datetime import datetime
from typing import Literal, Any
from pydantic import BaseModel, Field, model_serializer
from collections import Counter
import uuid

from app.models.finding import Finding, Track
from app.models.metrics import ReviewMetrics, AgentMetrics


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


# =============================================================================
# ReviewOutput: Complete API response structure for frontend
# =============================================================================

class ReviewSummary(BaseModel):
    """Summary statistics for review results."""
    total_findings: int
    by_track: dict[str, int] = Field(default_factory=dict)  # {"A": 5, "B": 3, "C": 2}
    by_severity: dict[str, int] = Field(default_factory=dict)  # {"critical": 1, "major": 4, ...}

    @classmethod
    def from_findings(cls, findings: list[Finding]) -> "ReviewSummary":
        """Build summary from list of findings."""
        by_track = Counter(f.track for f in findings)
        by_severity = Counter(f.severity for f in findings)

        return cls(
            total_findings=len(findings),
            by_track=dict(by_track),
            by_severity=dict(by_severity),
        )

    @model_serializer
    def serialize(self) -> dict[str, Any]:
        return {
            "totalFindings": self.total_findings,
            "byTrack": self.by_track,
            "bySeverity": self.by_severity,
        }


class ReviewMetadataOutput(BaseModel):
    """Execution metadata for API response."""
    total_time_ms: float = 0.0
    total_cost_usd: float = 0.0
    agents_run: list[str] = Field(default_factory=list)
    model_usage: dict[str, int] = Field(default_factory=dict)  # model -> token count

    @classmethod
    def from_metrics(cls, metrics: list[AgentMetrics]) -> "ReviewMetadataOutput":
        """Build metadata from list of agent metrics."""
        if not metrics:
            return cls()

        total_time = sum(m.time_ms for m in metrics)
        total_cost = sum(m.cost_usd for m in metrics)
        agents = list(set(m.agent_id for m in metrics))

        # Aggregate token usage by model
        model_tokens: dict[str, int] = {}
        for m in metrics:
            model_tokens[m.model] = model_tokens.get(m.model, 0) + m.input_tokens + m.output_tokens

        return cls(
            total_time_ms=total_time,
            total_cost_usd=total_cost,
            agents_run=agents,
            model_usage=model_tokens,
        )

    @model_serializer
    def serialize(self) -> dict[str, Any]:
        return {
            "totalTimeMs": self.total_time_ms,
            "totalCostUsd": self.total_cost_usd,
            "agentsRun": self.agents_run,
            "modelUsage": self.model_usage,
        }


class ReviewOutput(BaseModel):
    """Complete review output for API response."""
    findings: list[Finding]
    summary: ReviewSummary
    metadata: ReviewMetadataOutput
    narrative: str | None = None

    @model_serializer
    def serialize(self) -> dict[str, Any]:
        return {
            "findings": [f.model_dump() for f in self.findings],
            "summary": self.summary.model_dump(),
            "metadata": self.metadata.model_dump(),
            "narrative": self.narrative,
        }
