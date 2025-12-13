# Data Contracts

This document is the **source of truth** for all data structures in ZORRO. Backend Pydantic models and frontend TypeScript types MUST match these definitions exactly.

## Core Principle: DocObj Immutability

The `DocObj` (Document Object) is created once during parsing and **never modified**. All agents read from it. All findings reference it by stable IDs. This ensures:
- Consistent anchoring across all findings
- Safe parallel agent execution
- Reliable export mapping

---

## Document Structures

### DocObj

The canonical, indexed representation of a parsed document.

```typescript
interface DocObj {
  id: string;                      // UUID v4, generated at parse time
  filename: string;                // Original filename
  type: 'pdf' | 'docx';
  title: string;                   // Extracted or user-provided
  
  sections: Section[];
  paragraphs: Paragraph[];
  figures: Figure[];
  references: Reference[];
  
  metadata: DocumentMetadata;
  
  createdAt: string;               // ISO 8601
}
```

```python
class DocObj(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    filename: str
    type: Literal["pdf", "docx"]
    title: str
    
    sections: list[Section]
    paragraphs: list[Paragraph]
    figures: list[Figure]
    references: list[Reference]
    
    metadata: DocumentMetadata
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### Section

```typescript
interface Section {
  id: string;                      // e.g., "sec_001"
  index: number;                   // 0-based order
  title: string | null;            // May be null for untitled sections
  level: number;                   // Heading level (1-6)
  paragraphIds: string[];          // References to contained paragraphs
}
```

```python
class Section(BaseModel):
    id: str
    index: int
    title: str | None
    level: int
    paragraph_ids: list[str]
```

### Paragraph

The primary unit of text analysis.

```typescript
interface Paragraph {
  id: string;                      // e.g., "p_001"
  sectionId: string | null;        // May be null if no clear section
  index: number;                   // Global paragraph index
  text: string;                    // Full paragraph text
  sentences: Sentence[];
  
  // For export mapping (PDF)
  boundingBox?: BoundingBox;
  pageNumber?: number;
  
  // For export mapping (DOCX)
  xmlPath?: string;                // XPath to <w:p> element
}
```

```python
class Paragraph(BaseModel):
    id: str
    section_id: str | None
    index: int
    text: str
    sentences: list[Sentence]
    
    # Export mapping
    bounding_box: BoundingBox | None = None
    page_number: int | None = None
    xml_path: str | None = None
```

### Sentence

```typescript
interface Sentence {
  id: string;                      // e.g., "p_001_s_002"
  paragraphId: string;
  index: number;                   // Index within paragraph
  text: string;
  startChar: number;               // Character offset in paragraph
  endChar: number;
}
```

```python
class Sentence(BaseModel):
    id: str
    paragraph_id: str
    index: int
    text: str
    start_char: int
    end_char: int
```

### Figure

```typescript
interface Figure {
  id: string;                      // e.g., "fig_001"
  index: number;
  caption: string | null;
  captionParagraphId: string | null;  // If caption is a separate paragraph
  
  // Location info
  pageNumber?: number;             // PDF
  afterParagraphId?: string;       // Approximate position
  
  // Extraction metadata
  extractionMethod: 'inline' | 'textbox' | 'float' | 'unknown';
  boundingBox?: BoundingBox;
}
```

```python
class Figure(BaseModel):
    id: str
    index: int
    caption: str | None
    caption_paragraph_id: str | None
    
    page_number: int | None = None
    after_paragraph_id: str | None = None
    
    extraction_method: Literal["inline", "textbox", "float", "unknown"]
    bounding_box: BoundingBox | None = None
```

### Reference

```typescript
interface Reference {
  id: string;                      // e.g., "ref_001"
  index: number;
  rawText: string;
  // Future: parsed citation fields
}
```

```python
class Reference(BaseModel):
    id: str
    index: int
    raw_text: str
```

### BoundingBox

For PDF export mapping.

```typescript
interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  pageNumber: number;
}
```

```python
class BoundingBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float
    page_number: int
