# Build Phases — ZORRO Review System

This document outlines the phased build approach with parallelization opportunities and Claude Code prompts for each task.

## Legend

```
🔴 BLOCKING    — Must complete before dependent work starts
🟡 PARALLEL    — Can run simultaneously with other marked tasks
🟢 INDEPENDENT — Can be done anytime after prerequisites
⏱️ ESTIMATE    — Rough time estimate for a single developer
```

---

## Phase 0: Contracts & Scaffolding 🔴

**Status**: BLOCKING — Everything depends on this
**Estimate**: ~4 hours

This phase establishes the data contracts and project structure that all subsequent work depends on.

### 0.1 Project Scaffolding

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create a monorepo for the ZORRO Review System with this structure:

zorro-review/
├── apps/
│   ├── web/           # React + Vite + TypeScript frontend
│   └── api/           # Python FastAPI backend
├── packages/
│   └── shared/        # Shared TypeScript types
├── docs/              # Documentation (already created)
├── .gitignore
├── README.md
└── package.json       # Workspace root

For apps/web:
- Initialize with: npm create vite@latest web -- --template react-ts
- Install: tailwindcss, postcss, autoprefixer, axios, react-router-dom
- Configure Tailwind with a minimal design system
- Set up path aliases (@/ → src/)

For apps/api:
- Create pyproject.toml with dependencies:
  - fastapi
  - uvicorn[standard]
  - pydantic>=2.0
  - python-docx
  - pymupdf
  - anthropic
  - httpx (for Perplexity)
  - structlog
  - pytest, pytest-asyncio (dev)
- Create src/ directory structure per CLAUDE.md
- Create basic main.py with FastAPI app

Do NOT implement any features yet — just scaffolding and configs.
```
</details>

### 0.2 Pydantic Models (Backend Source of Truth)

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Read docs/DATA_CONTRACTS.md completely.

Create all Pydantic v2 models in apps/api/src/models/:

1. document.py — DocObj, Section, Paragraph, Sentence, Figure, Reference, BoundingBox, DocumentMetadata
2. finding.py — Finding, Anchor, ProposedEdit, all Enums (AgentId, FindingCategory, Severity, EditType)
3. review.py — ReviewConfig, ReviewJob, AgentStatus, ReviewTier, FocusDimension, ReviewStatus
4. decision.py — Decision, DecisionAction
5. events.py — All SSE event types (BaseEvent and subclasses)
6. api.py — Request/Response models for all API endpoints

Requirements:
- Use Pydantic v2 syntax (model_validator, field_validator)
- All fields must have type hints
- Use Field() for defaults, validation, descriptions
- Include docstrings
- Export all models from models/__init__.py

Test by importing all models in a Python REPL to verify no import errors.
```
</details>

### 0.3 TypeScript Types (Frontend Mirror)

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Read docs/DATA_CONTRACTS.md completely.

Create TypeScript types in apps/web/src/types/index.ts that EXACTLY mirror the Pydantic models.

Requirements:
- Use interface for objects, type for unions/aliases
- Match field names (convert snake_case to camelCase)
- Include all enums as const objects or string literal unions
- Add JSDoc comments matching Pydantic docstrings
- Export everything

Also create apps/web/src/types/api.ts for:
- API request/response types
- Error response type
- SSE event discriminated union

The types must be copy-paste compatible with the Pydantic model outputs after JSON serialization.
```
</details>

### 0.4 API Endpoint Stubs

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create FastAPI router stubs in apps/api/src/routers/:

1. document.py:
   - POST /document/parse (accepts file upload, returns ParseResponse)
   - GET /document/{id} (returns DocObj)

2. review.py:
   - POST /review/start (accepts StartReviewRequest, returns StartReviewResponse)
   - GET /review/{id}/events (SSE endpoint)
   - GET /review/{id}/result (returns ReviewResultResponse)

3. export.py:
   - POST /export (accepts ExportRequest, returns file download)

All endpoints should:
- Have proper type hints with Pydantic models
- Return 501 Not Implemented for now
- Include OpenAPI descriptions
- Be registered in main.py

Also create apps/api/src/config.py with Settings class using pydantic-settings for environment variables.
```
</details>

---

## Phase 1: Parallel Foundation 🟡

**Status**: Three parallel streams
**Estimate**: ~2-3 days total

After Phase 0, these three streams can run in parallel:

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 1 PARALLELIZATION                      │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   STREAM A      │   STREAM B      │   STREAM C                  │
│   Parsers       │   Frontend      │   Backend Infra             │
│   🟡            │   🟡            │   🟡                        │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ DOCX Parser     │ Layout/Routes   │ Job Manager                 │
│ PDF Parser      │ Upload Screen   │ SSE Infrastructure          │
│ Figure Extract  │ Setup Screen    │ Anthropic Client            │
│                 │ Skeletons       │ Perplexity Client           │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

---

### Stream A: Document Parsers 🟡

#### A.1 DOCX Parser

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/parsers/docx_parser.py

The parser must convert a .docx file into a DocObj (see docs/DATA_CONTRACTS.md).

Requirements:

1. Use python-docx library
2. Extract:
   - Sections (detect headings by style: Heading 1, Heading 2, etc.)
   - Paragraphs with stable IDs (p_001, p_002, ...)
   - Sentences within paragraphs (use nltk or simple regex for sentence splitting)
   - Sentence IDs (p_001_s_001, p_001_s_002, ...)
   - Character offsets for each sentence within its paragraph

3. Store xml_path for each paragraph — the XPath to find the <w:p> element
   This is CRITICAL for export. Use python-docx's internal _element property.

4. Figure extraction:
   - Detect inline images in paragraphs
   - Detect images in text boxes (DrawingML shapes)
   - Extract captions (text immediately before/after "Figure X" pattern)
   - Set extraction_method field appropriately

5. Reference extraction:
   - Detect "References" or "Bibliography" section
   - Extract each reference as a Reference object

6. Metadata extraction:
   - Word count (actual words, not XML elements)
   - Character count
   - Author from document properties

Create tests in apps/api/tests/parsers/test_docx_parser.py with a simple test document.

