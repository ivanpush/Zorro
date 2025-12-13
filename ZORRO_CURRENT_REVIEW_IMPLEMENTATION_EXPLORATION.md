# ZORRO Current Review Implementation - Complete Exploration
**Date**: 2024-12-12
**Status**: Exploration Complete - Ready for Panel Review Mode Implementation

---

## Executive Summary

The ZORRO Review System is a sophisticated document analysis platform with:
- **5 Independent AI agents** (Context Builder, Clarity Inspector, Rigor Inspector, Adversarial Critic, Domain Validator)
- **2 Review modes**: Demo (static fixtures) and Dynamic (live API processing)
- **2 Review depths**: Standard and Deep tier configurations
- **UI-driven review workflow**: Upload → Setup → Process → Review
- **Immutable DocObj design**: Documents parsed once, referenced immutably by all agents

**Current State**: System is designed for **single-reviewer operation**. There is **no multi-reviewer or panel review capability**.

The system is well-structured for adding reviewer-level configuration. The review depth concept ("one-pass" vs "interactive") suggests future checkpoint patterns but currently doesn't implement them.

---

## Part 1: Current Review Configuration

### 1.1 ReviewConfig Data Structure

**Location**: `DATA_CONTRACTS.md` (source of truth), implemented in:
- Backend: Would be in `apps/api/src/models/review.py` (backend is empty stub)
- Frontend: `/Users/ivanforcytebio/Projects/Zorro/frontend/src/types/index.ts` lines 168-183

```typescript
export interface ReviewConfig {
  tier: 'standard' | 'deep';                // Deep uses Opus, standard uses Sonnet
  focusDimensions: FocusDimension[];        // argumentation|methodology|clarity|completeness
  domainHint?: string;                      // Domain context for agents
  steeringMemo?: string;                    // Custom instructions from setup chat
  
  // Feature flags
  enableAdversarial: boolean;               // Run adversarial critic
  enableDomainValidation: boolean;          // Run domain validator
}

export type FocusDimension =
  | 'argumentation'
  | 'methodology'
  | 'clarity'
  | 'completeness';
```

**Key Gap**: No field for `reviewMode` or `reviewerType` exists. This is where we need to add reviewer configuration.

### 1.2 SetupScreen Flow (Frontend Configuration)

**File**: `/Users/ivanforcytebio/Projects/Zorro/frontend/src/screens/SetupScreen.tsx`

#### Current Configuration Elements:

1. **Document Classification** (lines 103-144)
   - Type selector: research-article, grant-proposal, thesis-chapter, review-article
   - Auto-detects based on metadata

2. **Review Directive** (lines 147-164)
   - Textarea for custom instructions
   - Maps to `steeringMemo` in ReviewConfig

3. **Focus Pills** (lines 167-187)
   - Hard-coded 5 options: Methods rigor, Statistics, Novelty, Desk-reject risk, Reproducibility
   - Currently selected but not actually used in config (bug or incomplete feature)

4. **Review Mode - CRITICAL ASYMMETRIC CARDS** (lines 189-237)
   ```
   ┌─────────────────┬──────────────────┐
   │ ONE-PASS REVIEW │ YOU-IN-THE-LOOP  │
   │ (Premium)       │ (Lighter Touch)  │
   │ Autonomous      │ Interactive      │
   │ Final Verdict   │ Checkpoints      │
   └─────────────────┴──────────────────┘
   ```
   - Labeled as `reviewDepth` in code
   - Maps to: `tier: 'deep'` if 'one-pass', `tier: 'standard'` if 'interactive'
   - These are **tier, not reviewer**, configurations

5. **Mode Toggle** (lines 268-292)
   - Demo vs Dynamic toggle
   - Determines whether to run actual agents or load fixtures
   - Sets `reviewMode: 'demo' | 'dynamic'`

#### Handler Logic (lines 73-94):
```typescript
const handleInitiateReview = () => {
  // Maps "one-pass" → tier: 'deep' with adversarial enabled
  // Maps "interactive" → tier: 'standard'
  // No reviewer selection - directly to process or review
}
```

**Key Observation**: The UI structure suggests placeholder for reviewer selection (the asymmetric card layout pattern) but current implementation is about review tier, not reviewer type.

