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
                parts.append(f"  - {item}")

        if self.contradictions:
            parts.append("\nCONTRADICTIONS:")
            for item in self.contradictions:
                parts.append(f"  - {item}")

        if self.prior_work:
            parts.append("\nPRIOR WORK:")
            for item in self.prior_work:
                parts.append(f"  - {item}")

        if self.field_consensus:
            parts.append("\nFIELD CONSENSUS:")
            for item in self.field_consensus:
                parts.append(f"  - {item}")

        if self.method_context:
            parts.append("\nMETHOD CONTEXT:")
            for item in self.method_context:
                parts.append(f"  - {item}")

        if self.failed_attempts:
            parts.append("\nFAILED ATTEMPTS:")
            for item in self.failed_attempts:
                parts.append(f"  - {item}")

        if self.gaps:
            parts.append(f"\nEVIDENCE GAPS: {self.gaps}")

        return "\n".join(parts) if parts else "No external evidence found."


class DomainOutput(BaseModel):
    """Complete Domain pipeline output."""
    evidence: EvidencePack
    targets: DomainTargets | None = None
    queries_executed: int = 0
    search_time_ms: float = 0