Interface:
```python
async def parse_docx(file_path: Path, title_override: str | None = None) -> DocObj:
    ...
```
```
</details>

#### A.2 PDF Parser

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/parsers/pdf_parser.py

The parser must convert a .pdf file into a DocObj (see docs/DATA_CONTRACTS.md).

Requirements:

1. Use PyMuPDF (fitz) library
2. Extract:
   - Text blocks with bounding boxes
   - Group text blocks into paragraphs (by spatial proximity)
   - Detect section headings (by font size/weight heuristics)
   - Split paragraphs into sentences with character offsets

3. For EVERY paragraph, store:
   - bounding_box (BoundingBox model)
   - page_number
   This is CRITICAL for PDF export annotations.

4. Figure extraction:
   - Detect images on each page
   - Find associated captions (text near image containing "Figure" or "Fig.")
   - Store bounding box for each figure

5. Heuristics for section detection:
   - Larger font size than body text
   - Bold weight
   - Numbered patterns (1., 1.1, etc.)
   - Common section names (Abstract, Introduction, Methods, Results, Discussion, References)

6. Reference extraction:
   - Find References section
   - Split by numbered patterns or line breaks

Interface:
```python
async def parse_pdf(file_path: Path, title_override: str | None = None) -> DocObj:
    ...
```

Create tests in apps/api/tests/parsers/test_pdf_parser.py
```
</details>

#### A.3 Figure Extraction Deep Dive (DOCX)

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Enhance apps/api/src/parsers/docx_parser.py with robust figure extraction.

Word documents can contain figures in multiple ways:
1. Inline images (in paragraph runs)
2. Floating images (anchored shapes)
3. Images inside text boxes
4. Images inside tables

For each method, implement detection:

1. Inline images:
   - Look for <w:drawing> elements inside <w:r> (run) elements
   - Extract image dimensions and position

2. Floating images:
   - Look for <w:drawing> with <wp:anchor> (not <wp:inline>)
   - These float relative to the page/paragraph

3. Text boxes:
   - Look for <w:txbxContent> elements
   - Images may be inside text box content
   - Captions are often in the same text box

4. Tables:
   - Check each cell for images
   - Common pattern: image in one cell, caption in adjacent cell

Caption detection algorithm:
1. Search for "Figure N" or "Fig. N" patterns near the image
2. Check paragraph before image
3. Check paragraph after image
4. Check text box content containing image
5. Check adjacent table cells

Store extraction_method in the Figure object to aid debugging.

Add test cases for each extraction method.
```
</details>

---

### Stream B: Frontend Shell 🟡

#### B.1 Layout and Routing

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Set up the frontend application shell in apps/web/

1. Configure React Router with routes:
   - / → redirect to /upload
   - /upload → UploadScreen
   - /setup → SetupScreen
   - /process → ProcessScreen
   - /review → ReviewScreen
   - /export → ExportScreen

2. Create a Layout component:
   - Header with ZORRO logo/title
   - Progress indicator showing current step (Upload → Setup → Process → Review → Export)
   - Main content area
   - No sidebar needed

3. Create src/components/ui/ with minimal primitives:
   - Button (primary, secondary, ghost variants)
   - Card
   - Input
   - Select
   - Toggle
   - Badge (for severity indicators)
   - Progress (for process screen)

Use Tailwind classes. Keep components minimal — we'll enhance later.

4. Set up global state context for:
   - Current document (DocObj | null)
   - Current review mode ('demo' | 'dynamic')
   - Review config (ReviewConfig | null)

5. Create src/services/api.ts with axios instance:
   - Base URL from environment
   - Request/response interceptors for error handling
   - Stub methods for all API endpoints (return mock data for now)
```
</details>

#### B.2 Upload Screen

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/web/src/screens/UploadScreen.tsx

Requirements:

1. File upload area:
   - Drag-and-drop zone
   - Click to browse
   - Accept .pdf and .docx only
   - Show file type icon after selection
   - Show filename and size

2. Optional title override input:
   - Text field to override document title
   - Placeholder: "Leave blank to auto-detect"

3. Demo document dropdown:
   - Label: "Or try a demo document"
   - Options: "Sample Manuscript", "Sample Grant Application"
   - Selecting a demo loads pre-built DocObj from fixtures

4. Upload button:
   - Disabled until file selected or demo chosen
   - On click: POST to /document/parse (or load fixture for demo)
   - Show loading spinner during upload
   - Navigate to /setup on success
   - Show error toast on failure

5. Large document warning:
   - If file size > 5MB, show yellow warning:
     "Large documents may take longer to analyze and results may be less precise."

6. Store uploaded DocObj in global context

Visual design: Center the upload area, make it prominent. Keep it clean and minimal.
```
</details>

#### B.3 Setup Screen

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/web/src/screens/SetupScreen.tsx

Requirements:

1. Document summary card:
   - Title
   - Type (PDF/DOCX)
   - Page/word count
   - Section count

2. Review tier selection:
   - Radio buttons: Standard / Deep
   - Brief description of each

3. Focus dimensions:
   - Checkboxes: Argumentation, Methodology, Clarity, Completeness
   - Default: all checked

4. Domain hint (optional):
   - Text input
   - Placeholder: "e.g., Biomedical research, Computer science"

5. Config chat box (optional):
   - Small text area
   - Label: "Additional guidance for reviewers"
   - Placeholder: "e.g., Focus on statistical methods, ignore formatting"
   - This becomes the steering_memo

6. Demo/Dynamic toggle:
   - Two subtle buttons below the form
   - "Demo" — Skip to review with pre-built findings
   - "Dynamic" — Run live analysis
   - Visual: Demo is outlined/ghost, Dynamic is filled/primary
   - Clear indicator of which is selected

7. Start Review button:
   - Builds ReviewConfig from form
   - Stores in context
   - If Demo: Navigate directly to /review
   - If Dynamic: POST /review/start, navigate to /process

8. Validation:
   - At least one focus dimension must be selected
   - Show validation errors inline
```
</details>

