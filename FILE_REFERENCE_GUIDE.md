# ZORRO Codebase - Quick File Reference Guide

**Timestamp**: 2024-12-12

---

## File Locations (Absolute Paths)

### Root Documentation
```
/Users/ivanforcytebio/Projects/Zorro/DATA_CONTRACTS.md              # Type definitions (MASTER)
/Users/ivanforcytebio/Projects/Zorro/API_CONTRACTS.md               # API specifications
/Users/ivanforcytebio/Projects/Zorro/ARCHITECTURE.md                # System design
/Users/ivanforcytebio/Projects/Zorro/BEHAVIORS.md                   # Agent specifications
/Users/ivanforcytebio/Projects/Zorro/BUILD_PHASES.md                # Implementation plan
/Users/ivanforcytebio/Projects/Zorro/CLAUDE.md                      # AI assistant guidelines
/Users/ivanforcytebio/Projects/Zorro/PROMPTS.md                     # LLM prompts
/Users/ivanforcytebio/Projects/Zorro/TESTING.md                     # Testing strategy
/Users/ivanforcytebio/Projects/Zorro/LOGGING.md                     # Logging standards
/Users/ivanforcytebio/Projects/Zorro/README.md                      # Project overview
```

### Frontend Source Code
```
/Users/ivanforcytebio/Projects/Zorro/frontend/src/
├── App.tsx                                          # Main routing (22 lines)
├── main.tsx                                         # Entry point
├── types/
│   └── index.ts                                     # TYPE DEFINITIONS (406 lines) ***
├── store/
│   └── index.ts                                     # Zustand store (114 lines)
├── screens/
│   ├── UploadScreen.tsx                             # Upload/demo selection (180+ lines)
│   ├── SetupScreen.tsx                              # CONFIG UI (297 lines) ***
│   ├── ProcessScreen.tsx                            # Processing view (305 lines)
│   └── ReviewScreen.tsx                             # Review UI (460 lines) ***
├── services/
│   └── fixtures.ts                                  # Demo data loader (300+ lines)
├── components/
│   ├── Layout.tsx                                   # Page wrapper
│   ├── domain/
│   │   ├── DocumentViewer.tsx                       # Document display
│   │   └── FindingCard.tsx                          # Finding UI (200+ lines)
│   └── ui/
│       ├── button.tsx                               # Shadcn Button
│       ├── badge.tsx                                # Shadcn Badge
│       ├── card.tsx                                 # Shadcn Card
│       ├── progress.tsx                             # Shadcn Progress
│       └── [others]
├── hooks/
│   └── [hooks directory - mentioned but not found]
├── lib/
│   └── utils.ts                                     # Tailwind utility helpers
└── styles/
    └── [styles directory]
```

### Backend (Empty)
```
/Users/ivanforcytebio/Projects/Zorro/backend/                       # EMPTY - planned structure only
```

---

## Key Files by Purpose

### For Understanding Current Review System

| Task | File | Lines | Key Sections |
|------|------|-------|--------------|
| **Learn Type System** | `DATA_CONTRACTS.md` | 1-770 | All sections, especially ReviewConfig (394-436), Decision (511-546) |
| **See TypeScript Types** | `frontend/src/types/index.ts` | 1-406 | ReviewConfig (168-183), Decision (221-235) |
| **Understand Configuration** | `frontend/src/screens/SetupScreen.tsx` | 1-297 | Lines 73-94 (handler), 168-237 (mode cards) |
| **Review Decisions** | `frontend/src/screens/ReviewScreen.tsx` | 1-460 | Lines 103-141 (handlers), 336-375 (findings list) |
| **State Management** | `frontend/src/store/index.ts` | 1-114 | Lines 12-46 (interface), 48-113 (implementation) |
| **API Design** | `API_CONTRACTS.md` | 1-313 | Lines 140-169 (POST /review/start), 257-293 (POST /export) |

---

## Critical Line Numbers

### SetupScreen.tsx - Review Mode Configuration
```
Lines 7-8:        Import statement for ReviewMode type
Lines 18-27:      State management - currentDocument, setReviewConfig, setReviewMode
Lines 73-94:      handleInitiateReview() - maps UI to ReviewConfig
Lines 103-144:    Document classification section
Lines 147-164:    Review directive textarea (maps to steeringMemo)
Lines 168-187:    Focus pills (UNUSED - dead code?)
Lines 189-237:    Review mode asymmetric cards (TIER-BASED, not reviewer)
Lines 268-292:    Demo/Dynamic toggle
```

### ReviewScreen.tsx - Finding Review
```
Lines 9-16:       Type imports
Lines 20-27:      Store usage
Lines 29-33:      Filter state
Lines 48-77:      Filter findings logic
Lines 80-101:     Calculate stats
Lines 103-141:    Decision handlers (accept, dismiss, accept_edit)
Lines 143-180:    Export handler
Lines 182-239:    Keyboard shortcuts
Lines 246-459:    Render: DocumentViewer (70%) + FindingCard list (30%)
Lines 337-375:    Findings list rendering
```

### store/index.ts - State Structure
```
Lines 1-10:       Imports
Lines 12-46:      AppState interface definition
Lines 48-56:      Initial state
Lines 58-113:     Zustand store implementation
Lines 76-80:      Decision storage (Map<string, Decision>)
Lines 96-112:     Persistence middleware config
```

