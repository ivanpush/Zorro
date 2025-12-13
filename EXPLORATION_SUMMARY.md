# ZORRO Review Implementation - Key Findings Summary

**Timestamp**: 2024-12-12
**Status**: Complete Exploration

---

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Frontend** | React + TypeScript + Tailwind + Zustand (fully implemented MVP) |
| **Backend** | Python FastAPI (structure planned, not implemented) |
| **Current Reviewers** | Single reviewer only - no multi-reviewer capability |
| **Type System** | Complete, well-designed (source of truth in DATA_CONTRACTS.md) |
| **Agents** | 5 independent AI agents (Context, Clarity, Rigor, Adversarial, Domain) |
| **Findings** | 15 categories, immutable anchoring, 4 severity levels |
| **UI Screens** | 4 (Upload → Setup → Process → Review) |
| **Decision System** | Single Decision map per user (no reviewer tracking) |

---

## Critical Files for Panel Review Integration

### Data Contracts (Source of Truth)
- **`DATA_CONTRACTS.md`** (770 lines) - Single source of truth for all types
  - ReviewConfig (lacks reviewer field)
  - Finding structure (tied to agents, not reviewers)
  - Decision structure (lacks reviewerId field)

### Frontend Type System
- **`frontend/src/types/index.ts`** (406 lines) - TypeScript types mirror Pydantic models
  - Already well-structured
  - Need to add: Reviewer, PanelConfig, ConsensusVerdict types

### UI Configuration
- **`frontend/src/screens/SetupScreen.tsx`** (297 lines) - Review configuration
  - Has asymmetric card pattern (suggests future feature)
  - Currently configures tier, not reviewer type
  - **This is where panel mode selector should go**

### Review Processing
- **`frontend/src/screens/ReviewScreen.tsx`** (460 lines) - Finding review UI
  - Single-user decision system
  - Needs enhancement for multi-reviewer voting display

### State Management
- **`frontend/src/store/index.ts`** (114 lines) - Zustand store
  - Single `decisions` Map (needs per-reviewer version)
  - Flexible enough for panel mode addition

---

## Key Design Insights

### 1. Why Panel Review is Hard Without Changes
- **Findings** are shared (generated once by agents)
- **Decisions** are singular (one map for one user)
- **Reviewer identity** doesn't exist in any type
- **Consensus logic** doesn't exist anywhere

### 2. Why It's Actually Feasible
- **DocObj immutability** ensures consistency across reviewers
- **Clean separation** between findings (agent output) and decisions (user input)
- **Type system is flexible** - just needs new fields/types
- **Store structure allows** Map/nested data for per-reviewer decisions

### 3. The "Focus Dimensions" Red Herring
- Extracted from UI in SetupScreen (lines 168-187)
- Selected by user but **never used** in ReviewConfig
- Either dead code or placeholder for future specialization

### 4. The Asymmetric Cards Pattern
- SetupScreen has visually distinct card layout (lines 189-237)
- **Currently configures review tier** (standard vs deep)
- **Perfect placeholder location** for panel mode selector
- UI/UX already suggests "primary" vs "secondary" options

---

## Minimum Changes for Panel Review MVP

### 1. Type System (1 file)
- **`DATA_CONTRACTS.md` & `frontend/src/types/index.ts`**
  - Add: `Reviewer`, `ReviewerRole` enum, `PanelConfig`
  - Extend: `Decision` with optional `reviewerId`
  - Create: `ConsensusVerdict` type

### 2. Frontend Setup (1 file)
- **`SetupScreen.tsx`**
  - Add "Review Type" section above current asymmetric cards
  - Single vs Panel toggle
  - If panel: reviewer selector/input

### 3. Frontend Review (1 file)
- **`ReviewScreen.tsx`**
  - Add conditional rendering for panel mode
  - Show reviewer vote badges
  - Consensus indicator

### 4. State Management (1 file)
- **`store/index.ts`**
  - Add `reviewMode: 'single' | 'panel'`
  - Change or extend `decisions` structure
  - Add `consensusVerdicts` map

### 5. Backend (When implemented - 3 files)
- New consensus logic in orchestrator
- SSE events for reviewer decisions
- Decision aggregation in export

---

## Current Implementation Status

### Fully Implemented
- ✓ Type system & contracts
- ✓ UI screens & navigation
- ✓ Finding display & filtering
- ✓ Single-user decision recording
- ✓ Demo mode with fixtures
- ✓ Document parsing (frontend)
- ✓ Export flow (stub)

