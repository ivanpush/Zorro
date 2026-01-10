# ZORRO Backend - Pydantic Models

All models. Copy exactly.

---

## app/models/document.py

```python
"""
Document structure models - immutable after parsing/loading.
All agents reference this structure via paragraph_id, sentence_id.
"""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field
import uuid


class Sentence(BaseModel):
    """Individual sentence within a paragraph."""
    sentence_id: str = Field(description="Format: p_XXX_s_YYY")
    paragraph_id: str
    sentence_index: int = Field(ge=0)
    text: str
    start_char: int = Field(ge=0)
    end_char: int = Field(ge=0)


class Paragraph(BaseModel):
    """Paragraph with sentence breakdown."""
    paragraph_id: str = Field(description="Format: p_XXX")
    section_id: str | None = None
    paragraph_index: int = Field(ge=0)
    text: str
    sentences: list[Sentence] = Field(default_factory=list)
    page_number: int | None = None


class Section(BaseModel):
    """Document section."""
    section_id: str = Field(description="Format: sec_XXX")
    section_index: int = Field(ge=0)
    section_title: str | None = None
    level: int = Field(ge=1, le=6, default=1)
    paragraph_ids: list[str] = Field(default_factory=list)


class DocumentMetadata(BaseModel):
    """Document-level metadata."""
    page_count: int | None = None
    word_count: int = 0
    character_count: int = 0
    author: str | None = None


class DocObj(BaseModel):
    """
    Immutable document representation.
    All agents reference this structure.
    """
    document_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    type: Literal["pdf", "docx"]
    title: str
    
    sections: list[Section] = Field(default_factory=list)
    paragraphs: list[Paragraph] = Field(default_factory=list)
    
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    def get_paragraph(self, paragraph_id: str) -> Paragraph | None:
        return next((p for p in self.paragraphs if p.paragraph_id == paragraph_id), None)
    
    def get_paragraph_text(self, paragraph_id: str) -> str | None:
        p = self.get_paragraph(paragraph_id)
        return p.text if p else None
    
    def get_full_text(self) -> str:
        return "\n\n".join(p.text for p in self.paragraphs)
    
    def get_text_with_ids(self) -> str:
        return "\n\n".join(f"[{p.paragraph_id}] {p.text}" for p in self.paragraphs)
    
    def get_section_paragraphs(self, section_id: str) -> list[Paragraph]:
        return [p for p in self.paragraphs if p.section_id == section_id]
    
    def validate_anchor_text(self, paragraph_id: str, quoted_text: str) -> bool:
        text = self.get_paragraph_text(paragraph_id)
        return text is not None and quoted_text in text
```

---

## app/models/finding.py

```python
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
```

---

## app/models/briefing.py

```python
"""Briefing agent output model."""

from pydantic import BaseModel, Field


class BriefingOutput(BaseModel):
    """Context extracted by Briefing agent."""
    
    summary: str = Field(max_length=500)
    main_claims: list[str] = Field(min_length=1, max_length=10)
    stated_scope: str | None = None
    stated_limitations: list[str] = Field(default_factory=list)
    methodology_summary: str | None = None
    domain_keywords: list[str] = Field(default_factory=list, max_length=20)
    
    def format_for_prompt(self) -> str:
        parts = [
            f"Summary: {self.summary}",
            f"Main claims: {'; '.join(self.main_claims)}",
        ]
        if self.stated_scope:
            parts.append(f"Stated scope: {self.stated_scope}")
        if self.stated_limitations:
            parts.append(f"Limitations: {'; '.join(self.stated_limitations)}")
        if self.methodology_summary:
            parts.append(f"Methodology: {self.methodology_summary}")
        return "\n".join(parts)
```

---

## app/models/domain.py

