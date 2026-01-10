"""
Finding and anchor models - agent outputs.
Uses camelCase aliases for frontend compatibility.
"""

from datetime import datetime
from typing import Literal, Any
from pydantic import BaseModel, Field, field_validator, model_serializer
import uuid


AgentId = Literal[
    "briefing",
    "clarity",
    "rigor_find",
    "rigor_rewrite",
    "adversary",
    "adversary_panel",
    "domain",
]

FindingCategory = Literal[
    # Clarity
    "clarity_sentence",
    "clarity_paragraph",
    "clarity_flow",
    # Rigor
    "rigor_methodology",
    "rigor_logic",
    "rigor_evidence",
    "rigor_statistics",
    # Adversarial
    "adversarial_weakness",
    "adversarial_gap",
    "adversarial_alternative",
]

Severity = Literal["critical", "major", "minor", "suggestion"]


class Anchor(BaseModel):
    """Precise location reference in document."""
    paragraph_id: str
    sentence_id: str | None = None
    quoted_text: str = Field(min_length=1)

    @field_validator("quoted_text")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("quoted_text cannot be empty")
        return v


class ProposedEdit(BaseModel):
    """Suggested modification."""
    type: Literal["replace", "delete", "insert_before", "insert_after", "suggestion"]
    anchor: Anchor
    new_text: str | None = None
    rationale: str


class Finding(BaseModel):
    """
    Individual issue discovered by an agent.
    Serializes to camelCase for frontend.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: AgentId
    category: FindingCategory
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)

    title: str = Field(max_length=100)
    description: str

    anchors: list[Anchor] = Field(min_length=1)
    proposed_edit: ProposedEdit | None = None

    # Panel mode: how many models flagged this (1, 2, or 3)
    votes: int | None = Field(None, ge=1, le=3)

    metadata: dict[str, Any] | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @model_serializer
    def serialize(self) -> dict[str, Any]:
        """camelCase output for frontend."""
        data = {
            "id": self.id,
            "agentId": self.agent_id,
            "category": self.category,
            "severity": self.severity,
            "confidence": self.confidence,
            "title": self.title,
            "description": self.description,
            "anchors": [
                {
                    "paragraph_id": a.paragraph_id,
                    "sentence_id": a.sentence_id,
                    "quoted_text": a.quoted_text,
                }
                for a in self.anchors
            ],
            "createdAt": self.created_at.isoformat(),
        }

        if self.proposed_edit:
            data["proposedEdit"] = {
                "type": self.proposed_edit.type,
                "anchor": {
                    "paragraph_id": self.proposed_edit.anchor.paragraph_id,
                    "quoted_text": self.proposed_edit.anchor.quoted_text,
                },
                "newText": self.proposed_edit.new_text,
                "rationale": self.proposed_edit.rationale,
            }

        if self.votes is not None:
            data["votes"] = self.votes

        if self.metadata:
            data["metadata"] = self.metadata

        return data


# Priority for deduplication (lower = higher priority)
AGENT_PRIORITY = {
    "adversary": 1,
    "adversary_panel": 1,
    "rigor_rewrite": 2,
    "rigor_find": 2,
    "domain": 2,
    "clarity": 3,
    "briefing": 4,
}

# Order for presentation (lower = earlier in output)
PRESENTATION_ORDER = {
    "clarity": 1,
    "rigor_find": 2,
    "rigor_rewrite": 2,
    "domain": 3,
    "adversary": 4,
    "adversary_panel": 4,
}