#### B.4 Process Screen Skeleton

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/web/src/screens/ProcessScreen.tsx (skeleton only)

This screen shows real-time progress during analysis. For now, create the UI structure with mock data.

Requirements:

1. Overall progress section:
   - Progress bar showing phases: Parsing → Context → Analysis → Synthesis
   - Current phase highlighted
   - Elapsed time counter

2. Agent activity panel:
   - List of agents with status indicators
   - Status: pending (gray), running (blue pulse), completed (green check), failed (red x)
   - Show which section each agent is currently analyzing (mock)

3. Live findings panel:
   - Scrollable list of findings as they're discovered
   - Each finding shows: severity badge, title, category
   - Click to expand description (preview only)
   - Counter: "12 findings discovered"

4. Cancel button:
   - Allows canceling the review
   - Shows confirmation dialog

5. Auto-navigation:
   - When review completes (or in demo mode), navigate to /review

For now, render with mock data. SSE integration comes in Phase 5.
```
</details>

#### B.5 Review Screen Skeleton

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/web/src/screens/ReviewScreen.tsx (skeleton only)

This is the main adjudication interface. Create the layout with mock data.

Requirements:

1. Two-column layout:
   - Left (60%): Document viewer
   - Right (40%): Findings panel
   - Resizable divider (nice to have)

2. Document viewer (left):
   - Render document as paragraphs
   - Section headers styled differently
   - Paragraph numbers in margin
   - Highlighted spans for findings (show which text has issues)
   - Collapsible "Figures" section at bottom showing figure captions

3. Findings panel (right):
   - Filter bar:
     - By severity: All / Critical / Major / Minor / Suggestion
     - By category: dropdown with categories
     - By status: All / Pending / Accepted / Dismissed
   - Findings list:
     - Each finding is a card
     - Shows: severity badge, title, category, agent icon
     - Click to expand full description
     - Highlighted anchor text quote

4. Finding card actions:
   - Accept (check icon)
   - Dismiss (x icon)
   - If has proposed edit:
     - "View suggestion" button
     - Opens modal with before/after
     - Edit text before accepting

5. Counts display:
   - "47 findings • 12 accepted • 8 dismissed • 27 pending"

6. Continue to Export button:
   - Fixed at bottom
   - "Continue to Export →"

For now, use mock data from fixtures. Full integration in Phase 2.
```
</details>

---

### Stream C: Backend Infrastructure 🟡

#### C.1 Job Manager (In-Memory)

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/services/job_manager.py

This manages review job state in memory (no database yet).

Requirements:

1. Singleton pattern or dependency injection
2. Store ReviewJob objects in a dict keyed by job_id
3. Store DocObj objects in a dict keyed by document_id

Methods:
```python
class JobManager:
    async def create_job(self, document_id: str, config: ReviewConfig) -> ReviewJob:
        """Create a new review job"""
    
    async def get_job(self, job_id: str) -> ReviewJob | None:
        """Get job by ID"""
    
    async def update_job_status(self, job_id: str, status: ReviewStatus) -> None:
        """Update job status"""
    
    async def update_agent_status(self, job_id: str, agent_id: AgentId, status: AgentStatus) -> None:
        """Update status for a specific agent"""
    
    async def add_finding(self, job_id: str, finding: Finding) -> None:
        """Add a finding to the job"""
    
    async def store_document(self, doc: DocObj) -> None:
        """Store a parsed document"""
    
    async def get_document(self, document_id: str) -> DocObj | None:
        """Get document by ID"""
    
    async def complete_job(self, job_id: str, findings: list[Finding]) -> None:
        """Mark job as completed with final findings"""
```

4. Thread-safe access using asyncio.Lock for writes
5. TTL cleanup: Jobs older than 1 hour are eligible for cleanup
6. Create background task that cleans up old jobs every 5 minutes
```
</details>

#### C.2 SSE Infrastructure

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/services/sse.py

Server-Sent Events infrastructure for real-time updates.

Requirements:

1. Event broadcaster that maintains subscriptions per job_id
```python
class EventBroadcaster:
    async def subscribe(self, job_id: str) -> AsyncGenerator[str, None]:
        """Subscribe to events for a job. Yields SSE-formatted strings."""
    
    async def publish(self, job_id: str, event: BaseEvent) -> None:
        """Publish an event to all subscribers of a job"""
    
    async def close_job(self, job_id: str) -> None:
        """Close all subscriptions for a job (called on completion)"""
```

2. SSE formatting:
   - Event type as "event:" line
   - Data as JSON "data:" line
   - Empty line separator
   - Example:
     ```
     event: finding_discovered
     data: {"type":"finding_discovered","finding":{...},"timestamp":"..."}
     
     ```

3. Heartbeat: Send comment line (`: heartbeat`) every 15 seconds to keep connection alive

4. Implement the SSE endpoint in routers/review.py:
```python
@router.get("/{job_id}/events")
async def stream_events(job_id: str):
    async def event_generator():
        async for event in broadcaster.subscribe(job_id):
            yield event
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

5. Handle client disconnection gracefully (remove subscription)
```
</details>

#### C.3 Anthropic Client Wrapper

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/clients/anthropic.py

A wrapper around the Anthropic SDK for structured outputs.

Requirements:

1. Initialize from settings (API key from environment)

2. Model selection helper:
```python
def get_model_for_agent(agent_id: AgentId, tier: ReviewTier) -> str:
    """
    Return the appropriate model string:
    - Standard tier: Haiku for clarity, Sonnet for others
    - Deep tier: Sonnet for clarity, Opus for others
    """
```

3. Structured completion method:
```python
async def complete_structured(
    self,
    model: str,
    system: str,
    messages: list[dict],
    response_model: type[BaseModel],
    max_tokens: int = 4096,
) -> BaseModel:
    """
    Make a completion request and parse into a Pydantic model.
    Uses tool_use to enforce JSON schema.
    """
```

4. Retry logic:
   - Retry on rate limit (429) with exponential backoff
   - Retry on transient errors (500, 502, 503) up to 3 times
   - Raise on 400 errors (bad request)

5. Token counting utility:
```python
def estimate_tokens(text: str) -> int:
    """Rough token estimate (chars / 4)"""