```python
"""
Domain Pipeline Models v1

Domain provides AMMUNITION for Adversary - external evidence to strengthen critiques.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Literal


# ============================================================
# STAGE 1: TARGET EXTRACTION
# ============================================================

class SearchPriority(BaseModel):
    """What to search for in literature."""
    search_for: str = Field(description="Specific search target")
    why_it_matters: str = Field(description="How this affects evaluation")
    search_type: Literal[
        "design_limitation",  # What study design CANNOT establish - HIGHEST PRIORITY
        "contradiction",      # Others got different results
        "method_limitation",  # Known problems with technique
        "missing_context",    # Important uncited work
        "failed_attempts",    # Others tried and failed
        "replication",        # Independent validation status
        "consensus"           # What field actually believes
    ]


class DomainTargets(BaseModel):
    """Output from Stage 1: Target Extractor."""
    
    document_type: str
    
    # Study design analysis (CRITICAL)
    study_design: str = Field(description="Primary methodology used")
    design_can_establish: list[str] = Field(min_length=1, max_length=3)
    design_cannot_establish: list[str] = Field(
        min_length=1, max_length=3,
        description="CRITICAL: What this design CANNOT prove"
    )
    
    summary: str = Field(description="2-3 sentence summary")
    search_priorities: list[SearchPriority] = Field(min_length=1, max_length=6)
    field: str
    subfield: str
    
    @field_validator('search_priorities')
    @classmethod
    def design_limitation_first(cls, v):
        if v and v[0].search_type != "design_limitation":
            # Log warning but don't fail
            pass
        return v


# ============================================================
# STAGE 2: QUERY GENERATION
# ============================================================

class SearchQuery(BaseModel):
    """Generated search query."""
    query_id: str
    query_text: str = Field(max_length=100)
    query_type: Literal["fact_check", "convention", "terminology", "benchmark", "contradiction"]
    rationale: str


class QueryGeneratorOutput(BaseModel):
    """Output from Stage 2: Query Generator."""
    queries: list[SearchQuery] = Field(min_length=1, max_length=8)


# ============================================================
# STAGE 3: SEARCH RESULTS
# ============================================================

class SourceSnippet(BaseModel):
    """External source with provenance."""
    text: str = Field(max_length=500)
    url: str | None = None
    title: str | None = None
    date: str | None = None
    query_id: str


class SearchResult(BaseModel):
    """Result from a single Perplexity search."""
    query_id: str
    response_text: str
    citations: list[str] = Field(default_factory=list)


class SearchExecutorOutput(BaseModel):
    """Output from Stage 3: Search Executor."""
    results: list[SearchResult] = Field(default_factory=list)
    sources: list[SourceSnippet] = Field(default_factory=list)


# ============================================================
# STAGE 4: EVIDENCE SYNTHESIS (FINAL OUTPUT)
# ============================================================

class EvidencePack(BaseModel):
    """
    External evidence package for Adversary.
    
    This is SUPPLEMENTARY AMMUNITION, not primary guidance.
    Adversary reads the paper itself and forms critique.
    Evidence STRENGTHENS attacks with citations.
    """
    
    # Transparency: what we searched
    queries_used: list[str] = Field(default_factory=list)
    query_rationale: list[str] = Field(default_factory=list)
    
    # Category buckets (always populated)
    design_limitations: list[str] = Field(
        default_factory=list,
        description="Fundamental constraints: 'This design cannot establish causation...'"
    )
    prior_work: list[str] = Field(
        default_factory=list,
        description="Previous research: 'Smith 2022 showed...'"
    )
    contradictions: list[str] = Field(
        default_factory=list,
        description="Conflicting evidence: 'However, Jones 2023 found...'"
    )
    field_consensus: list[str] = Field(
        default_factory=list,
        description="What field believes: 'Consensus is that...'"
    )
    method_context: list[str] = Field(
        default_factory=list,
        description="Known method issues: 'This assay has reliability issues...'"
    )
    failed_attempts: list[str] = Field(
        default_factory=list,
        description="Negative results: 'Phase II trial failed...'"
    )
    
    # Sources for citation
    sources: list[SourceSnippet] = Field(default_factory=list)
    
    # Meta
    confidence: Literal["high", "medium", "low"] = Field(default="low")
    gaps: str | None = Field(
        None,
        description="What we couldn't find - ALSO AMMO: 'No evidence supports claim X'"
    )
    
    @classmethod
    def empty(cls) -> "EvidencePack":
        return cls(confidence="low")
    
    def has_content(self) -> bool:
        return bool(
            self.design_limitations or
            self.prior_work or
            self.contradictions or
            self.field_consensus or
            self.method_context or
            self.failed_attempts or
            self.gaps
        )
    
    def format_for_prompt(self) -> str:
        """Format for Adversary prompt."""
        parts = []
        
        if self.design_limitations:
            parts.append("DESIGN LIMITATIONS (what this study CANNOT establish):")
            for item in self.design_limitations:
                parts.append(f"  • {item}")
        
        if self.contradictions:
            parts.append("\nCONTRADICTIONS:")
            for item in self.contradictions:
                parts.append(f"  • {item}")
        
        if self.prior_work:
            parts.append("\nPRIOR WORK:")
            for item in self.prior_work:
                parts.append(f"  • {item}")
        
        if self.field_consensus:
            parts.append("\nFIELD CONSENSUS:")
            for item in self.field_consensus:
                parts.append(f"  • {item}")
        
        if self.method_context:
            parts.append("\nMETHOD CONTEXT:")
            for item in self.method_context:
                parts.append(f"  • {item}")
        
        if self.failed_attempts:
            parts.append("\nFAILED ATTEMPTS:")
            for item in self.failed_attempts:
                parts.append(f"  • {item}")
        
        if self.gaps:
            parts.append(f"\nEVIDENCE GAPS: {self.gaps}")
        
        return "\n".join(parts) if parts else "No external evidence found."


class DomainOutput(BaseModel):
    """Complete Domain pipeline output."""
    evidence: EvidencePack
    targets: DomainTargets | None = None
    queries_executed: int = 0
    search_time_ms: float = 0
```

