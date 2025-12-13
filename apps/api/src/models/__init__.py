"""Pydantic models for ZORRO API - Source of Truth from DATA_CONTRACTS.md"""

from .document import (
    BoundingBox,
    DocumentMetadata,
    Reference,
    Figure,
    Sentence,
    Paragraph,
    Section,
    DocObj,
)
from .finding import (
    AgentId,
    FindingCategory,
    Severity,
    EditType,
    Anchor,
    ProposedEdit,
    Finding,
)
from .review import (
    ReviewTier,
    FocusDimension,
    ReviewConfig,
    ReviewStatus,
    AgentStatus,
    ReviewJob,
    DecisionAction,
    Decision,
)
from .events import (
    EventType,
    BaseEvent,
    PhaseStartedEvent,
    PhaseCompletedEvent,
    AgentStartedEvent,
    AgentCompletedEvent,
    FindingDiscoveredEvent,
    ReviewCompletedEvent,
    ErrorEvent,
)
from .export import (
    ExportFormat,
    ExportOptions,
    ExportRequest,
)

__all__ = [
    # Document models
    "BoundingBox",
    "DocumentMetadata",
    "Reference",
    "Figure",
    "Sentence",
    "Paragraph",
    "Section",
    "DocObj",
    # Finding models
    "AgentId",
    "FindingCategory",
    "Severity",
    "EditType",
    "Anchor",
    "ProposedEdit",
    "Finding",
    # Review models
    "ReviewTier",
    "FocusDimension",
    "ReviewConfig",
    "ReviewStatus",
    "AgentStatus",
    "ReviewJob",
    "DecisionAction",
    "Decision",
    # Event models
    "EventType",
    "BaseEvent",
    "PhaseStartedEvent",
    "PhaseCompletedEvent",
    "AgentStartedEvent",
    "AgentCompletedEvent",
    "FindingDiscoveredEvent",
    "ReviewCompletedEvent",
    "ErrorEvent",
    # Export models
    "ExportFormat",
    "ExportOptions",
    "ExportRequest",
]