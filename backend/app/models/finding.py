"""
Finding and anchor models - agent outputs.
Uses camelCase aliases for frontend compatibility.
"""

from datetime import datetime
from typing import Literal, Any
from pydantic import BaseModel, Field, field_validator, model_serializer, model_validator
import uuid


AgentId = Literal[
    "briefing",
    "clarity",
    "rigor_find",
    "rigor_rewrite",
    "adversary",
    "adversary_panel",
    "adversary_panel_claude",
    "adversary_panel_openai",
    "adversary_panel_google",
    "adversary_reconcile",
    "domain",
]

FindingCategory = Literal[
    # Clarity
    "clarity_sentence",
    "clarity_paragraph",
    "clarity_section",
    "clarity_flow",
    # Rigor
    "rigor_methodology",
    "rigor_logic",
    "rigor_evidence",
    "rigor_statistics",
    # Scope
    "scope_overclaim",
    "scope_underclaim",
    "scope_missing",
    # Domain
    "domain_convention",
    "domain_terminology",
    "domain_factual",
    # Adversarial
    "adversarial_weakness",
    "adversarial_gap",
    "adversarial_alternative",
]

Severity = Literal["critical", "major", "minor", "suggestion"]

# =============================================================================
# Track: Frontend tab routing (A=Writing, B=Methodology, C=Argumentation)
# =============================================================================
Track = Literal["A", "B", "C"]

AGENT_TO_TRACK: dict[str, Track] = {
    "clarity": "A",
    "rigor_find": "B",
    "rigor_rewrite": "B",
    "adversary": "C",
    "adversary_panel": "C",
    "adversary_panel_claude": "C",
    "adversary_panel_openai": "C",
    "adversary_panel_google": "C",
    "adversary_reconcile": "C",
    "domain": "C",
}

# =============================================================================
# Dimension: Summary charts (WQ=Writing Quality, CR=Claim Rigor, AS=Argument Strength)
# =============================================================================
Dimension = Literal["WQ", "CR", "AS"]

CATEGORY_TO_DIMENSIONS: dict[str, list[Dimension]] = {
    # Clarity -> Writing Quality
    "clarity_sentence": ["WQ"],
    "clarity_paragraph": ["WQ"],
    "clarity_section": ["WQ"],
    "clarity_flow": ["WQ"],
    # Rigor -> Claim Rigor
    "rigor_methodology": ["CR"],
    "rigor_logic": ["CR"],
    "rigor_evidence": ["CR"],
    "rigor_statistics": ["CR"],
    # Scope -> Argument Strength
    "scope_overclaim": ["AS"],
    "scope_underclaim": ["AS"],
    "scope_missing": ["AS"],
    # Domain -> both AS and CR
    "domain_convention": ["AS", "CR"],
    "domain_terminology": ["AS", "CR"],
    "domain_factual": ["AS", "CR"],
    # Adversarial -> Argument Strength
    "adversarial_weakness": ["AS"],
    "adversarial_gap": ["AS"],
    "adversarial_alternative": ["AS"],
}


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
    rationale: str  # WHY this suggestion/fix is a good one
    suggestion: str | None = None  # WHAT to do - actionable guidance


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

    # Track for frontend tab routing (auto-derived from agent_id)
    track: Track = Field(default="A")

    # Dimensions for summary charts (auto-derived from category)
    dimensions: list[Dimension] = Field(default_factory=list)

    # Panel mode: how many models flagged this (1, 2, or 3)
    votes: int | None = Field(None, ge=1, le=3)

    metadata: dict[str, Any] | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @model_validator(mode="after")
    def auto_derive_fields(self) -> "Finding":
        """Auto-derive track from agent_id and dimensions from category."""
        # Derive track from agent_id
        self.track = AGENT_TO_TRACK.get(self.agent_id, "A")

        # Derive dimensions from category (if not already set)
        if not self.dimensions:
            self.dimensions = CATEGORY_TO_DIMENSIONS.get(self.category, [])

        return self

    @property
    def sentence_ids(self) -> list[str]:
        """Extract sentence_ids from anchors for frontend highlighting."""
        return [a.sentence_id for a in self.anchors if a.sentence_id]

    def merge_dimensions(self, other: "Finding") -> None:
        """Merge dimensions from another finding (used in dedup)."""
        for dim in other.dimensions:
            if dim not in self.dimensions:
                self.dimensions.append(dim)

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
                    "paragraphId": a.paragraph_id,
                    "sentenceId": a.sentence_id,
                    "quotedText": a.quoted_text,
                }
                for a in self.anchors
            ],
            "track": self.track,
            "dimensions": self.dimensions,
            "sentenceIds": self.sentence_ids,
            "createdAt": self.created_at.isoformat(),
        }

        if self.proposed_edit:
            data["proposedEdit"] = {
                "type": self.proposed_edit.type,
                "anchor": {
                    "paragraphId": self.proposed_edit.anchor.paragraph_id,
                    "quotedText": self.proposed_edit.anchor.quoted_text,
                },
                "newText": self.proposed_edit.new_text,
                "rationale": self.proposed_edit.rationale,
                "suggestion": self.proposed_edit.suggestion,
            }

        if self.votes is not None:
            data["votes"] = self.votes

        if self.metadata:
            data["metadata"] = self.metadata

        return data


# Priority for deduplication (lower = higher priority = wins on overlap)
AGENT_PRIORITY = {
    "adversary": 1,
    "adversary_panel": 1,
    "adversary_panel_claude": 1,
    "adversary_panel_openai": 1,
    "adversary_panel_google": 1,
    "adversary_reconcile": 1,
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
    "adversary_panel_claude": 4,
    "adversary_panel_openai": 4,
    "adversary_panel_google": 4,
    "adversary_reconcile": 4,
}
