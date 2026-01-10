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