### 1.3 ReviewConfig Assignment

**Store**: `/Users/ivanforcytebio/Projects/Zorro/frontend/src/store/index.ts` (lines 22-23, 67)

```typescript
reviewConfig: ReviewConfig | null;
setReviewConfig: (config: ReviewConfig | null) => void;
```

The config is stored once and never changes after initial setup.

---

## Part 2: Review Execution Flow

### 2.1 Navigation Flow

**File**: `/Users/ivanforcytebio/Projects/Zorro/frontend/src/App.tsx`

```
/ → /upload → /setup → /process → /review
                ↓
         (if demo mode)
              ↓
         /review (skip process)
```

### 2.2 Processing Stages

#### ProcessScreen (Dynamic Mode)
**File**: `/Users/ivanforcytebio/Projects/Zorro/frontend/src/screens/ProcessScreen.tsx`

Displays 4 sequential phases:
1. **Parsing** - Document parsing
2. **Context** - Context Builder runs
3. **Analysis** - Clarity Inspector, Rigor Inspector, Adversarial Critic run in parallel
4. **Synthesis** - Deduplication and merging of findings

**Review Mode Decision** (line 44):
```typescript
if (reviewMode === 'demo') {
  // Load from fixtures, skip to review screen
} else {
  // Would connect to SSE for real processing
  navigate('/review');
}
```

### 2.3 ReviewJob Data Structure

**Location**: `DATA_CONTRACTS.md` lines 438-506

```typescript
export interface ReviewJob {
  id: string;
  documentId: string;
  config: ReviewConfig;              // ← This is the configuration
  status: ReviewStatus;              // pending|parsing|analyzing|synthesizing|completed|failed
  
  currentPhase?: string;
  agentStatuses: Record<AgentId, AgentStatus>;
  
  findings: Finding[];               // All findings produced
  
  startedAt: string;
  completedAt?: string;
  error?: string;
}
```

**Key Insight**: `ReviewJob` ties configuration to a single execution. There's no multi-execution concept.

### 2.4 Agent Execution (Single Pass)

**Reference**: `ARCHITECTURE.md` lines 56-99, `BEHAVIORS.md`

Agents execute in phases:

**Phase 1: Briefing**
- Context Builder extracts: claims, scope, limitations, methodology, domain keywords

**Phase 2: Analysis (Parallel)**
- Clarity Inspector (Track A) - Local and global readability
- Rigor Inspector (Track B) - Methodology, logic, evidence, statistics
- Domain Validator (Track C) - External searches, fact-checking

**Phase 3: Post-Analysis**
- Adversarial Critic - Argument teardown, gaps

**Phase 4: Assembly**
- Synthesis Engine - Deterministic deduplication and merging
- No multi-reviewer consensus logic

---

## Part 3: Review Findings System

### 3.1 Finding Structure

**Location**: `/Users/ivanforcytebio/Projects/Zorro/frontend/src/types/index.ts` lines 102-162

```typescript
export interface Finding {
  id: string;                       // UUID
  agentId: AgentId;                 // Who created it
  category: FindingCategory;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  confidence: number;               // 0.0-1.0
  
  title: string;
  description: string;
  
  anchors: Anchor[];                // REQUIRED: text references
  proposedEdit?: ProposedEdit;
  metadata?: Record<string, unknown>;
  
  createdAt: string;
}

export type AgentId =
  | 'context_builder'
  | 'clarity_inspector'
  | 'rigor_inspector'
  | 'adversarial_critic'
  | 'domain_validator';
```

**Key Design**: Findings are attributed to agents, NOT to reviewers. There's no `reviewerId` field.

### 3.2 Finding Categories (15 total)

Organized into 5 groups:
- **Clarity** (4): sentence, paragraph, section, flow
- **Rigor** (4): methodology, logic, evidence, statistics
- **Scope** (3): overclaim, underclaim, missing
- **Domain** (3): convention, terminology, factual
- **Adversarial** (3): weakness, gap, alternative

### 3.3 Decision System (User Actions)

**Location**: `DATA_CONTRACTS.md` lines 511-546

