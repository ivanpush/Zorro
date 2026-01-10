"""
Metrics collection for dev banner.
Every agent call produces AgentMetrics.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class AgentMetrics(BaseModel):
    """Metrics from a single agent call."""
    agent_id: str
    model: str
    input_tokens: int
    output_tokens: int
    time_ms: float
    cost_usd: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    chunk_index: int | None = None
    chunk_total: int | None = None


class ReviewMetrics(BaseModel):
    """Aggregated metrics for dev banner."""
    agent_metrics: list[AgentMetrics] = Field(default_factory=list)
    total_time_ms: float = 0
    total_cost_usd: float = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0

    def add(self, metrics: AgentMetrics) -> None:
        self.agent_metrics.append(metrics)
        self.total_time_ms += metrics.time_ms
        self.total_cost_usd += metrics.cost_usd
        self.total_input_tokens += metrics.input_tokens
        self.total_output_tokens += metrics.output_tokens

    def by_agent(self) -> dict[str, dict]:
        result = {}
        for m in self.agent_metrics:
            if m.agent_id not in result:
                result[m.agent_id] = {
                    "model": m.model,
                    "calls": 0,
                    "time_ms": 0,
                    "cost_usd": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                }
            result[m.agent_id]["calls"] += 1
            result[m.agent_id]["time_ms"] += m.time_ms
            result[m.agent_id]["cost_usd"] += m.cost_usd
            result[m.agent_id]["input_tokens"] += m.input_tokens
            result[m.agent_id]["output_tokens"] += m.output_tokens
        return result

    def to_dev_banner(self) -> dict:
        """Format for frontend."""
        return {
            "total": {
                "time_s": round(self.total_time_ms / 1000, 2),
                "cost_usd": round(self.total_cost_usd, 4),
                "tokens": self.total_input_tokens + self.total_output_tokens,
            },
            "agents": self.by_agent(),
        }