```

6. Logging: Log every API call with model, token counts, latency
```
</details>

#### C.4 Perplexity Client Wrapper

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/clients/perplexity.py

A client for the Perplexity API (used for domain validation searches).

Requirements:

1. Use httpx for async HTTP requests
2. Perplexity API endpoint: https://api.perplexity.ai/chat/completions
3. Use model: "sonar" or "sonar-pro" based on tier

4. Main method:
```python
async def search_with_context(
    self,
    query: str,
    context: str,
    max_tokens: int = 1024,
) -> PerplexityResponse:
    """
    Search for information related to a query, given document context.
    Returns search results with citations.
    """
```

5. Response model:
```python
class PerplexityResponse(BaseModel):
    answer: str
    citations: list[str]
    confidence: float  # Derived from response
```

6. Retry logic similar to Anthropic client

7. Rate limiting: Track requests per minute, delay if approaching limit

8. Logging: Log queries (truncated), response summaries, latency
```
</details>

---

## Phase 2: Demo Mode Complete 🟡

**Status**: Two parallel streams after Phase 1
**Estimate**: ~2 days

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 2 PARALLELIZATION                      │
├────────────────────────────────┬────────────────────────────────┤
│   STREAM A                     │   STREAM B                      │
│   Demo Fixtures                │   Review Workspace              │
│   🟡                           │   🟡                            │
├────────────────────────────────┼────────────────────────────────┤
│ Generate sample docs           │ Document viewer                 │
│ Generate sample findings       │ Finding cards                   │
│ Wire up fixture loading        │ Accept/dismiss logic            │
│                                │ Figures collapsible             │
└────────────────────────────────┴────────────────────────────────┘
```

---

### Stream A: Demo Fixtures 🟡

#### A.1 Generate Sample Documents

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create demo document fixtures in apps/web/src/fixtures/documents/

Generate two DocObj JSON files:

1. sample-manuscript.json
   - A ~10 paragraph academic manuscript structure
   - Sections: Abstract, Introduction, Methods, Results, Discussion, References
   - Include 2-3 figures with captions
   - Realistic scientific language (can be lorem-ipsum-ish but structured)
   - All IDs must be valid (p_001, p_001_s_001, etc.)

2. sample-grant.json
   - A ~8 paragraph grant application structure
   - Sections: Summary, Specific Aims, Background, Approach, Timeline
   - Include 1 figure
   - All IDs must be valid

Requirements:
- Valid DocObj structure per DATA_CONTRACTS.md
- Realistic word counts (1500-3000 words each)
- Include figures with captions
- All paragraph and sentence IDs sequential
- Character offsets for sentences must be accurate
```
</details>

#### A.2 Generate Sample Findings

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create demo finding fixtures in apps/web/src/fixtures/findings/

For each demo document, create a findings JSON file:

1. sample-manuscript-findings.json (~20-30 findings)
   - Mix of categories: clarity, rigor, adversarial, domain
   - Mix of severities: 2-3 critical, 5-8 major, 10-12 minor, rest suggestions
   - Each finding MUST anchor to valid paragraph/sentence IDs from sample-manuscript.json
   - Include proposed edits for ~50% of findings
   - Vary confidence scores (0.7-0.95)

2. sample-grant-findings.json (~15-20 findings)
   - Similar distribution
   - Anchors must reference sample-grant.json IDs

Requirements:
- All anchors must use real IDs from the corresponding document
- quotedText must exactly match text in the document
- Realistic finding titles and descriptions
- Proposed edits should be plausible improvements
- Include at least one finding per category type
```
</details>

#### A.3 Fixture Loading System

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/web/src/services/fixtures.ts

A service that loads demo fixtures and simulates the backend responses.

Requirements:

1. Export functions:
```typescript
export async function loadDemoDocument(name: 'manuscript' | 'grant'): Promise<DocObj>;
export async function loadDemoFindings(name: 'manuscript' | 'grant'): Promise<Finding[]>;
export async function getDemoDocuments(): Promise<{name: string, label: string}[]>;
```

2. The functions should:
   - Import the JSON files
   - Simulate network delay (300-500ms) for realism
   - Return typed objects

3. Create a context/hook for demo mode:
```typescript
const { isDemo, demoDocument, demoFindings, loadDemo } = useDemo();
```

4. Integrate with UploadScreen:
   - When demo dropdown selection changes, call loadDemo()
   - Store in context

5. Integrate with SetupScreen:
   - When Demo button clicked, skip API call
   - Navigate directly to ReviewScreen with demo data
```
</details>

---

### Stream B: Review Workspace Complete 🟡

#### B.1 Document Viewer Component

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/web/src/components/domain/DocumentViewer.tsx

A component that renders a DocObj as readable text with anchor highlighting.

Props:
```typescript
interface DocumentViewerProps {
  document: DocObj;
  findings: Finding[];
  selectedFindingId: string | null;
  onParagraphClick?: (paragraphId: string) => void;
}
```

Requirements:

1. Render structure:
   - Group paragraphs by section
   - Section headers styled as headings
   - Paragraph text with line numbers in margin

2. Highlight anchored text:
   - For each finding, highlight the anchored text spans
   - Use severity-based colors (red=critical, orange=major, yellow=minor, blue=suggestion)
   - When finding is selected, scroll to and emphasize that highlight

3. Multiple findings on same text:
   - Stack highlights with transparency
   - Show indicator (e.g., badge) for overlapping findings

4. Figures section:
   - Collapsible section at bottom: "Figures (N)"
   - List each figure with caption
   - No actual images (we don't store image data)

5. Performance:
   - Virtualize if document > 50 paragraphs
   - Memoize paragraph components

6. Click handling:
   - Click on paragraph → filter findings to that paragraph
```
</details>

#### B.2 Finding Card Component

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/web/src/components/domain/FindingCard.tsx

A card component for displaying a single finding.

Props:
```typescript
interface FindingCardProps {
  finding: Finding;
  decision: Decision | null;
  isSelected: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onDismiss: () => void;
  onAcceptEdit: (finalText: string) => void;
}
```