```typescript
export interface Decision {
  id: string;
  findingId: string;
  action: DecisionAction;
  
  finalText?: string;               // For 'accept_edit' with modifications
  timestamp: string;
}

export type DecisionAction =
  | 'accept'                        // Accept finding, no edit
  | 'accept_edit'                   // Accept proposed edit (possibly modified)
  | 'dismiss';                      // Reject finding
```

**Key Gap**: No `reviewerId` field. All decisions attributed to a single user.

### 3.4 ReviewScreen Workflow

**File**: `/Users/ivanforcytebio/Projects/Zorro/frontend/src/screens/ReviewScreen.tsx` lines 246-459

**Layout**: 70/30 split
- **Left (70%)**: DocumentViewer with highlighted findings
- **Right (30%)**: FindingCard list with filters

**Filters**:
```typescript
type FilterState = {
  severity: Severity | 'all';
  category: FindingCategory | 'all';
  status: 'pending' | 'accepted' | 'dismissed' | 'all';
};
```

**User Actions**:
- Accept finding → creates Decision with action='accept'
- Dismiss finding → creates Decision with action='dismiss'
- Accept with edit → creates Decision with action='accept_edit' + finalText
- Keyboard shortcuts: j/k (navigate), a (accept), d (dismiss)

**Export Trigger**:
```typescript
const hasCriticalPending = findings.some(
  (f) => f.severity === 'critical' && !decisions.has(f.id)
);
// Warns if critical findings not reviewed
```

---

## Part 4: State Management

### 4.1 Zustand Store

**File**: `/Users/ivanforcytebio/Projects/Zorro/frontend/src/store/index.ts`

```typescript
interface AppState {
  // Modes
  reviewMode: ReviewMode;           // 'demo' | 'dynamic'
  setReviewMode: (mode: ReviewMode) => void;

  // Document
  currentDocument: DocObj | null;
  setCurrentDocument: (doc: DocObj | null) => void;

  // Configuration
  reviewConfig: ReviewConfig | null;
  setReviewConfig: (config: ReviewConfig | null) => void;

  // Execution
  currentJob: ReviewJob | null;
  setCurrentJob: (job: ReviewJob | null) => void;

  // Results
  findings: Finding[];
  setFindings: (findings: Finding[]) => void;
  addFinding: (finding: Finding) => void;

  // User actions
  decisions: Map<string, Decision>;
  addDecision: (decision: Decision) => void;
  removeDecision: (findingId: string) => void;
  clearDecisions: () => void;

  // UI
  selectedFindingId: string | null;
  setSelectedFindingId: (id: string | null) => void;

  // Reset
  reset: () => void;
}
```

**Persistence**: Uses `zustand/middleware/persist`
- Persists: reviewMode, currentDocument, reviewConfig, findings, decisions
- Does NOT persist: selectedFindingId, currentJob

**Key Structure**: One document, one config, one set of findings, one set of decisions. No multiplicity.

---

## Part 5: Demo vs Dynamic Mode

### 5.1 Demo Mode (Fixtures-Based)

**Upload Demo Document** (UploadScreen.tsx lines 96-111):
```typescript
const handleDemoSelect = async (demoId: DemoDocumentId) => {
  reset();
  setReviewMode('demo');
  const [document, findings] = await Promise.all([
    loadDemoDocument(demoId),
    loadDemoFindings(demoId),
  ]);
  // Load both document and findings from fixtures
  navigate('/setup');
};
```

**Demo Fixtures** (services/fixtures.ts):
- `DEMO_DOCUMENTS` with 2 options:
  - 'manuscript_pdf': Full mechanobiology paper
  - 'simple_demo': Shorter example
- Loads from `/fixtures/*.json` and `/reviews/*.json`

**Setup → Review Skip** (ProcessScreen.tsx line 44-49):
```typescript
if (reviewMode === 'demo') {
  simulateProcessing();  // Show animated progress
  // → Navigate to review screen with fixtures
} else {
  navigate('/review');    // For dynamic, go to real processing
}
```

### 5.2 Dynamic Mode (Live Processing)

**Currently**: Would connect to SSE endpoint at `/review/{id}/events`

**Not Implemented**: Backend API, agent execution, database

---

## Part 6: Data Flow Architecture