### Partially Implemented
- ~ Focus dimensions (UI only, no backend use)
- ~ Review tier distinction (config exists, not all agent behaviors differ)
- ~ Demo vs Dynamic mode (toggle exists, SSE not implemented)

### Not Implemented
- ✗ Multi-reviewer support
- ✗ Consensus mechanisms
- ✗ Reviewer identity/tracking
- ✗ Backend API (stub contracts only)
- ✗ Agent execution
- ✗ Real document parsing
- ✗ Database/persistence

---

## Recommended Implementation Path

### Phase 1: Minimal Panel (2-3 days)
1. Add Reviewer types to contracts
2. Extend Decision with reviewerId
3. Add ReviewMode selector to SetupScreen
4. Modify ReviewScreen to show votes (simple badge display)
5. Store per-reviewer decisions in Zustand

### Phase 2: Consensus Display (1-2 days)
6. Add ConsensusVerdict type
7. Implement consensus calculation (simple majority)
8. Display consensus state in UI
9. Add conflict resolution UI (when reviewers disagree)

### Phase 3: Backend Integration (When available - 3-5 days)
10. Modify `/review/start` to accept panel config
11. Orchestrate multi-reviewer decision collection
12. Implement consensus logic on backend
13. New SSE events for reviewer votes
14. Export with consensus verdicts

### Phase 4: Advanced (Later)
15. Reviewer specialization (assign to categories)
16. Different agent configs per reviewer
17. Analytics: voting patterns, agreement metrics
18. Reviewer reliability scoring

---

## Files to Understand (in order)

1. **DATA_CONTRACTS.md** (start here - understand the types)
2. **frontend/src/types/index.ts** (see TypeScript mirror)
3. **frontend/src/store/index.ts** (understand state flow)
4. **frontend/src/screens/SetupScreen.tsx** (configuration entry point)
5. **frontend/src/screens/ReviewScreen.tsx** (where decisions happen)
6. **API_CONTRACTS.md** (understand request/response format)

---

## Code Quality Notes

### Issues Found
1. **Focus pills dead code** - SetupScreen lines 168-187 selected but never used
2. **ReviewMode terminology confusion** - 'demo'|'dynamic' vs 'standard'|'deep'
3. **Missing field in Decision** - No reviewer tracking
4. **Unused hooks** - useSSE.ts and useReview.ts mentioned in CLAUDE.md but not in codebase

### Good Patterns
1. **Immutable DocObj** - Ensures consistency
2. **Strong type system** - DATA_CONTRACTS.md as single source of truth
3. **Clean component hierarchy** - Screens → Components → Hooks → Store
4. **Separation of concerns** - Findings (agents) separate from Decisions (users)

---

## Integration Points for Panel Review

### UI Layer
- SetupScreen: Mode selection (replace asymmetric tier cards with review type)
- ReviewScreen: Vote display (add reviewer name badges, consensus indicator)

### State Layer
- Store: Per-reviewer decision tracking (new Map structure)
- Persistence: Extend localStorage serialization for new fields

### Type Layer
- Add 4 new types: Reviewer, PanelConfig, ConsensusVerdict, ReviewerDecision
- Extend 2 existing: Decision (add reviewerId), ReviewConfig (add panel fields)

### Business Logic (Backend)
- Orchestration: Collect per-reviewer decisions
- Consensus: Calculate agreement/disagreement
- Export: Incorporate verdicts into document

---

## Risk Assessment

### Low Risk
- Adding new types (backward compatible if optional)
- UI changes (SetupScreen, ReviewScreen isolated)
- State structure changes (Zustand is flexible)

### Medium Risk
- Changing Decision structure (might break existing logic)
- Consensus algorithm choice (different teams might disagree)
- Export format with panel verdicts (affects external integration)

### High Risk
- Backend orchestration (not yet built, complex coordination)
- Reviewer authentication (not in current scope)
- Database schema (not yet designed)

---

## Next Steps

1. **Read** the full exploration document: `ZORRO_CURRENT_REVIEW_IMPLEMENTATION_EXPLORATION.md`
2. **Review** DATA_CONTRACTS.md to understand current type system
3. **Decide** on design questions (consensus threshold, per-reviewer vs global decisions)
4. **Plan** which phase to implement first
5. **Begin** with type system changes (lowest risk, highest impact)

---

*For detailed analysis, see: ZORRO_CURRENT_REVIEW_IMPLEMENTATION_EXPLORATION.md*