Requirements:

1. Card structure:
   - Header: severity badge + title + agent icon
   - Collapsed: category, confidence bar, quoted anchor text (truncated)
   - Expanded: full description, all anchors, proposed edit if present

2. Severity badges:
   - Critical: red, "⚠️ Critical"
   - Major: orange, "Major"
   - Minor: yellow, "Minor"
   - Suggestion: blue, "💡 Suggestion"

3. Agent icons:
   - Different icon/color for each agent
   - Tooltip showing agent name

4. Actions:
   - Accept button (green check) — calls onAccept
   - Dismiss button (gray X) — calls onDismiss
   - If proposed edit exists:
     - "View Suggestion" button
     - Opens modal with original text and suggested text
     - Text area to modify suggestion before accepting
     - "Accept Edit" button in modal

5. Visual states:
   - Pending: normal
   - Accepted: green border, checkmark, slightly faded
   - Dismissed: strikethrough, very faded

6. Selection:
   - Selected card has highlighted border
   - Selected finding scrolls document viewer to anchor
```
</details>

#### B.3 Review State Management

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/web/src/hooks/useReviewState.ts

A hook that manages the full state of the review workspace.

```typescript
interface ReviewState {
  document: DocObj;
  findings: Finding[];
  decisions: Map<string, Decision>;
  filters: FilterState;
  selectedFindingId: string | null;
}

interface FilterState {
  severity: Severity | 'all';
  category: FindingCategory | 'all';
  status: 'pending' | 'accepted' | 'dismissed' | 'all';
}

function useReviewState(initialDocument: DocObj, initialFindings: Finding[]): {
  state: ReviewState;
  
  // Selection
  selectFinding: (id: string) => void;
  clearSelection: () => void;
  
  // Decisions
  acceptFinding: (findingId: string) => void;
  dismissFinding: (findingId: string) => void;
  acceptEdit: (findingId: string, finalText: string) => void;
  
  // Filters
  setFilter: (filter: Partial<FilterState>) => void;
  
  // Derived
  filteredFindings: Finding[];
  stats: {
    total: number;
    pending: number;
    accepted: number;
    dismissed: number;
  };
}
```

Requirements:

1. Decisions stored as Map<findingId, Decision>
2. Filter logic properly chains severity + category + status
3. Stats computed from decisions
4. All state updates are immutable
5. Persist decisions to localStorage for session recovery
```
</details>

#### B.4 Complete Review Screen

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Complete apps/web/src/screens/ReviewScreen.tsx using the components from Phase 2.

Requirements:

1. Load data:
   - If demo mode: use fixture data from context
   - If dynamic mode: load from API (GET /review/{id}/result)
   - Show loading state while fetching

2. Layout:
   - Left: DocumentViewer
   - Right: FindingsPanel (filter bar + scrollable FindingCard list)
   - Responsive: stack on mobile

3. Wire up interactions:
   - Clicking finding card → select finding → scroll document viewer to anchor
   - Clicking accept/dismiss → update decision → update card visual
   - Clicking paragraph in document → filter findings to that paragraph

4. Stats bar:
   - Fixed at top of findings panel
   - "47 findings • 12 accepted • 8 dismissed • 27 pending"

5. Export button:
   - Fixed at bottom
   - Shows warning if critical findings are pending
   - "Continue to Export →"
   - Navigates to /export with current decisions

6. Keyboard shortcuts (nice to have):
   - j/k: navigate findings
   - a: accept current
   - d: dismiss current
   - Enter: expand/collapse
```
</details>

---

## Phase 3: Export 🔴

**Status**: Sequential — needs Phase 2
**Estimate**: ~1-2 days

### 3.1 DOCX Export Logic

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/export/docx_export.py

Export a reviewed document as DOCX with track changes.

Read the DOCX skill documentation at /mnt/skills/public/docx/SKILL.md first.

Requirements:

1. Input:
   - Original DocObj (with xml_path for paragraphs)
   - List of Decisions
   - ExportOptions

2. For each accepted edit:
   - Find the paragraph using xml_path
   - Insert track changes:
     - <w:del> for deleted text
     - <w:ins> for inserted text
   - Set author from ExportOptions.track_changes_author
   - Set timestamp

3. For accepted findings without edits:
   - Add a comment at the anchor location
   - Comment text: finding title + description

4. For pending findings (if include_unresolved_as_comments):
   - Add as comments
   - Different comment author: "ZORRO - Unresolved"

5. Preserve original document formatting:
   - Unpack original DOCX
   - Modify only the necessary paragraphs
   - Repack

6. Return bytes of the new DOCX file

Interface:
```python
async def export_docx(
    original_path: Path,
    doc: DocObj,
    decisions: list[Decision],
    findings: list[Finding],
    options: ExportOptions,
) -> bytes:
    ...
```

Test with sample document: create a finding, accept an edit, verify track changes appear in Word.
```
</details>

### 3.2 Export Screen

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/web/src/screens/ExportScreen.tsx

Final screen for downloading the reviewed document.

Requirements:

1. Summary section:
   - Document title
   - Review completed date
   - Stats: X findings reviewed, Y accepted, Z edits applied

2. Export options:
   - Format: DOCX (default, PDF grayed out for MVP)
   - Toggle: Include unresolved findings as comments
   - Author name for track changes (text input)

3. Findings summary table:
   - Columns: Severity, Title, Action Taken
   - Color-coded by severity
   - Collapsible sections by severity

4. Download button:
   - "Download Reviewed Document"
   - POST to /export endpoint
   - Show loading state
   - Trigger browser download when complete

5. Filename:
   - {original_title}_ZORRO_{YYYY-MM-DD}.docx

6. Option to start new review:
   - "Review Another Document" link
   - Clears state, navigates to /upload