### types/index.ts - Type Definitions
```
Lines 1-25:       Document structures (DocObj, Section, Paragraph)
Lines 26-57:      More document structures (Sentence, etc.)
Lines 102-162:    Finding and Anchor definitions
Lines 168-183:    ReviewConfig (lacks reviewer field)
Lines 221-235:    Decision structure (lacks reviewerId field)
Lines 353-358:    FilterState for UI
Lines 360:        ReviewMode = 'demo' | 'dynamic'
Lines 383-399:    Constants (SEVERITY_LEVELS, CATEGORY_GROUPS)
```

### DATA_CONTRACTS.md - Master Reference
```
Lines 1-100:      Document structures (DocObj to Sentence)
Lines 231-389:    Finding structures and categories
Lines 392-506:    Review structures (ReviewConfig, ReviewJob, Decision)
Lines 509-672:    SSE events and export structures
Lines 712-770:    Demo fixtures and API structures
```

---

## Navigation Quick Links

### To Find...                                   | Look in...
- How reviews are configured                     | SetupScreen.tsx, ReviewConfig in types/index.ts
- How users record decisions                     | ReviewScreen.tsx (lines 103-141), Decision type
- How state persists                            | store/index.ts (lines 96-112)
- Finding categories & severities               | types/index.ts (lines 383-399, 393-399)
- Agent types                                   | types/index.ts (lines 121-126)
- How documents are structured                  | DATA_CONTRACTS.md (lines 14-54), DocObj in types
- Export requirements                           | API_CONTRACTS.md (lines 255-293), ExportRequest
- Demo data loading                             | services/fixtures.ts (lines 22-85)

---

## Code Snippets by Function

### Current Review Flow
```
Upload (file/demo)
  ↓
SetupScreen (creates ReviewConfig)
  ↓
ProcessScreen (if dynamic) or skips (if demo)
  ↓
ReviewScreen (display findings + decisions)
  ↓
Export (POST /export with decisions)
```

### Current Decision Recording
```typescript
// In ReviewScreen.tsx, lines 103-141
const handleAccept = (finding: Finding) => {
  const decision: Decision = {
    id: `decision_${Date.now()}`,
    findingId: finding.id,
    action: 'accept',
    timestamp: new Date().toISOString(),
  };
  addDecision(decision);  // → store/index.ts line 76
};
```

### Current State Structure
```typescript
// In store/index.ts, lines 12-46
interface AppState {
  reviewMode: ReviewMode;                    // 'demo' | 'dynamic'
  currentDocument: DocObj | null;
  reviewConfig: ReviewConfig | null;
  findings: Finding[];
  decisions: Map<string, Decision>;          // KEY: findingId, VALUE: Decision
  selectedFindingId: string | null;
}
```

---

## Type Definition Chain

```
ReviewConfig (types/index.ts:168-183)
  ├── tier: 'standard' | 'deep'
  ├── focusDimensions: FocusDimension[]
  ├── domainHint?: string
  ├── steeringMemo?: string
  ├── enableAdversarial: boolean
  └── enableDomainValidation: boolean

Finding (types/index.ts:102-162)
  ├── id: string
  ├── agentId: AgentId                     # 5 agents, no reviewer concept
  ├── category: FindingCategory            # 15 categories
  ├── severity: Severity                   # 4 levels
  ├── anchors: Anchor[]                    # Text references
  ├── proposedEdit?: ProposedEdit
  └── createdAt: string

Decision (types/index.ts:221-235)
  ├── id: string
  ├── findingId: string
  ├── action: DecisionAction               # 'accept' | 'accept_edit' | 'dismiss'
  ├── finalText?: string
  └── timestamp: string
  # MISSING: reviewerId!
```

---

## For Panel Review Implementation

### Start With These Files (in order):
1. **`DATA_CONTRACTS.md`** - Understand current types (770 lines)
2. **`frontend/src/types/index.ts`** - See TypeScript mirror (406 lines)
3. **`frontend/src/screens/SetupScreen.tsx`** - Where to add mode selector (297 lines)
4. **`frontend/src/screens/ReviewScreen.tsx`** - Where to show votes (460 lines)
5. **`frontend/src/store/index.ts`** - How to track per-reviewer decisions (114 lines)

### Modify These Files:
1. **`DATA_CONTRACTS.md`** - Add types for panel review
2. **`frontend/src/types/index.ts`** - Mirror the changes
3. **`frontend/src/screens/SetupScreen.tsx`** - Add panel mode selector
4. **`frontend/src/screens/ReviewScreen.tsx`** - Show reviewer votes
5. **`frontend/src/store/index.ts`** - Store per-reviewer decisions

---

## Project Statistics

| Metric | Count |
|--------|-------|
| Frontend screens | 4 |
| Agent types | 5 |
| Finding categories | 15 |
| Finding severity levels | 4 |
| Decision actions | 3 |
| Main documentation files | 9 |
| Frontend TypeScript files | 17 |
| Lines of frontend code | ~3000 |
| Lines of documentation | ~2000 |

---

## Important Notes

### Single Source of Truth
- **DATA_CONTRACTS.md** is the canonical source
- TypeScript types in `frontend/src/types/index.ts` must match exactly
- Backend Pydantic models (when implemented) must match exactly

### Backend Status
- **Currently**: Backend directory is empty
- **Planned**: FastAPI with 5 agent implementations
- **Relevant for Panel**: orchestrator.py would need consensus logic

### UI/UX Pattern
- SetupScreen uses **asymmetric cards** (lines 189-237)
- Perfect location for "Single Reviewer" vs "Panel Review" selector
- Currently used for review tier (standard vs deep), not reviewer type

---

## Git & File Management

**Note**: No git repo initialized in this directory
- All files are regular filesystem files
- Consider creating git repo before implementing changes
- Recommendation: Create branch `panel-review-implementation` before starting

---

*Generated from complete codebase exploration on 2024-12-12*