### 6.1 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    UPLOAD SCREEN                            │
│  - File upload or demo selection                            │
│  - Parses document → DocObj                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    SETUP SCREEN                             │
│  - Document type, directive, focus, review mode             │
│  - Creates ReviewConfig:                                    │
│    { tier, focusDimensions, steeringMemo, feature flags }   │
│  - Toggle: Demo vs Dynamic                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    DEMO MODE              DYNAMIC MODE
    (skip ahead)              │
         │                    ▼
         │           ┌─────────────────────────┐
         │           │   PROCESS SCREEN (SSE)  │
         │           │  - Parsing              │
         │           │  - Agent execution      │
         │           │  - Synthesis            │
         │           └──────────┬──────────────┘
         │                      │
         └──────────┬───────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    REVIEW SCREEN                            │
│  - Document viewer + findings list                          │
│  - Filter findings                                          │
│  - Accept/Dismiss/Edit decisions                            │
│  - Decisions Map<findingId, Decision>                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPORT                                   │
│  - POST /export with decisions                              │
│  - Returns DOCX with tracked changes                        │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 State Transitions

```
Reset() → Upload() → Document() → Setup() → ReviewConfig()
  ↓         ↓            ↓           ↓            ↓
  ∅       DocObj        DocObj      DocObj      Config
                                       ↓            ↓
                                  Document   + ReviewConfig
                                       ↓            ↓
                            Process/Review Screen
                                       ↓
                                  Findings[]
                                       ↓
                                  Decisions Map
                                       ↓
                                     Export
```

---

## Part 7: Backend Structure (Currently Empty)

**Location**: `/Users/ivanforcytebio/Projects/Zorro/backend/` is empty

**Planned** (from BUILD_PHASES.md):
```
apps/api/
├── src/
│   ├── main.py                # FastAPI entry
│   ├── config.py              # Settings
│   ├── routers/               # API routes
│   │   ├── document.py        # POST /document/parse, GET /document/{id}
│   │   ├── review.py          # POST /review/start, GET /review/{id}/events, GET /review/{id}/result
│   │   └── export.py          # POST /export
│   ├── services/              # Business logic
│   │   ├── job_manager.py     # In-memory job state
│   │   ├── orchestrator.py    # Agent coordination
│   │   ├── synthesis.py       # Finding merge/dedup
│   │   └── parser_service.py  # Document parsing
│   ├── agents/                # Individual agents (5 total)
│   │   ├── base.py
│   │   ├── context.py
│   │   ├── clarity.py
│   │   ├── rigor.py
│   │   ├── adversarial.py
│   │   └── domain.py
│   ├── parsers/               # Document parsing
│   │   ├── docx_parser.py     # python-docx
│   │   └── pdf_parser.py      # PyMuPDF
│   ├── models/                # Pydantic models (source of truth)
│   │   ├── document.py
│   │   ├── finding.py
│   │   ├── review.py
│   │   ├── decision.py
│   │   └── events.py
│   ├── clients/               # External APIs
│   │   ├── anthropic.py       # Claude API
│   │   └── perplexity.py      # Perplexity search
│   └── export/                # Export generation
│       ├── docx_export.py
│       └── pdf_export.py
├── tests/
└── pyproject.toml
```

**Key Insight**: Backend is architecture-ready but unimplemented. APIs are stub contracts.

---

## Part 8: Critical Design Patterns for Panel Review

### 8.1 How Single-Reviewer Mode Currently Works

1. **Single ReviewConfig** per document
2. **One agent set execution** per ReviewJob
3. **One Findings list** (merged results from all agents)
4. **One Decisions map** (user review actions)
5. **Linear review process**: Read findings → Make decisions → Export

### 8.2 How Panel Review Would Need to Work

1. **ReviewConfig + ReviewerType** per document (NEW)
2. **Multiple ReviewJobs** (one per reviewer) OR single job with multiple decision sets
3. **One canonical Findings list** (shared) OR separate findings per reviewer
4. **Multiple Decisions maps** (one per reviewer) — KEY CHANGE
5. **Consensus mechanism**: 
   - How many reviewers must accept a finding?
   - How are conflicts resolved?
   - What is the "final" state?

### 8.3 Design Constraints

**Immutability**: DocObj never changes (good for consistency)
**Findings**: Should be shared (avoid duplicate processing) OR separate (allow different agent configs)?
**Decisions**: MUST be separate per reviewer (each person votes independently)
**Consensus**: Needs new business logic (not yet in system)