```
</details>

### 3.3 Export API Endpoint

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Implement POST /export endpoint in apps/api/src/routers/export.py

Requirements:

1. Accept ExportRequest body
2. Retrieve DocObj and original file from JobManager
3. Retrieve findings for the document
4. Call export_docx() with the data
5. Return FileResponse with:
   - Correct MIME type (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
   - Content-Disposition header with filename
   - The DOCX bytes

6. Error handling:
   - 404 if document not found
   - 400 if invalid decisions (finding_id doesn't exist)
   - 500 if export fails

7. Logging:
   - Log export request
   - Log completion with file size
```
</details>

---

## ✅ DEMO MODE MILESTONE

At this point, the entire application works end-to-end in demo mode:
- Upload demo document
- Configure review
- Skip to review screen with pre-built findings
- Accept/dismiss findings
- Export DOCX with track changes

---

## Phase 4: Agents 🟡

**Status**: Five parallel streams
**Estimate**: ~3-4 days

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 4 PARALLELIZATION                               │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│   Context   │   Clarity   │    Rigor    │ Adversarial │      Domain         │
│   Builder   │  Inspector  │  Inspector  │   Critic    │    Validator        │
│   🟡        │   🟡        │   🟡        │   🟡        │   🟡                │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────────────┤
│ Claims      │ Sentence    │ Methodology │ Weaknesses  │ Perplexity          │
│ Scope       │ Paragraph   │ Logic       │ Gaps        │ Fact-check          │
│ Limits      │ Section     │ Evidence    │ Alternatives│ Conventions         │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘
```

### 4.0 Base Agent Class

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/agents/base.py

Abstract base class for all agents.

```python
from abc import ABC, abstractmethod

class BaseAgent(ABC):
    agent_id: AgentId
    
    def __init__(self, anthropic_client: AnthropicClient, tier: ReviewTier):
        self.client = anthropic_client
        self.tier = tier
    
    @abstractmethod
    async def analyze(
        self,
        doc: DocObj,
        config: ReviewConfig,
        context: ContextSnapshot | None = None,
    ) -> list[Finding]:
        """Run analysis and return findings."""
        pass
    
    def get_model(self) -> str:
        """Get the appropriate model for this agent and tier."""
        return get_model_for_agent(self.agent_id, self.tier)
    
    def create_finding(
        self,
        category: FindingCategory,
        severity: Severity,
        title: str,
        description: str,
        anchors: list[Anchor],
        confidence: float,
        proposed_edit: ProposedEdit | None = None,
    ) -> Finding:
        """Factory method to create properly structured findings."""
        return Finding(
            agent_id=self.agent_id,
            category=category,
            severity=severity,
            title=title,
            description=description,
            anchors=anchors,
            confidence=confidence,
            proposed_edit=proposed_edit,
        )
```

Also create ContextSnapshot model:
```python
class ContextSnapshot(BaseModel):
    """Shared context from Context Builder, consumed by other agents."""
    main_claims: list[str]
    stated_scope: str | None
    stated_limitations: list[str]
    methodology_summary: str | None
    domain_keywords: list[str]
```
```
</details>

### 4.1 Context Builder Agent 🟡

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/agents/context.py

The Context Builder extracts claims, scope, and limitations. It runs first and produces a ContextSnapshot used by other agents.

Read docs/PROMPTS.md for the exact prompt to use.

Requirements:

1. Input: DocObj, ReviewConfig
2. Output: tuple[list[Finding], ContextSnapshot]
3. Uses Sonnet (standard) or Opus (deep)

Analysis steps:
1. Extract main claims from Abstract/Introduction
2. Identify stated scope boundaries
3. Find explicit limitations/caveats
4. Summarize methodology approach
5. Extract domain-specific keywords

Finding types:
- scope_overclaim: Claims that exceed stated scope
- scope_underclaim: Unnecessarily weak claims
- scope_missing: Important scope not defined

The ContextSnapshot is NOT a finding — it's context for other agents.

Implementation:
1. Send document text (or strategic excerpts) to Claude
2. Request structured output matching ContextSnapshot + list of findings
3. Parse and return

Handle long documents:
- If > 50k tokens, send only Abstract, Intro, Methods summary, Discussion summary
- Note in findings if analysis was partial
```
</details>

### 4.2 Clarity Inspector Agent 🟡

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/agents/clarity.py

The Clarity Inspector identifies readability, flow, and structural issues.

Read docs/PROMPTS.md for the exact prompt to use.

Requirements:

1. Uses Haiku (standard) or Sonnet (deep)
2. Two passes:
   - Local pass: sentence and paragraph level issues
   - Global pass: section coherence and document flow

Finding categories:
- clarity_sentence: Unclear sentences, passive voice, jargon
- clarity_paragraph: Poor paragraph structure, missing topic sentences
- clarity_section: Section organization issues
- clarity_flow: Poor transitions, logical gaps between sections

Local pass implementation:
1. Process document in chunks (10 paragraphs at a time)
2. For each paragraph/sentence, identify issues
3. Generate findings with exact anchors

Global pass implementation:
1. Send section summaries (first sentence of each section)
2. Analyze coherence and flow
3. Generate findings for structural issues

Each finding MUST have:
- Exact quoted text in anchor
- Proposed edit when possible (rewritten sentence/paragraph)
```
</details>

### 4.3 Rigor Inspector Agent 🟡

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/agents/rigor.py

The Rigor Inspector detects methodological and logical problems.

Read docs/PROMPTS.md for the exact prompt to use.

Requirements:

1. Uses Sonnet (standard) or Opus (deep)
2. Two stages:
   - Detection: Find problems (runs on all documents)
   - Revision: Generate fixes (may be skipped in quick mode)

Finding categories:
- rigor_methodology: Study design, sampling, measurement issues
- rigor_logic: Logical fallacies, non-sequiturs, circular reasoning
- rigor_evidence: Claims without evidence, cherry-picking
- rigor_statistics: Statistical errors, p-hacking indicators, misinterpretation

Detection implementation:
1. Process document with focus on Methods and Results sections
2. Compare claims to evidence provided
3. Flag unsupported assertions

Revision implementation (if config allows):
1. For each detected issue, attempt to generate a fix
2. If fix is possible, create ProposedEdit
3. If fix requires more info, note in description

