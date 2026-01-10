# CLAUDE.md - AI Coding Assistant Instructions

This file provides context and guidelines for AI coding assistants working on the ZORRO Review System.

## Project Summary

ZORRO is an automated document review system that runs multiple AI agents to analyze manuscripts and grant applications. It produces text-anchored findings that users can accept, dismiss, or edit before exporting documents with tracked changes.

## Critical Concepts

### DocObj (Document Object)
The **immutable, indexed representation** of a parsed document. This is the spine of the entire system.

```typescript
// Once created, DocObj NEVER changes
// All agents READ from it
// All findings REFERENCE it by stable IDs
interface DocObj {
  id: string;                    // UUID, stable forever
  filename: string;
  type: 'pdf' | 'docx';
  title: string;
  sections: Section[];
  paragraphs: Paragraph[];
  figures: Figure[];
  metadata: DocumentMetadata;
  createdAt: string;
}

interface Paragraph {
  id: string;                    // e.g., "p_001"
  sectionId: string;
  index: number;
  text: string;
  sentences: Sentence[];
  boundingBox?: BoundingBox;     // For PDF export mapping
}

interface Sentence {
  id: string;                    // e.g., "p_001_s_002"
  paragraphId: string;
  index: number;
  text: string;
  startChar: number;
  endChar: number;
}
```

### Finding Anchors
Every finding MUST reference specific text via anchors:
```typescript
interface Finding {
  id: string;
  agentId: string;
  category: FindingCategory;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  confidence: number;            // 0-1
  title: string;
  description: string;
  anchors: Anchor[];             // REQUIRED - must have at least one
  proposedEdit?: ProposedEdit;
}

interface Anchor {
  paragraphId: string;
  sentenceId?: string;
  startChar?: number;
  endChar?: number;
  quotedText: string;            // The actual text being referenced
}
```

### Demo Mode vs Dynamic Mode
- **Demo Mode**: Skips all API calls, uses fixtures from `frontend/src/fixtures/`
- **Dynamic Mode**: Runs live agents

The toggle is on the Setup screen. Demo mode goes directly to Review screen with pre-built findings.

## File Structure Conventions

### Frontend (`frontend/`)
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Primitive components (Button, Input, etc.)
│   └── domain/         # Domain-specific (FindingCard, DocumentViewer)
├── screens/            # Route-level components
│   ├── UploadScreen.tsx
│   ├── SetupScreen.tsx
│   ├── ProcessScreen.tsx
│   ├── ReviewScreen.tsx
│   └── ExportScreen.tsx
├── hooks/              # Custom React hooks
│   ├── useSSE.ts       # Server-sent events
│   └── useReview.ts    # Review state management
├── services/           # API calls
│   └── api.ts
├── types/              # TypeScript types (mirror DATA_CONTRACTS.md)
│   └── index.ts
├── fixtures/           # Demo mode data
│   ├── documents/      # Sample DocObj instances
│   └── findings/       # Pre-built findings for each demo doc
└── lib/                # Utilities
```

### Backend (`backend/`)
```
app/
├── main.py             # FastAPI app entry
├── config/             # Settings and env vars
├── api/routes/         # API routes
│   └── review.py
├── services/           # Business logic
│   ├── orchestrator.py # Agent coordination
│   └── assembler.py    # Finding dedup/merge
├── agents/             # Individual agents
│   ├── base.py         # Abstract agent class
│   ├── briefing.py     # Briefing Agent
│   ├── clarity.py      # Clarity Inspector
│   ├── rigor/          # Rigor (finder + rewriter)
│   ├── adversary/      # Adversarial Critic
│   └── domain/         # Domain Validator (Perplexity)
├── parsers/            # Document parsing
│   ├── base.py
│   ├── docx_parser.py  # python-docx
│   └── pdf_parser.py   # PyMuPDF
├── models/             # Pydantic models (source of truth)
│   ├── document.py     # DocObj, Paragraph, etc.
│   ├── finding.py      # Finding, Anchor, etc.
│   ├── review.py       # ReviewConfig, ReviewJob
│   └── events.py       # SSE event types
├── core/               # Infrastructure
│   ├── llm.py          # LLM client wrapper
│   └── perplexity.py   # Perplexity client
└── composer/           # Prompt management
    ├── library.py      # Prompt templates
    └── builder.py      # Prompt composition