---

## Part 9: Storage & Persistence

### 9.1 Frontend Persistence

**Zustand persist middleware**:
- Stores in `localStorage` under key `'zorro-app-storage'`
- Persists: reviewMode, currentDocument, reviewConfig, findings, decisions
- Does NOT persist: selectedFindingId, currentJob

**Serialization**:
```typescript
// decisions is a Map<string, Decision>, stored as array of [key, value] tuples
onRehydrateStorage: () => (state) => {
  if (state && Array.isArray(state.decisions)) {
    state.decisions = new Map(state.decisions);
  }
};
```

### 9.2 Backend (Planned)

**job_manager.py**: In-memory job state (would need persistence in production)

---

## Part 10: Current Limitations & Gaps

### 10.1 Missing Features for Panel Review

| Feature | Current | Needed |
|---------|---------|--------|
| Reviewer identity | None | User selection, ID tracking |
| Multiple decision sets | Single map | One per reviewer |
| Consensus logic | N/A | Voting/merge rules |
| Reviewer-specific configs | None | Different prompts per reviewer? |
| Conflict resolution | N/A | UI for disagreements |
| Panel analytics | None | Agreement metrics, voting patterns |
| Reviewer assignment | N/A | Who reviews what? |
| Sequential vs parallel | N/A | Both needed? |

### 10.2 Existing Partial Patterns

1. **Review Depth** (one-pass vs interactive):
   - Asymmetric UI cards suggest future feature
   - Currently just affects `tier` and feature flags
   - Could be extended to "single reviewer" vs "panel lead" roles

2. **Focus Dimensions**:
   - Extracted from SetupScreen but not used
   - Could become per-reviewer specialization

3. **Agent Selection via Feature Flags**:
   - `enableAdversarial` and `enableDomainValidation`
   - Could be extended to per-reviewer agent selection

### 10.3 Code Quality Issues

1. **Focus pills in SetupScreen** (lines 168-187):
   - Selected but never used in ReviewConfig
   - Dead code or incomplete feature?

2. **ReviewMode vs ReviewTier confusion**:
   - `ReviewMode` = 'demo' | 'dynamic' (execution mode)
   - `ReviewTier` = 'standard' | 'deep' (agent model selection)
   - Need distinct terminology for "single reviewer vs panel"

3. **No reviewer field in Decision**:
   - Would need to add for multi-reviewer support

---

## Part 11: API Contracts Relevant to Panel Review

### 11.1 Current Endpoints (from API_CONTRACTS.md)

```
POST /document/parse              # Upload document
GET /document/{id}                # Retrieve document
POST /review/start                # Start review job
GET /review/{id}/events           # SSE stream
GET /review/{id}/result           # Get results
POST /review/{id}/cancel          # Cancel job
POST /export                      # Generate output
```

### 11.2 StartReviewRequest (POST /review/start)

**Current**:
```json
{
  "documentId": "doc_a1b2c3d4",
  "config": {
    "tier": "standard",
    "focusDimensions": [...],
    "domainHint": "biomedical",
    "steeringMemo": "...",
    "enableAdversarial": true,
    "enableDomainValidation": true
  }
}
```

**For Panel**: Would need:
```json
{
  "documentId": "doc_a1b2c3d4",
  "reviewMode": "single_reviewer" | "panel",  // NEW
  "panelSize": 3,                             // NEW (if panel)
  "config": {...},
  "reviewerIds": ["reviewer_1", "reviewer_2"]  // NEW (if panel)
}
```

### 11.3 ExportRequest (POST /export)

**Current**:
```json
{
  "documentId": "doc_a1b2c3d4",
  "decisions": [...],
  "format": "docx",
  "options": {
    "includeUnresolvedAsComments": true,
    "trackChangesAuthor": "ZORRO Review"
  }
}
```

**For Panel**: Would need:
```json
{
  "documentId": "doc_a1b2c3d4",
  "decisions": {...},           // Changed from array to map or nested
  "consensusThreshold": 0.66,   // NEW (if panel)
  "reviewMode": "panel",        // NEW
  ...
}
```

---

## Part 12: Frontend Component Hierarchy