ContextSnapshot usage:
- Use main_claims to verify they're supported
- Use stated_limitations to avoid flagging acknowledged issues
```
</details>

### 4.4 Adversarial Critic Agent 🟡

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/agents/adversarial.py

The Adversarial Critic acts as a hostile reviewer, finding weaknesses.

Read docs/PROMPTS.md for the exact prompt to use.

Requirements:

1. Uses Sonnet (standard) or Opus (deep)
2. Enabled in both review tiers (per earlier discussion)

Finding categories:
- adversarial_weakness: Fundamental weaknesses in argument/evidence
- adversarial_gap: Missing components (controls, comparisons, considerations)
- adversarial_alternative: Alternative explanations not addressed

Adversarial prompting approach:
1. Instruct model to act as "Reviewer 2" — the harsh but fair reviewer
2. Look for:
   - What would a skeptical expert question?
   - What controls are missing?
   - What alternative explanations exist?
   - What would cause rejection at a top venue?

Implementation:
1. Send full document or strategic excerpts
2. Prime model with adversarial persona
3. Request structured critique

Quality control:
- Confidence threshold: Only include findings with confidence > 0.7
- Avoid petty criticisms: Focus on substantive issues
- Must be actionable: Every criticism should suggest what to improve
```
</details>

### 4.5 Domain Validator Agent 🟡

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/agents/domain.py

The Domain Validator uses Perplexity to validate field-specific claims.

Read docs/PROMPTS.md for the exact prompt to use.

Requirements:

1. Uses Perplexity API (not Anthropic)
2. Only runs if config.enable_domain_validation is true
3. Uses domain_hint if provided

Finding categories:
- domain_convention: Violations of field conventions
- domain_terminology: Incorrect or outdated terminology
- domain_factual: Factual claims that may be incorrect

Implementation:
1. Extract key claims and terminology from ContextSnapshot
2. For each significant claim:
   a. Generate search query
   b. Send to Perplexity with document context
   c. Analyze response for contradictions or confirmations
3. Generate findings for issues found

Search query generation:
- Extract subject + verb + object from claim
- Add domain context
- Example: "RNA sequencing best practices 2024" for a methods claim

Finding requirements:
- Include Perplexity citations in finding metadata
- Confidence based on source quality
- Only flag if multiple sources contradict or strong evidence of error
```
</details>

---

## Phase 5: Orchestration 🔴

**Status**: Sequential — needs Phase 4
**Estimate**: ~2 days

### 5.1 Agent Orchestrator

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/services/orchestrator.py

Coordinates agent execution with proper concurrency.

Requirements:

1. Execution order (respecting dependencies):
   ```
   Phase 1: Context Builder + Domain Validator (parallel)
   Phase 2: Clarity Inspector + Rigor Detection (parallel, after Context ready)
   Phase 3: Rigor Revision + Adversarial Critic (parallel, after Phase 2)
   Phase 4: Synthesis (after all agents complete)
   ```

2. Concurrency control:
   - Max concurrent agents: configurable (default 4)
   - Use asyncio.Semaphore

3. Event emission:
   - Emit phase_started at beginning of each phase
   - Emit agent_started when agent begins
   - Emit finding_discovered for each finding (in real-time if possible)
   - Emit agent_completed when agent finishes
   - Emit phase_completed at end of each phase
   - Emit review_completed at end

4. Error handling:
   - If agent fails, log error and continue with others
   - Emit error event
   - Mark agent_status as failed
   - Continue synthesis with available findings

5. Interface:
```python
class Orchestrator:
    async def run_review(
        self,
        job_id: str,
        doc: DocObj,
        config: ReviewConfig,
        event_callback: Callable[[BaseEvent], Awaitable[None]],
    ) -> list[Finding]:
        ...
```

6. Context passing:
   - Context Builder produces ContextSnapshot
   - Pass snapshot to all other agents
```
</details>

### 5.2 Synthesis Engine

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create apps/api/src/services/synthesis.py

Non-LLM engine that merges and normalizes findings.

Requirements:

1. Deduplication:
   - Same anchor + same category → merge into one finding
   - Keep higher confidence version
   - Combine descriptions if meaningfully different

2. Overlap handling:
   - Findings with overlapping anchors (same paragraph, overlapping char ranges)
   - If same category: merge
   - If different categories: keep both, link in metadata

3. Severity normalization:
   - If multiple agents flagged same text:
     - Upgrade severity if > 2 agents agree
     - Add confidence boost

4. Rubric computation:
   - Generate summary statistics:
     - Findings by category
     - Findings by severity
     - Coverage by section
   - Store in review job metadata

5. Sorting:
   - Sort findings by: severity (desc), then paragraph order (asc)
   - Critical issues at top, in document order

6. Interface:
```python
def synthesize_findings(
    findings: list[Finding],
    doc: DocObj,
) -> tuple[list[Finding], SynthesisSummary]:
    ...

class SynthesisSummary(BaseModel):
    total_findings: int
    by_severity: dict[Severity, int]
    by_category: dict[FindingCategory, int]
    by_section: dict[str, int]
    coverage_score: float  # % of paragraphs with findings
```
```
</details>

### 5.3 Process Screen Live Updates

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Complete apps/web/src/screens/ProcessScreen.tsx with SSE integration.

Create apps/web/src/hooks/useSSE.ts:

```typescript
function useSSE(url: string): {
  events: SSEEvent[];
  status: 'connecting' | 'connected' | 'closed' | 'error';
  error: Error | null;
}
```

Requirements:

1. SSE connection:
   - Connect to /review/{id}/events on mount
   - Parse events into typed objects
   - Reconnect on disconnect (with backoff)

2. Process screen updates:
   - Update phase progress bar on phase events
   - Update agent status list on agent events
   - Add findings to live list on finding_discovered
   - Navigate to /review on review_completed

3. Visual feedback:
   - Agents pulse while running
   - Check mark when complete
   - Finding cards fade in as discovered

4. Error handling:
   - Show error message if error event received
   - If recoverable: show "Retrying..."
   - If not recoverable: show error + "Go Back" button

5. Cancel functionality:
   - POST /review/{id}/cancel (implement endpoint)
   - Confirm dialog
   - Navigate to /upload on cancel
```
</details>