```

## Coding Standards

### Python (Backend)
```python
# Use Pydantic v2 for all models
from pydantic import BaseModel, Field

class Finding(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: str
    category: FindingCategory
    # ... all fields with type hints

# Use async everywhere
async def analyze_document(doc: DocObj) -> list[Finding]:
    ...

# Structured outputs from LLMs
response = await client.messages.create(
    model="claude-sonnet-4-20250514",
    messages=[...],
    response_format={"type": "json_object"}  # Force JSON
)
```

### TypeScript (Frontend)
```typescript
// Types match Pydantic models exactly
// See docs/DATA_CONTRACTS.md for source of truth

// Use React Query for server state
const { data, isLoading } = useQuery({
  queryKey: ['review', reviewId],
  queryFn: () => api.getReviewResult(reviewId),
});

// SSE hook for live updates
const { events } = useSSE(`/review/${reviewId}/events`);
```

### Logging
```python
# Use structured logging everywhere
import structlog
logger = structlog.get_logger()

logger.info("agent_started", agent="clarity", doc_id=doc.id)
logger.info("finding_created", finding_id=f.id, severity=f.severity)
```

## Key Behaviors

### Agent Independence
- Agents NEVER share state directly
- Each agent receives DocObj and returns list[Finding]
- Orchestrator manages execution order and parallelism

### Finding Deduplication
The Synthesis Engine (non-LLM) handles:
- Same text, different agents → merge if same category
- Overlapping anchors → keep higher confidence
- Conflicting suggestions → keep both, flag for user

### SSE Event Types
```python
class EventType(str, Enum):
    PHASE_STARTED = "phase_started"
    PHASE_COMPLETED = "phase_completed"
    AGENT_STARTED = "agent_started"
    AGENT_COMPLETED = "agent_completed"
    FINDING_DISCOVERED = "finding_discovered"
    REVIEW_COMPLETED = "review_completed"
    ERROR = "error"
```

## Common Tasks

### Adding a New Agent
1. Create `backend/app/agents/new_agent.py`
2. Extend `BaseAgent` class
3. Implement `async def analyze(self, doc: DocObj, config: ReviewConfig) -> list[Finding]`
4. Register in `orchestrator.py`
5. Add tests in `backend/tests/agents/test_new_agent.py`
6. Add prompt to `docs/PROMPTS.md`

### Adding a New Finding Category
1. Add to `FindingCategory` enum in `backend/app/models/finding.py`
2. Add to TypeScript types in `frontend/src/types/index.ts`
3. Add filter option in `ReviewScreen.tsx`
4. Add color/icon mapping in `FindingCard.tsx`

### Modifying DocObj Structure
**WARNING**: DocObj is immutable by design. Changes affect:
- All parsers
- All agents
- All findings (anchor references)
- Export logic
- Demo fixtures

If you must change it:
1. Update `docs/DATA_CONTRACTS.md` first
2. Update Pydantic model
3. Regenerate TypeScript types
4. Update all parsers
5. Update all demo fixtures
6. Run full test suite

## Testing Commands

```bash
# Backend
cd backend
pytest                          # All tests
pytest tests/parsers/           # Parser tests
pytest tests/agents/            # Agent tests
pytest -k "test_docx"          # Pattern match

# Frontend
cd frontend
npm test                        # All tests
npm test -- --watch            # Watch mode
```

## Environment Setup

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...

# Optional
LOG_LEVEL=DEBUG                 # DEBUG, INFO, WARNING, ERROR
DEMO_MODE_DEFAULT=true          # Start in demo mode
MAX_CONCURRENT_AGENTS=4         # Parallel agent limit
```

## Don't Do These Things

1. **Don't modify DocObj after creation** — It's immutable by design
2. **Don't create findings without anchors** — Every finding needs text references
3. **Don't call APIs in demo mode** — Check the mode flag
4. **Don't skip structured outputs** — Always use Pydantic for LLM responses
5. **Don't log sensitive content** — No document text in logs
6. **Don't block on agents** — Everything is async

## Reference Documents

- `docs/DATA_CONTRACTS.md` — All types (source of truth)
- `docs/API_CONTRACTS.md` — Endpoint specifications
- `docs/BEHAVIORS.md` — Agent behavior specs
- `docs/PROMPTS.md` — All LLM prompts
- `docs/TESTING.md` — Testing philosophy
- `docs/LOGGING.md` — Logging standards
- `BUILD_PHASES.md` — Build plan with prompts