---

## app/models/chunks.py

```python
"""Chunking models for parallelized agents."""

from pydantic import BaseModel, Field
from app.models.document import Paragraph, Section


class ContextOverlap(BaseModel):
    """3-sentence context from adjacent chunks."""
    sentences: list[str] = Field(default_factory=list, max_length=3)
    source: str = Field(description="'previous' or 'next'")
    
    def format_for_prompt(self) -> str:
        if not self.sentences:
            return ""
        text = " ".join(self.sentences)
        return f"[CONTEXT ONLY - DO NOT CRITIQUE: {text}]"


class ClarityChunk(BaseModel):
    """Word-based chunk for Clarity agent."""
    chunk_index: int
    chunk_total: int
    paragraphs: list[Paragraph]
    paragraph_ids: list[str]
    word_count: int
    context_before: ContextOverlap | None = None
    context_after: ContextOverlap | None = None
    
    def get_text_with_ids(self) -> str:
        parts = []
        if self.context_before:
            parts.append(self.context_before.format_for_prompt())
        
        for p in self.paragraphs:
            parts.append(f"[{p.paragraph_id}] {p.text}")
        
        if self.context_after:
            parts.append(self.context_after.format_for_prompt())
        
        return "\n\n".join(parts)


class RigorChunk(BaseModel):
    """Section-based chunk for Rigor agent."""
    chunk_index: int
    chunk_total: int
    section: Section
    paragraphs: list[Paragraph]
    paragraph_ids: list[str]
    context_before: ContextOverlap | None = None
    context_after: ContextOverlap | None = None
    
    def get_text_with_ids(self) -> str:
        parts = []
        if self.context_before:
            parts.append(self.context_before.format_for_prompt())
        
        if self.section.section_title:
            parts.append(f"## {self.section.section_title}")
        
        for p in self.paragraphs:
            parts.append(f"[{p.paragraph_id}] {p.text}")
        
        if self.context_after:
            parts.append(self.context_after.format_for_prompt())
        
        return "\n\n".join(parts)
```

---

## app/models/metrics.py

```python
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
```

---

## app/models/review.py

```python
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
```

---

## app/models/events.py

```python
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
```

---

## app/models/__init__.py

```python
"""ZORRO Models."""

from .document import DocObj, Paragraph, Section, Sentence, DocumentMetadata
from .finding import (
    Finding, Anchor, ProposedEdit, AgentId, FindingCategory, Severity,
    AGENT_PRIORITY, PRESENTATION_ORDER
)
from .briefing import BriefingOutput
from .domain import (
    DomainTargets, SearchPriority, SearchQuery, QueryGeneratorOutput,
    SearchResult, SearchExecutorOutput, SourceSnippet, EvidencePack, DomainOutput
)
from .chunks import ClarityChunk, RigorChunk, ContextOverlap
from .metrics import AgentMetrics, ReviewMetrics
from .review import ReviewConfig, ReviewJob
from .events import (
    BaseEvent, PhaseStartedEvent, PhaseCompletedEvent, AgentStartedEvent,
    AgentCompletedEvent, FindingDiscoveredEvent, ReviewCompletedEvent,
    ErrorEvent, SSEEvent
)

__all__ = [
    # Document
    "DocObj", "Paragraph", "Section", "Sentence", "DocumentMetadata",
    # Finding
    "Finding", "Anchor", "ProposedEdit", "AgentId", "FindingCategory", "Severity",
    "AGENT_PRIORITY", "PRESENTATION_ORDER",
    # Briefing
    "BriefingOutput",
    # Domain
    "DomainTargets", "SearchPriority", "SearchQuery", "QueryGeneratorOutput",
    "SearchResult", "SearchExecutorOutput", "SourceSnippet", "EvidencePack", "DomainOutput",
    # Chunks
    "ClarityChunk", "RigorChunk", "ContextOverlap",
    # Metrics
    "AgentMetrics", "ReviewMetrics",
    # Review
    "ReviewConfig", "ReviewJob",
    # Events
    "BaseEvent", "PhaseStartedEvent", "PhaseCompletedEvent", "AgentStartedEvent",
    "AgentCompletedEvent", "FindingDiscoveredEvent", "ReviewCompletedEvent",
    "ErrorEvent", "SSEEvent",
]
```