### 5.4 Wire Up Review Endpoints

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Complete the review lifecycle endpoints in apps/api/src/routers/review.py

POST /review/start:
1. Validate request
2. Get document from JobManager
3. Create ReviewJob
4. Start orchestrator in background task
5. Return job ID immediately

Background task:
```python
async def run_review_task(job_id: str, doc: DocObj, config: ReviewConfig):
    orchestrator = Orchestrator(...)
    
    async def emit_event(event: BaseEvent):
        await broadcaster.publish(job_id, event)
        await job_manager.update_from_event(job_id, event)
    
    try:
        findings = await orchestrator.run_review(job_id, doc, config, emit_event)
        await job_manager.complete_job(job_id, findings)
    except Exception as e:
        await job_manager.fail_job(job_id, str(e))
        await emit_event(ErrorEvent(message=str(e), recoverable=False))
```

GET /review/{id}/result:
1. Get job from JobManager
2. If not completed, return 202 with current status
3. If completed, return full result with findings

GET /review/{id}/events:
Already implemented in Phase 1

POST /review/{id}/cancel:
1. Set flag in job
2. Orchestrator checks flag between agents
3. Return 200
```
</details>

---

## Phase 6: Integration & Polish 🔴

**Status**: Sequential — needs Phase 5
**Estimate**: ~2 days

### 6.1 End-to-End Testing

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Create comprehensive integration tests.

apps/api/tests/integration/test_full_flow.py:

1. Test: Upload DOCX → Parse → Start Review → Get Results
2. Test: Upload PDF → Parse → Verify bounding boxes
3. Test: Full agent pipeline with mock LLM responses
4. Test: Export with track changes
5. Test: SSE event stream

apps/web/src/__tests__/e2e/:

Using Playwright or similar:
1. Test: Demo mode full flow
2. Test: Dynamic mode full flow (with MSW mocks)
3. Test: Filter interactions
4. Test: Accept/dismiss flow
5. Test: Export download

Create fixtures for tests:
- Mock LLM responses for each agent
- Sample documents
- Expected findings
```
</details>

### 6.2 Error Handling & Recovery

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Add comprehensive error handling throughout the application.

Backend:
1. Global exception handler in FastAPI
2. Structured error responses:
   ```python
   class APIError(BaseModel):
       error: str
       code: str
       details: dict | None
   ```
3. Graceful degradation:
   - If one agent fails, continue with others
   - If Perplexity unavailable, skip domain validation
   - If export fails, return original document

Frontend:
1. Error boundary component
2. Toast notifications for errors
3. Retry buttons where appropriate
4. Clear error messages (not stack traces)

Specific cases:
- File too large: Show size warning, allow override
- Parse failure: Show specific error, suggest file fixes
- Agent timeout: Show partial results, mark as incomplete
- Export failure: Offer to download decisions as JSON
```
</details>

### 6.3 Performance Optimization

<details>
<summary><strong>Claude Code Prompt</strong></summary>

```
Optimize performance for large documents.

Backend:
1. Document chunking:
   - If doc > 30 pages, process in chunks
   - Parallel chunk processing for clarity inspector
   
2. Caching:
   - Cache parsed DocObj for session
   - Cache ContextSnapshot for agent reuse

3. Token management:
   - Track token usage per agent
   - Warn if approaching limits
   - Truncate intelligently (keep key sections)

Frontend:
1. Document viewer virtualization:
   - Only render visible paragraphs
   - Use react-window or similar

2. Finding list pagination:
   - Show 20 at a time
   - Load more on scroll

3. Lazy loading:
   - Don't load full findings until needed
   - Progressive enhancement

Metrics:
- Add timing logs for each phase
- Track LLM latency
- Monitor memory usage
```
</details>

---

## ✅ STANDARD REVIEW COMPLETE

At this point, the full standard review pipeline works:
- Real document parsing
- All agents running
- Live progress updates
- Full adjudication workflow
- Export with track changes

---

## Phase 7: Deep Review Tier (Future)

This phase adds enhanced capabilities for deep review mode.

### 7.1 Model Upgrades

- Switch Clarity to Sonnet
- Switch all others to Opus
- Add configuration for model overrides

### 7.2 Cross-Model Consensus

- Run key analyses on multiple models
- Compare outputs
- Flag disagreements
- Boost confidence on agreement

### 7.3 Section Expansion

- Allow drilling into specific sections
- More granular agent passes
- Deeper analysis of problem areas

---

## Parallelization Summary

```
PHASE 0 ──────────► [BLOCKS ALL]
         │
         ▼
PHASE 1 ─┬─► Stream A (Parsers)     ─┐
         ├─► Stream B (Frontend)     ├──► PHASE 2
         └─► Stream C (Backend)     ─┘
                                     │
PHASE 2 ─┬─► Stream A (Fixtures)    ─┤
         └─► Stream B (Review UI)   ─┘
                                     │
PHASE 3 ──────────────────────────────► [DEMO COMPLETE]
                                     │
PHASE 4 ─┬─► Context Agent          ─┐
         ├─► Clarity Agent           │
         ├─► Rigor Agent            ─┼──► PHASE 5
         ├─► Adversarial Agent       │
         └─► Domain Agent           ─┘
                                     │
PHASE 5 ──────────────────────────────► [ORCHESTRATION]
                                     │
PHASE 6 ──────────────────────────────► [STANDARD COMPLETE]
```

## Time Estimates (Solo Developer)

| Phase | Estimate | Cumulative |
|-------|----------|------------|
| Phase 0 | 4 hours | 4 hours |
| Phase 1 | 2-3 days | 3 days |
| Phase 2 | 2 days | 5 days |
| Phase 3 | 1-2 days | 6-7 days |
| Phase 4 | 3-4 days | 10-11 days |
| Phase 5 | 2 days | 12-13 days |
| Phase 6 | 2 days | 14-15 days |

With parallelization (multiple developers), Phases 1, 2, and 4 can be compressed significantly.
