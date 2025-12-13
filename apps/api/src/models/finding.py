"""Finding models - Agent outputs and proposed edits"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class AgentId(str, Enum):
    """Identifiers for different analysis agents"""
    CONTEXT_BUILDER = "context_builder"
    CLARITY_INSPECTOR = "clarity_inspector"
    RIGOR_INSPECTOR = "rigor_inspector"
    ADVERSARIAL_CRITIC = "adversarial_critic"
    DOMAIN_VALIDATOR = "domain_validator"


class FindingCategory(str, Enum):
    """Categories of findings from different agents"""
    # Clarity categories
    CLARITY_SENTENCE = "clarity_sentence"
    CLARITY_PARAGRAPH = "clarity_paragraph"
    CLARITY_SECTION = "clarity_section"
    CLARITY_FLOW = "clarity_flow"

    # Rigor categories
    RIGOR_METHODOLOGY = "rigor_methodology"
    RIGOR_LOGIC = "rigor_logic"
    RIGOR_EVIDENCE = "rigor_evidence"
    RIGOR_STATISTICS = "rigor_statistics"

    # Scope categories
    SCOPE_OVERCLAIM = "scope_overclaim"
    SCOPE_UNDERCLAIM = "scope_underclaim"
    SCOPE_MISSING = "scope_missing"

    # Domain categories
    DOMAIN_CONVENTION = "domain_convention"
    DOMAIN_TERMINOLOGY = "domain_terminology"
    DOMAIN_FACTUAL = "domain_factual"

    # Adversarial categories
    ADVERSARIAL_WEAKNESS = "adversarial_weakness"
    ADVERSARIAL_GAP = "adversarial_gap"
    ADVERSARIAL_ALTERNATIVE = "adversarial_alternative"


class Severity(str, Enum):
    """Severity levels for findings"""
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    SUGGESTION = "suggestion"


class Anchor(BaseModel):
    """References specific text in the DocObj"""
    paragraph_id: str  # REQUIRED
    sentence_id: str | None = None  # More specific if available
    start_char: int | None = None  # Character offset in paragraph
    end_char: int | None = None
    quoted_text: str  # REQUIRED: the actual text being referenced


class EditType(str, Enum):
    """Types of proposed edits"""
    REPLACE = "replace"
    DELETE = "delete"
    INSERT_BEFORE = "insert_before"
    INSERT_AFTER = "insert_after"


class ProposedEdit(BaseModel):
    """Optional rewrite suggestion for a finding"""
    type: EditType
    anchor: Anchor  # What to modify
    new_text: str | None = None  # For replace/insert
    rationale: str  # Why this change


class Finding(BaseModel):
    """
    The output of any agent analysis.
    Every finding MUST reference specific text via anchors.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: AgentId
    category: FindingCategory
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)  # 0.0 - 1.0

    title: str = Field(max_length=100)  # Short summary
    description: str  # Full explanation

    anchors: list[Anchor] = Field(min_length=1)  # REQUIRED: at least one anchor

    proposed_edit: ProposedEdit | None = None

    metadata: dict[str, Any] | None = None  # Agent-specific data

    created_at: datetime = Field(default_factory=datetime.utcnow)