```

### DocumentMetadata

```typescript
interface DocumentMetadata {
  pageCount?: number;
  wordCount: number;
  characterCount: number;
  author?: string;
  createdDate?: string;
  modifiedDate?: string;
}
```

```python
class DocumentMetadata(BaseModel):
    page_count: int | None = None
    word_count: int
    character_count: int
    author: str | None = None
    created_date: datetime | None = None
    modified_date: datetime | None = None
```

---

## Finding Structures

### Finding

The output of any agent analysis.

```typescript
interface Finding {
  id: string;                      // UUID
  agentId: AgentId;
  category: FindingCategory;
  severity: Severity;
  confidence: number;              // 0.0 - 1.0
  
  title: string;                   // Short summary (< 100 chars)
  description: string;             // Full explanation
  
  anchors: Anchor[];               // REQUIRED: at least one anchor
  
  proposedEdit?: ProposedEdit;
  
  metadata?: Record<string, unknown>;  // Agent-specific data
  
  createdAt: string;
}

type AgentId = 
  | 'context_builder'
  | 'clarity_inspector'
  | 'rigor_inspector'
  | 'adversarial_critic'
  | 'domain_validator';

type FindingCategory =
  | 'clarity_sentence'
  | 'clarity_paragraph'
  | 'clarity_section'
  | 'clarity_flow'
  | 'rigor_methodology'
  | 'rigor_logic'
  | 'rigor_evidence'
  | 'rigor_statistics'
  | 'scope_overclaim'
  | 'scope_underclaim'
  | 'scope_missing'
  | 'domain_convention'
  | 'domain_terminology'
  | 'domain_factual'
  | 'adversarial_weakness'
  | 'adversarial_gap'
  | 'adversarial_alternative';

type Severity = 'critical' | 'major' | 'minor' | 'suggestion';
```

```python
class AgentId(str, Enum):
    CONTEXT_BUILDER = "context_builder"
    CLARITY_INSPECTOR = "clarity_inspector"
    RIGOR_INSPECTOR = "rigor_inspector"
    ADVERSARIAL_CRITIC = "adversarial_critic"
    DOMAIN_VALIDATOR = "domain_validator"

class FindingCategory(str, Enum):
    CLARITY_SENTENCE = "clarity_sentence"
    CLARITY_PARAGRAPH = "clarity_paragraph"
    CLARITY_SECTION = "clarity_section"
    CLARITY_FLOW = "clarity_flow"
    RIGOR_METHODOLOGY = "rigor_methodology"
    RIGOR_LOGIC = "rigor_logic"
    RIGOR_EVIDENCE = "rigor_evidence"
    RIGOR_STATISTICS = "rigor_statistics"
    SCOPE_OVERCLAIM = "scope_overclaim"
    SCOPE_UNDERCLAIM = "scope_underclaim"
    SCOPE_MISSING = "scope_missing"
    DOMAIN_CONVENTION = "domain_convention"
    DOMAIN_TERMINOLOGY = "domain_terminology"
    DOMAIN_FACTUAL = "domain_factual"
    ADVERSARIAL_WEAKNESS = "adversarial_weakness"
    ADVERSARIAL_GAP = "adversarial_gap"
    ADVERSARIAL_ALTERNATIVE = "adversarial_alternative"