### 12.1 Screen Components

```
App.tsx
├── Layout
└── Routes
    ├── /upload → UploadScreen.tsx
    │   - File drop zone
    │   - Demo selector dropdown
    │   - Navigate to /setup
    │
    ├── /setup → SetupScreen.tsx
    │   - Document class dropdown
    │   - Review directive textarea
    │   - Focus pills (unused)
    │   - Review mode cards (ASYMMETRIC)
    │   - Demo/Dynamic toggle
    │   - Navigate to /process (dynamic) or /review (demo)
    │
    ├── /process → ProcessScreen.tsx
    │   - Progress bar with 4 phases
    │   - Agent activity list
    │   - Live findings stream
    │   - SSE listening (not implemented)
    │   - Navigate to /review
    │
    └── /review → ReviewScreen.tsx
        - DocumentViewer (70%)
        - FindingCard list (30%)
        - Filter controls
        - Export dialog
```

### 12.2 Domain Components

```
components/domain/
├── DocumentViewer.tsx
│   - Displays DocObj
│   - Highlights paragraphs
│   - Shows finding anchors
│
└── FindingCard.tsx
    - Finding display
    - Decision buttons (Accept/Dismiss/Edit)
    - Edit modal

components/ui/
├── button.tsx        # Shadcn Button
├── badge.tsx         # Shadcn Badge
├── card.tsx          # Shadcn Card
├── progress.tsx      # Shadcn Progress
└── ...
```

### 12.3 Hooks

```
hooks/
├── useSSE.ts         # (mentioned in CLAUDE.md, not found)
└── useReview.ts      # (mentioned in CLAUDE.md, not found)
```

**Status**: These hooks are defined in CLAUDE.md but not found in actual codebase. May be placeholder documentation.

---

## Part 13: Type System Summary

### 13.1 Complete Type Tree

```
DocObj (root document)
├── sections: Section[]
├── paragraphs: Paragraph[]  ← Finding anchors reference these
│   ├── sentences: Sentence[]  ← Findings can reference sentences
├── figures: Figure[]
├── references: Reference[]
└── metadata: DocumentMetadata

Finding (agent output)
├── agentId: AgentId  ← 5 agent types, not reviewer types
├── category: FindingCategory  ← 15 categories
├── severity: Severity  ← 4 levels
├── confidence: number  ← 0.0-1.0
├── anchors: Anchor[]  ← Links to Paragraph/Sentence
│   ├── paragraphId: string  ← REQUIRED
│   ├── sentenceId?: string
│   └── quotedText: string  ← REQUIRED
├── proposedEdit?: ProposedEdit
│   ├── type: EditType  ← 4 types: replace|delete|insert_before|insert_after
│   ├── anchor: Anchor
│   └── newText?: string
└── metadata?: Record

Decision (user action)
├── findingId: string  ← Links finding
├── action: DecisionAction  ← accept|accept_edit|dismiss
└── finalText?: string  ← For accept_edit

ReviewConfig (setup choice)
├── tier: 'standard' | 'deep'
├── focusDimensions: FocusDimension[]
├── domainHint?: string
├── steeringMemo?: string
├── enableAdversarial: boolean
└── enableDomainValidation: boolean

ReviewJob (execution)
├── documentId: string
├── config: ReviewConfig
├── status: ReviewStatus  ← pending|parsing|analyzing|synthesizing|completed|failed
└── findings: Finding[]

ReviewSession (UI state)
├── documentId: string
├── document: DocObj
├── findings: Finding[]
├── decisions: Decision[]
└── derived stats
```

### 13.2 Missing Types for Panel Review

```
Reviewer
├── id: string
├── name: string
├── email: string
└── role: 'lead' | 'peer' | 'specialist'

ReviewerDecision extends Decision
├── reviewerId: string  ← NEW
└── ... (rest of Decision)

PanelReviewConfig extends ReviewConfig
├── reviewMode: 'single' | 'panel'  ← NEW
├── reviewers: Reviewer[]  ← NEW
├── consensusThreshold: number  ← NEW
└── ... (rest of ReviewConfig)

PanelReviewResult
├── findings: Finding[]
├── reviewerDecisions: Map<reviewerId, Map<findingId, ReviewerDecision>>  ← NEW
├── consensusVerdicts: Map<findingId, ConsensusDecision>  ← NEW
└── analytics: PanelAnalytics  ← NEW
```

---

## Part 14: Key Files Reference Map

### 14.1 Data Structure Definitions

| File | Purpose | Type | Lines |
|------|---------|------|-------|
| `DATA_CONTRACTS.md` | Python & TS schema (source of truth) | Markdown | 770 |
| `frontend/src/types/index.ts` | TypeScript types mirror | TypeScript | 406 |
| `API_CONTRACTS.md` | OpenAPI specifications | Markdown | 313 |

### 14.2 Frontend Screens

| File | Purpose | Type | Lines |
|------|---------|------|-------|
| `frontend/src/screens/UploadScreen.tsx` | File/demo upload | React | 180+ |
| `frontend/src/screens/SetupScreen.tsx` | Review config UI | React | 297 |
| `frontend/src/screens/ProcessScreen.tsx` | Live processing view | React | 305 |
| `frontend/src/screens/ReviewScreen.tsx` | Finding review UI | React | 460 |

### 14.3 State Management

| File | Purpose | Type | Lines |
|------|---------|------|-------|
| `frontend/src/store/index.ts` | Zustand store | TypeScript | 114 |
| `frontend/src/services/fixtures.ts` | Demo data loader | TypeScript | 300+ |

### 14.4 Components

| File | Purpose | Type | Lines |
|------|---------|------|-------|
| `frontend/src/components/Layout.tsx` | Page wrapper | React | ~ |
| `frontend/src/components/domain/FindingCard.tsx` | Finding UI | React | 200+ |
| `frontend/src/components/domain/DocumentViewer.tsx` | Document display | React | ~ |
| `frontend/src/components/ui/*.tsx` | Shadcn primitives | React | ~ |

### 14.5 Configuration & Architecture

| File | Purpose | Type | Lines |
|------|---------|------|-------|
| `BUILD_PHASES.md` | Phased implementation plan | Markdown | 550+ |
| `ARCHITECTURE.md` | System design | Markdown | 400+ |
| `BEHAVIORS.md` | Agent specifications | Markdown | 400+ |
| `PROMPTS.md` | LLM prompt templates | Markdown | 350+ |
| `TESTING.md` | Test strategy | Markdown | 400+ |
| `LOGGING.md` | Logging standards | Markdown | 300+ |
| `CLAUDE.md` | AI assistant instructions | Markdown | 200+ |

---

## Part 15: Implementation Readiness Assessment

### 15.1 What's Ready

✓ **Type System**: Complete and well-defined
✓ **UI Layout**: Already has asymmetric card pattern for mode selection
✓ **State Management**: Zustand store is flexible enough
✓ **Finding Anchoring**: Robust text reference system
✓ **Decision Recording**: Basic decision structure exists
✓ **API Contract Structure**: Defined (backend not implemented)

### 15.2 What Needs Building

✗ **Reviewer Identity**: No user/reviewer concept
✗ **Multiple Decision Sets**: Currently single Decision map
✗ **Consensus Logic**: Not present anywhere
✗ **Panel Analytics**: No metrics or voting displays
✗ **Conflict Resolution UI**: Doesn't exist
✗ **Reviewer Assignment**: Not in system
✗ **SSE Events for Panel**: Would need new event types

### 15.3 What Exists But Is Incomplete

~ **Review Modes**: SetupScreen has asymmetric cards but only configure tier
~ **Focus Dimensions**: Extracted from UI but not used in config
~ **Steering Memo**: Collected but not passed to agents (no backend)
~ **Demo vs Dynamic**: Toggle exists, but dynamic mode not implemented

---

## Part 16: Recommendation for Panel Review Implementation

### 16.1 Minimum Viable Panel (MVP)

**Scope**: Add "Single Reviewer vs Panel Review" mode to existing system

**Changes Required**:

1. **Data Contracts** (DATA_CONTRACTS.md + types/index.ts):
   - Add `ReviewMode` enum: 'single_reviewer' | 'panel'
   - Add `ReviewerRole` enum: 'lead' | 'peer'
   - Add `Reviewer` interface: id, name, email, role
   - Extend `Decision` with optional `reviewerId: string`
   - Create `PanelConfig` extending `ReviewConfig`
   - Create `ConsensusVerdict` type