class Severity(str, Enum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    SUGGESTION = "suggestion"

class Finding(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: AgentId
    category: FindingCategory
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    
    title: str = Field(max_length=100)
    description: str
    
    anchors: list[Anchor] = Field(min_length=1)
    
    proposed_edit: ProposedEdit | None = None
    
    metadata: dict[str, Any] | None = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### Anchor

References specific text in the DocObj.

```typescript
interface Anchor {
  paragraphId: string;             // REQUIRED
  sentenceId?: string;             // More specific if available
  startChar?: number;              // Character offset in paragraph
  endChar?: number;
  quotedText: string;              // REQUIRED: the actual text
}
```

```python
class Anchor(BaseModel):
    paragraph_id: str
    sentence_id: str | None = None
    start_char: int | None = None
    end_char: int | None = None
    quoted_text: str
```

### ProposedEdit

Optional rewrite suggestion.

```typescript
interface ProposedEdit {
  type: 'replace' | 'delete' | 'insert_before' | 'insert_after';
  anchor: Anchor;                  // What to modify
  newText?: string;                // For replace/insert
  rationale: string;               // Why this change
}
```

```python
class EditType(str, Enum):
    REPLACE = "replace"
    DELETE = "delete"
    INSERT_BEFORE = "insert_before"
    INSERT_AFTER = "insert_after"

class ProposedEdit(BaseModel):
    type: EditType
    anchor: Anchor
    new_text: str | None = None
    rationale: str
```

---

## Review Structures

### ReviewConfig

Configuration for a review job, frozen at start.

```typescript
interface ReviewConfig {
  tier: 'standard' | 'deep';
  focusDimensions: FocusDimension[];
  domainHint?: string;
  steeringMemo?: string;           // From config chat
  
  // Feature flags
  enableAdversarial: boolean;
  enableDomainValidation: boolean;
}

type FocusDimension = 
  | 'argumentation'
  | 'methodology'
  | 'clarity'
  | 'completeness';
```

```python
class ReviewTier(str, Enum):
    STANDARD = "standard"
    DEEP = "deep"

class FocusDimension(str, Enum):
    ARGUMENTATION = "argumentation"
    METHODOLOGY = "methodology"
    CLARITY = "clarity"
    COMPLETENESS = "completeness"

class ReviewConfig(BaseModel):
    tier: ReviewTier = ReviewTier.STANDARD
    focus_dimensions: list[FocusDimension]
    domain_hint: str | None = None
    steering_memo: str | None = None
    
    enable_adversarial: bool = True
    enable_domain_validation: bool = True
```

### ReviewJob

Runtime state of a review.

```typescript
interface ReviewJob {
  id: string;                      // UUID
  documentId: string;
  config: ReviewConfig;
  status: ReviewStatus;
  
  currentPhase?: string;
  agentStatuses: Record<AgentId, AgentStatus>;
  
  findings: Finding[];
  
  startedAt: string;
  completedAt?: string;
  error?: string;
}

type ReviewStatus = 
  | 'pending'
  | 'parsing'
  | 'analyzing'
  | 'synthesizing'
  | 'completed'
  | 'failed';

interface AgentStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  findingsCount: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
```

```python
class ReviewStatus(str, Enum):
    PENDING = "pending"
    PARSING = "parsing"
    ANALYZING = "analyzing"
    SYNTHESIZING = "synthesizing"
    COMPLETED = "completed"
    FAILED = "failed"

class AgentStatus(BaseModel):
    status: Literal["pending", "running", "completed", "failed"]
    findings_count: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None

class ReviewJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: str
    config: ReviewConfig
    status: ReviewStatus = ReviewStatus.PENDING
    
    current_phase: str | None = None
    agent_statuses: dict[AgentId, AgentStatus] = Field(default_factory=dict)
    
    findings: list[Finding] = Field(default_factory=list)
    
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    error: str | None = None
```

---

## User Decision Structures

### Decision

User action on a finding.

```typescript
interface Decision {
  id: string;
  findingId: string;
  action: DecisionAction;
  
  // For 'accept_edit' with modifications
  finalText?: string;
  
  timestamp: string;
}

type DecisionAction = 
  | 'accept'                       // Accept finding, no edit
  | 'accept_edit'                  // Accept proposed edit (possibly modified)
  | 'dismiss';                     // Reject finding
```

```python
class DecisionAction(str, Enum):
    ACCEPT = "accept"
    ACCEPT_EDIT = "accept_edit"
    DISMISS = "dismiss"

class Decision(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    finding_id: str
    action: DecisionAction
    final_text: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
```

### ReviewSession

Complete state for the review workspace.

```typescript
interface ReviewSession {
  documentId: string;
  document: DocObj;
  findings: Finding[];
  decisions: Decision[];
  
  // Derived
  pendingFindings: Finding[];
  acceptedFindings: Finding[];
  dismissedFindings: Finding[];
}
```

---

## SSE Event Structures

### SSE Events

All real-time events from the server.

```typescript
type SSEEvent =
  | PhaseStartedEvent
  | PhaseCompletedEvent
  | AgentStartedEvent
  | AgentCompletedEvent
  | FindingDiscoveredEvent
  | ReviewCompletedEvent
  | ErrorEvent;

interface PhaseStartedEvent {
  type: 'phase_started';
  phase: string;
  timestamp: string;
}

interface PhaseCompletedEvent {
  type: 'phase_completed';
  phase: string;
  timestamp: string;
}

interface AgentStartedEvent {
  type: 'agent_started';
  agentId: AgentId;
  timestamp: string;
}

interface AgentCompletedEvent {
  type: 'agent_completed';
  agentId: AgentId;
  findingsCount: number;
  timestamp: string;
}

interface FindingDiscoveredEvent {
  type: 'finding_discovered';
  finding: Finding;
  timestamp: string;
}

interface ReviewCompletedEvent {
  type: 'review_completed';
  totalFindings: number;
  timestamp: string;
}

interface ErrorEvent {
  type: 'error';
  message: string;
  recoverable: boolean;
  timestamp: string;
}
```

```python
class EventType(str, Enum):
    PHASE_STARTED = "phase_started"
    PHASE_COMPLETED = "phase_completed"
    AGENT_STARTED = "agent_started"
    AGENT_COMPLETED = "agent_completed"
    FINDING_DISCOVERED = "finding_discovered"
    REVIEW_COMPLETED = "review_completed"
    ERROR = "error"

class BaseEvent(BaseModel):
    type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class PhaseStartedEvent(BaseEvent):
    type: Literal[EventType.PHASE_STARTED] = EventType.PHASE_STARTED
    phase: str

class PhaseCompletedEvent(BaseEvent):
    type: Literal[EventType.PHASE_COMPLETED] = EventType.PHASE_COMPLETED
    phase: str

class AgentStartedEvent(BaseEvent):
    type: Literal[EventType.AGENT_STARTED] = EventType.AGENT_STARTED
    agent_id: AgentId

class AgentCompletedEvent(BaseEvent):
    type: Literal[EventType.AGENT_COMPLETED] = EventType.AGENT_COMPLETED
    agent_id: AgentId
    findings_count: int

class FindingDiscoveredEvent(BaseEvent):
    type: Literal[EventType.FINDING_DISCOVERED] = EventType.FINDING_DISCOVERED
    finding: Finding

class ReviewCompletedEvent(BaseEvent):
    type: Literal[EventType.REVIEW_COMPLETED] = EventType.REVIEW_COMPLETED
    total_findings: int

class ErrorEvent(BaseEvent):
    type: Literal[EventType.ERROR] = EventType.ERROR
    message: str
    recoverable: bool
```

---

## Export Structures

### ExportRequest

```typescript
interface ExportRequest {
  documentId: string;
  decisions: Decision[];
  format: 'docx' | 'pdf';
  options: ExportOptions;
}

interface ExportOptions {
  includeUnresolvedAsComments: boolean;
  trackChangesAuthor: string;
}
```

```python
class ExportFormat(str, Enum):
    DOCX = "docx"
    PDF = "pdf"

class ExportOptions(BaseModel):
    include_unresolved_as_comments: bool = True
    track_changes_author: str = "ZORRO Review"

class ExportRequest(BaseModel):
    document_id: str
    decisions: list[Decision]
    format: ExportFormat
    options: ExportOptions = Field(default_factory=ExportOptions)
```

---

## API Request/Response Structures

### Document Parse

```typescript
// POST /document/parse
interface ParseRequest {
  // multipart/form-data with file
  title?: string;                  // Override title
}

interface ParseResponse {
  document: DocObj;
}
```

### Review Start

```typescript
// POST /review/start
interface StartReviewRequest {
  documentId: string;
  config: ReviewConfig;
}

interface StartReviewResponse {
  jobId: string;
  status: ReviewStatus;
}
```

### Review Result

```typescript
// GET /review/{id}/result
interface ReviewResultResponse {
  job: ReviewJob;
  document: DocObj;
}
```

---

## Demo Fixtures Structure

For demo mode, fixtures are stored in `apps/web/src/fixtures/`:

```
fixtures/
├── documents/
│   ├── sample-manuscript.json    # DocObj
│   └── sample-grant.json         # DocObj
└── findings/
    ├── sample-manuscript.json    # Finding[]
    └── sample-grant.json         # Finding[]
```

Each demo document needs a corresponding findings file with pre-built findings that reference valid paragraph/sentence IDs from that document.