2. **Frontend SetupScreen**:
   - **Replace asymmetric cards** (currently tier-based) with true mode selector
   - Add new section: "Review Type" (Single vs Panel)
   - If Panel:
     - Add reviewer count selector (2, 3, 5 reviewers)
     - Add reviewer list input/selection
     - Show reviewer roles

3. **Frontend ReviewScreen**:
   - **If single reviewer**: Current UI unchanged
   - **If panel**:
     - Show findings with "Reviewer Status" badge per reviewer
     - Add "Reviewer Votes" section showing who accepted/dismissed
     - Add consensus indicator (3/3 agree, 2/3 agree, etc.)
     - Decision panel: Single decision per finding, applies to ALL reviewers (or per-reviewer?)

4. **Store Changes** (store/index.ts):
   - Add `reviewMode: 'single' | 'panel'`
   - Add `reviewers: Reviewer[]`
   - Change `decisions` structure (or add `reviewerDecisions`)
   - Add `consensusVerdicts: Map<findingId, ConsensusDecision>`

5. **Backend (When Implemented)**:
   - Modify `/review/start` to accept `reviewMode` and `reviewers`
   - Change decision recording to track per-reviewer
   - Add consensus calculation logic
   - Add new SSE events for reviewer decisions

### 16.2 Design Decisions

**Question 1**: Does each reviewer see all findings or just their assigned ones?
- **Current**: All reviewers see all findings (simpler, more transparent)
- **Alternative**: Each reviewer assigned subset (more scalable)
- **Recommendation**: Start with all see all

**Question 2**: Are decisions per-reviewer or collective?
- **Option A**: Each reviewer decides independently, system calculates consensus
- **Option B**: Lead reviewer decides after seeing peer votes
- **Option C**: Real-time voting, consensus required before moving on
- **Recommendation**: Option A (most transparent, closest to current design)

**Question 3**: What happens if reviewers disagree?
- **Option A**: Keep both perspectives in export as comments
- **Option B**: Lead reviewer final say
- **Option C**: Show conflict and require resolution
- **Recommendation**: Option C (prevents bias, most valuable)

**Question 4**: Can different reviewers have different configs?
- **Current finding generation**: Shared across all
- **Recommendation**: No, keep findings shared, only decisions separate

### 16.3 Phase-in Strategy

**Phase 1** (MVP): Single & Panel modes, shared findings, per-reviewer decisions
**Phase 2**: Consensus verdicts, conflict display
**Phase 3**: Advanced: Reviewer specialization, custom agent configs per reviewer
**Phase 4**: Analytics: Voting patterns, agreement metrics, reviewer reliability

---

## Conclusion

The ZORRO Review System is architecturally sound for adding panel review capabilities. The immutable DocObj design, robust finding anchoring, and clean separation of concerns make it suitable for multi-reviewer operation.

**Key Integration Points**:
1. SetupScreen (mode selection) — ready for expansion
2. ReviewConfig (add reviewer list) — straightforward addition
3. Decision system (add reviewer ID) — minor type change
4. ReviewScreen (show votes) — UI enhancement
5. Backend coordination (when built) — will need consensus logic

**Estimated Effort**: 
- Frontend MVP: 2-3 days (mode selector, vote display, basic consensus)
- Backend MVP: 3-5 days (multi-reviewer orchestration, consensus calculation)
- Testing: 2-3 days
- **Total**: ~1 week for production-ready panel review mode

---

## Appendix: Quick Stats

**Project Structure**:
- Frontend: React + TypeScript + Tailwind + Zustand
- Backend: Python + FastAPI + Pydantic (not implemented)
- Documentation: 2000+ lines (well-written)
- Code: ~3000 lines (frontend-only, MVP state)

**Type Coverage**:
- 20 main interfaces/types
- 5 agent types
- 15 finding categories
- 4 severity levels
- 3 decision actions

**UI Screens**: 4 (Upload → Setup → Process → Review)

**Agent Concepts**: 5 sequential/parallel analysis agents

**Data Flow Stages**: Document → Parsing → Analysis → Synthesis → Review → Export

---

*Generated by codebase exploration on 2024-12-12*
