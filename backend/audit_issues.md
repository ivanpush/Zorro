# Zorro Backend Audit Issues
**Created:** 2026-01-10
**Status:** In Progress

---

## CRITICAL: Output Model Mismatch

### 1. Finding vs IssueCard - Wrong Structure
**Backend (IssueCard):**
- `track: "A" | "B" | "C"` - Frontend REQUIRES this
- `dimensions: ["WQ", "AS", "CR"]` - Frontend uses for filtering
- `severity: "major" | "minor"`
- `source_agent: "clarity" | "rigor" | "adversary" | "domain"`
- `sentence_ids: list[str]` - For highlighting
- `suggested_rewrite, rationale` - Track A/B
- `critique, suggested_revision` - Track C

**Zorro (Finding):**
- `agent_id: str` - NOT track
- `anchors: list[Anchor]` - NOT sentence_ids
- `category: FindingCategory` - Different enum
- NO dimensions
- NO track mapping

**FIX:** Convert Finding → IssueCard format in assembler, or rewrite Finding model.

---

### 2. Assembler Missing Core Functionality
**Backend assembler produces:** `ReviewOutput` with summary, summary_stats, metadata
**Zorro assembler produces:** `list[Finding]` only

**MISSING:**
- [ ] `normalize_issues()` - ensures dimensions & source_agent
- [ ] `_filter_acknowledged()` - filters issues matching author's stated limitations
- [ ] `validate_issue_titles()` - fixes bad LLM titles
- [ ] `generate_summary()` - human-readable narrative
- [ ] `build_summary()` - structured stats
- [ ] `ReviewMetadata` generation with usage_stats
- [ ] Dimension merging when Track C replaces Track A

---

### 3. Orchestrator Returns Wrong Type
**Backend:** Returns `ReviewOutput`
**Zorro:** Returns `AsyncGenerator[SSEEvent]` - `ReviewCompletedEvent` only has findings + basic metrics

**MISSING:** Full `ReviewOutput` construction after assembler runs.

---

## CRITICAL: Frontend Compatibility Breaks

### 4. No Track Assignment
Frontend expects `track: "A" | "B" | "C"` for tab routing, styling, filters.
Zorro uses `agent_id` which doesn't map to tracks.

### 5. No Dimensions (WQ/AS/CR)
Frontend uses for summary bar chart, filter chips, priority scoring.

### 6. sentence_ids vs anchors
Frontend expects `sentence_ids: list[str]` for text highlighting.
Zorro uses `anchors: list[Anchor]`.

---

## CRITICAL: Performance Issues

### 7. LLM Client is FAKE ASYNC - ROOT CAUSE OF 83s DELAY
**Location:** `app/core/llm.py`

**THE BUG:**
```python
# Zorro (BROKEN)
from anthropic import Anthropic  # NO AsyncAnthropic!

self._anthropic = Anthropic(...)  # SYNC client
self._instructor = instructor.from_anthropic(self._anthropic)  # SYNC

async def call(...):  # Marked async BUT...
    response = self._instructor.messages.create(...)  # NO AWAIT! BLOCKING!
```

**Backend (CORRECT):**
```python
from anthropic import Anthropic, AsyncAnthropic

_async_client = AsyncAnthropic(...)  # ASYNC client
_async_instructor = instructor.from_anthropic(get_async_client())

async def llm_call(...):
    async with _semaphore:  # Concurrency limit (6 max)
        response = await client.messages.create(**kwargs)  # AWAIT!
```

**Impact:**
- `asyncio.gather()` in agents doesn't parallelize - each chunk blocks event loop
- 5 chunks × 15s = 75-90s sequential (should be ~15s parallel)
- All agents affected: Clarity, Rigor, Adversary, Domain

**FIX REQUIRED:**
1. Import `AsyncAnthropic` from anthropic
2. Create async client: `AsyncAnthropic(api_key=...)`
3. Wrap with instructor: `instructor.from_anthropic(async_client)`
4. Add `await` to `.messages.create()` call
5. Add semaphore for concurrency limiting

### 8. Missing Concurrency Limiting
Backend has: `_semaphore = asyncio.Semaphore(6)`
Zorro has: Nothing - would fire unlimited parallel calls once async fixed

### 9. Missing Prompt Caching
Backend splits prompts for Anthropic prompt caching:
```python
system_content = [{
    "type": "text",
    "text": static_part,
    "cache_control": {"type": "ephemeral"}
}]
```
Zorro: No prompt caching implementation

### 10. Almost No Logging Anywhere
**Backend:** 5,703 log statements across 252 files
**Zorro:** 19 log statements across 3 files

Zorro is running blind. Only has logging in:
- `orchestrator.py` - 13 calls (agent lifecycle)
- `parsers/*.py` - 6 calls

**ZERO logging in critical paths:**
```
app/core/llm.py          # NO LLM call visibility!
app/agents/*.py          # NO agent-level logging!
app/services/chunker.py  # NO chunk info!
app/services/assembler.py # NO dedup info!
app/composer/*.py        # NO prompt info!
```

**Can't see:**
- What model is being called
- Token counts per call
- Call duration
- Prompt sizes
- Error details
- Chunk processing status

**Files that need logging added:**
| File | What to Log |
|------|-------------|
| `app/core/llm.py` | Every LLM call: model, tokens, time, cost, agent_id |
| `app/agents/clarity.py` | Chunk start/end, findings count |
| `app/agents/rigor/finder.py` | Section start/end, findings count |
| `app/agents/adversary/*.py` | Mode (single/panel), model used |
| `app/services/chunker.py` | Chunk count, word counts, paragraph counts |
| `app/services/assembler.py` | Input count, output count, removed count |
| `app/composer/builder.py` | Prompt size, components included |

### Backend Logging Pattern (Reference)
Backend `services/pipeline.py` uses:
```python
# Console visibility (emoji + timing)
print(f"🚀 Starting PARALLEL: Clarity + Rigor...")
print(f"  ⏳ [CLARITY] Starting with {tier.upper()} tier...")
print(f"  ✅ [CLARITY] Done in {elapsed:.1f}s - {len(issues)} issues")

# Formal logging
logger.info(f"Filtered document: {before} → {after} sections")

# Debug dumps (optional)
_save_debug("03_clarity_issues", clarity_issues, debug_dir)
```

Backend also has `DEBUG_DUMP` mode that saves every intermediate result to JSON files for debugging.

---

## MAJOR: Missing Features

### 9. No Grounding Filter
Backend has `utils/grounding.py` - rejects hallucinated quotes.
Zorro has none.

### 10. Tier-Based Model Selection Not Used
Backend adapts model per tier (Haiku → Sonnet → Opus).
Zorro agents just use default client model.

### 11. Briefing Integration Incomplete
User steering/focus chips handling unclear.

### 12. Domain Agent Different
Backend domain contributes IssueCards (Track A).
Zorro domain only provides evidence to adversary.

### 13. Token Tracking Different
Backend: detailed per-agent stats
Zorro: basic cost/time aggregation

---

## MAJOR: Dedup Strategy Different

### 14. Dedup Logic Mismatch
**Backend:**
- Key = `frozenset(sentence_ids)`
- Track B exempt
- Track C wins over Track A (with dimension merge)

**Zorro:**
- Key = paragraph_id + text overlap
- Priority by agent_id number
- Winner takes all (no merge)

---

## WORKS CORRECTLY
- [x] SSE streaming architecture
- [x] Parallel agent execution (structure exists)
- [x] Basic chunking strategy
- [x] Rigor 2-phase (find→rewrite)
- [x] Adversary panel mode structure
- [x] camelCase serialization

---

## PRIORITY FIX ORDER

### PHASE 1: Make It Work (Performance)
1. **FIX LLM CLIENT** - Convert to truly async (`AsyncAnthropic` + `await`)
2. **Add semaphore** - Limit concurrent calls to 6
3. **Add LLM logging** - Visibility into what's happening

### PHASE 2: Make It Compatible (Frontend)
4. **Add Track + Dimensions to Finding** - Frontend tabs/filters break without
5. **Add sentence_ids extraction** - Highlighting broken
6. **Build ReviewOutput in assembler** - API response structure wrong

### PHASE 3: Make It Quality (Feature Parity)
7. **Add grounding filter** - Reject hallucinated quotes
8. **Add limitation filtering** - Don't flag author-acknowledged limitations
9. **Add summary/summary_stats generation** - Frontend needs these
10. **Align tier model selection** - Quick=Haiku, Standard=Sonnet, Deep=Opus
11. **Match dedup logic to backend** - Track B exempt, C wins over A

### PHASE 4: Polish
12. **Add prompt caching** - Cost savings
13. **Add title validation** - Fix bad LLM titles

---

## Investigation Notes

### Performance Deep Dive (2026-01-10)

**ROOT CAUSE FOUND:** `app/core/llm.py` uses sync Anthropic client

The LLM client is marked `async def` but makes BLOCKING synchronous calls:
- Uses `Anthropic()` instead of `AsyncAnthropic()`
- Uses `instructor.from_anthropic(sync_client)`
- Calls `.messages.create()` without `await`

**Result:** `asyncio.gather()` runs chunks sequentially, not in parallel.
- Expected: 5 chunks in ~15s (parallel)
- Actual: 5 chunks in ~75-90s (sequential)

**Additional missing from backend:**
- No `asyncio.Semaphore(6)` for concurrency limiting
- No prompt caching (cache_control headers)
- No LLM_DEBUG logging mode
- No cost calculation per call

### Files That Need Changes

**PHASE 1 (Critical - Performance):**
```
app/core/llm.py               # Convert to AsyncAnthropic + await + semaphore + logging
```

**PHASE 2 (Critical - Frontend Compatibility):**
```
app/models/finding.py         # Add track, dimensions, sentence_ids
app/services/assembler.py     # Build ReviewOutput, add all missing functions
app/models/review.py          # Add ReviewOutput, ReviewMetadata, ReviewSummary models
```

**PHASE 3 (Quality):**
```
app/utils/grounding.py        # NEW FILE - copy from backend/utils/grounding.py
app/utils/dimensions.py       # NEW FILE - copy from backend/utils/dimensions.py
```

### Quick Reference: Backend File Locations
```
backend/utils/llm_client.py   # Reference async implementation
backend/utils/grounding.py    # filter_ungrounded_issues()
backend/utils/dimensions.py   # get_dimensions()
backend/agents/assembler.py   # Full assembler with all functions
backend/models/issue.py       # IssueCard model
backend/models/output.py      # ReviewOutput, ReviewMetadata, ReviewSummary
```

---

## COMPREHENSIVE AUDIT (2026-01-10) - Multi-Agent Deep Dive

### NEW CRITICAL: Code Bugs That Will CRASH

#### 15. Parameter Name Bugs in Domain Agents
**Files:** `app/agents/domain/target_extractor.py`, `app/agents/domain/query_generator.py`

These agents have parameter name mismatches that will cause immediate crashes when called.

#### 16. Wrong Model Selection for Adversary
**File:** `app/config/models.py`

```python
# WRONG - Uses Haiku for adversary
"adversary": "claude-3-5-haiku-20241022"

# SHOULD BE - Backend uses Sonnet/Opus
"adversary": "claude-sonnet-4-20250514"  # Standard tier
"adversary": "claude-opus-4-20250514"    # Deep tier
```

Adversary is the most important agent for critique quality - using Haiku degrades output significantly.

#### 17. Panel Mode References Non-Existent Models
**File:** `app/config/models.py:62-64`

```python
"adversary_panel_openai": "gpt-5",        # GPT-5 doesn't exist
"adversary_panel_google": "gemini-3-opus", # Gemini-3 doesn't exist
```

Panel mode will crash if enabled.

#### 18. Orchestrator Deadlock Risk
**File:** `app/services/orchestrator.py`

If `rigor_find` fails, `rigor_rewrite` waits forever:
```python
# If rigor_find raises BEFORE setting rigor_find_ready.set()
# Then rigor_rewrite deadlocks on: await rigor_find_ready.wait()
```

**FIX:** Set `rigor_find_ready.set()` in a `finally` block.

---

### NEW CRITICAL: Performance Issues

#### 19. Sequential Perplexity Search (Should Be Parallel)
**File:** `app/core/perplexity.py:116-120`

```python
# CURRENT - Sequential (SLOW)
async def search_batch(self, queries):
    for query_id, query_text in queries:
        result = await self.search(query_id, query_text)  # One at a time!
```

```python
# SHOULD BE - Parallel with semaphore
async def search_batch(self, queries):
    sem = asyncio.Semaphore(3)
    async def limited_search(q):
        async with sem: return await self.search(*q)
    return await asyncio.gather(*[limited_search(q) for q in queries])
```

**Impact:** 10 queries × 2s each = 20s sequential vs ~4s parallel

#### 20. N² Complexity in Chunker
**File:** `app/services/chunker.py:125-126`

```python
# Called for EVERY chunk - O(N) each time
first_idx = all_paragraphs.index(paragraphs[0])  # Linear search
last_idx = all_paragraphs.index(paragraphs[-1])  # Linear search again
```

For N paragraphs and M chunks: O(N×M) instead of O(N) with precomputed index map.

#### 21. No Retry Logic Anywhere
Neither LLM client nor Perplexity client has retry with exponential backoff:
- Rate limits cause hard failures
- Transient network errors crash the pipeline
- No circuit breaker for API outages

#### 22. No Timeout Enforcement
**Files:** `app/core/llm.py`, `app/core/perplexity.py`, `app/services/orchestrator.py`

- No `asyncio.wait_for()` wrappers
- Hung API calls block forever
- No timeout on individual agent tasks

---

### NEW MAJOR: Agent Implementation Gaps

#### 23. Backend Agents Have Rich Error Recovery
| Feature | Backend | Zorro |
|---------|---------|-------|
| Per-chunk exception handling | ✅ Continue on failure | ❌ Propagates up |
| Grounding verification | ✅ 80% fuzzy match | ❌ None |
| Issue limit per chunk | ✅ Top 5 by severity | ❌ Unlimited |
| Mock mode for testing | ✅ Returns fixtures | ❌ None |
| Stream thoughts | ✅ Real-time UI | ⚠️ Events only |

#### 24. Backend Clarity Agent Features Missing in Zorro
- 3 issue limit per chunk (prevents flooding)
- Multi-sentence spanning logic for sentence_ids
- Text lookup validation before creating IssueCard
- Section lookup verification
- Temperature/top_p per model type

#### 25. Backend Rigor Agent Features Missing in Zorro
- Semaphore(6) for chunk parallelization
- Section-aware chunking with variable sizes by tier:
  - Deep: 1200 words
  - Standard: 1500 words
  - Quick: 1800 words
- Snippet grounding verification (80% word overlap)
- Batch rewriting in groups of 8

#### 26. Backend Adversary Agent Features Missing in Zorro
- Integration with DomainOutput evidence
- Rigor issues context (avoid duplication)
- Author limitations awareness
- Multi-location handling (general, multi-paragraph)

---

### NEW MAJOR: Prompt System Gaps

#### 27. Prompt Coverage Only 68%
| Aspect | Backend | Zorro | Coverage |
|--------|---------|-------|----------|
| Total lines | 621 | 333 | 54% |
| Guardrails | 30 explicit | 10 implicit | 33% |
| Examples | 8 attack examples | 0 | 0% |
| Tier variants | 3 (quick/std/deep) | 0 | 0% |
| Doc type voices | 4 types | 0 | 0% |

#### 28. Adversary Prompt Severely Weaker
- Backend: 294 lines + 8 concrete attack examples + domain evidence integration
- Zorro: 65 lines, no examples, no evidence integration

This is why adversary output quality will be lower.

#### 29. Missing Category Definitions
Backend Rigor has 8 explicit categories with definitions:
- Missing Control, Missing Justification, Insufficient Sample, Wrong Test
- Unreported Variance, Selective Reporting, Unsupported Claim, Protocol Gap

Zorro Rigor has 4 categories without clear definitions.

---

### NEW MAJOR: API Layer Gaps

#### 30. Missing Endpoints
| Endpoint | Backend | Zorro |
|----------|---------|-------|
| POST /documents/upload | ✅ | ❌ |
| POST /documents/{id}/export | ✅ | ❌ |
| GET /documents | ✅ | ❌ |
| GET /documents/{id} | ✅ | ❌ |
| DELETE /documents/{id} | ✅ | ❌ |
| GET /documents/{id}/download | ✅ | ❌ |

Users can't upload files or export results in Zorro.

#### 31. No Persistent Storage
- Backend: Filesystem-based document store
- Zorro: In-memory only, data lost on restart

#### 32. CORS Security Risk
```python
# Zorro (INSECURE)
allow_origins=["*"]  # Allows any origin

# Backend (SECURE)
allow_origins=["http://localhost:3000", "https://peerpreview.com"]
```

---

### NEW: Model Inventory Comparison

#### 33. Models Count
- Backend: 42 Pydantic models
- Zorro: 47 Pydantic models

But Zorro is MISSING critical fields in Finding that IssueCard has.

#### 34. Zorro Models Missing vs Backend
| Model | Backend | Zorro | Impact |
|-------|---------|-------|--------|
| ArgumentMap | ✅ | ❌ | OK - intentionally removed |
| ReviewPlan | ✅ | ❌ | OK - fixed pipeline |
| IssueCard fields | track, dimensions, source_agent | ❌ | CRITICAL |
| ReviewOutput | ✅ | ❌ | CRITICAL |
| ReviewMetadata | ✅ | ❌ | CRITICAL |
| ReviewSummary | ✅ | ❌ | CRITICAL |

---

## UPDATED PRIORITY FIX ORDER

### PHASE 0: Immediate Crashes (30 min)
1. Fix parameter name bugs in domain agents
2. Fix model selection for adversary (Haiku → Sonnet)
3. Remove/disable panel mode (non-existent models)
4. Fix orchestrator deadlock (finally block)

### PHASE 1: Performance (2-3 hours)
5. Convert LLM client to truly async
6. Add semaphore (6 concurrent calls)
7. Parallelize Perplexity batch search
8. Add retry logic with exponential backoff
9. Add timeout enforcement

### PHASE 2: Frontend Compatibility (3-4 hours)
10. Add track field to Finding (derived from agent_id)
11. Add dimensions field to Finding
12. Add sentence_ids extraction from anchors
13. Build ReviewOutput in assembler
14. Add ReviewMetadata and ReviewSummary models

### PHASE 3: Quality Parity (4-6 hours)
15. Add grounding filter
16. Add limitation filtering
17. Add summary generation
18. Align tier model selection
19. Match dedup logic
20. Add issue limits per chunk

### PHASE 4: Prompts & Polish (4-6 hours)
21. Add missing guardrails to prompts (30 → Zorro's 10)
22. Add adversary attack examples
23. Add tier-specific prompt variants
24. Add prompt caching
25. Add comprehensive logging

### PHASE 5: API Completeness (6-8 hours)
26. Add document upload endpoint
27. Add document export endpoint
28. Add persistent storage
29. Fix CORS security
30. Add document management endpoints

---

## TOTAL ESTIMATED EFFORT

| Phase | Time | Priority |
|-------|------|----------|
| Phase 0: Crashes | 30 min | P0 - Blocking |
| Phase 1: Performance | 2-3 hrs | P0 - 80% speedup |
| Phase 2: Frontend | 3-4 hrs | P0 - Nothing works without |
| Phase 3: Quality | 4-6 hrs | P1 - Feature parity |
| Phase 4: Prompts | 4-6 hrs | P1 - Output quality |
| Phase 5: API | 6-8 hrs | P2 - Full product |

**Total: 20-28 hours to production parity**

---

## APPENDIX A: How Document Chunking Works

### The Problem
A document JSON can be huge (50-100KB). You do NOT pass the entire document to each LLM call - that would:
1. Waste tokens (and money)
2. Exceed context limits
3. Dilute agent focus

### The Solution: Pass Only Relevant Chunks

#### Backend Strategy (`utils/document_chunker.py`)

**1. Chunk by Paragraphs (for Clarity)**
```python
# Input: Full DocumentObject
# Output: List of chunk dicts, each with ONLY its paragraphs

chunk = {
    'chunk_id': 'chunk_1',
    'paragraphs': [
        {'paragraph_id': 'p_1', 'text': '...', 'sentences': [...]},
        {'paragraph_id': 'p_2', 'text': '...', 'sentences': [...]},
    ],
    'word_count': 1200,
    'sections': ['introduction'],
    'paragraph_ids': ['p_1', 'p_2']
}
```

**2. Chunk by Sections (for Rigor)**
```python
# Each section becomes one chunk
chunk = {
    'chunk_id': 'chunk_methods',
    'sections': ['methods'],
    'paragraphs': [...only paragraphs in methods section...]
}
```

#### Zorro Strategy (`services/chunker.py`)

**ClarityChunk Model:**
```python
class ClarityChunk(BaseModel):
    chunk_index: int
    chunk_total: int
    paragraphs: list[Paragraph]  # ONLY this chunk's paragraphs
    paragraph_ids: list[str]
    word_count: int
    context_before: ContextOverlap | None  # 3 sentences for continuity
    context_after: ContextOverlap | None

    def get_text_with_ids(self) -> str:
        """Format for prompt - ONLY chunk content"""
        parts = []
        if self.context_before:
            parts.append("[CONTEXT ONLY - DO NOT CRITIQUE: ...]")

        for p in self.paragraphs:
            parts.append(f"[{p.paragraph_id}] {p.text}")

        return "\n\n".join(parts)
```

**RigorChunk Model:**
```python
class RigorChunk(BaseModel):
    section: Section  # One section per chunk
    paragraphs: list[Paragraph]  # ONLY paragraphs in this section
    # ... similar to ClarityChunk
```

### What Gets Passed to the LLM

**NOT THIS (wrong - entire document):**
```
<document>
{entire 50KB JSON with all paragraphs, sections, figures, references...}
</document>

Please review for clarity issues.
```

**THIS (correct - only the chunk):**
```
## CHUNK 3 of 5

[CONTEXT - DO NOT CRITIQUE: Previous section ended with discussion of methodology...]

[p_12] The results demonstrate a significant correlation between...

[p_13] However, when controlling for confounding variables...

[p_14] This finding contradicts earlier work by Smith et al...

[CONTEXT - DO NOT CRITIQUE: Next section discusses limitations...]
```

### Why Context Overlap?

The 3-sentence context before/after each chunk helps the LLM understand:
- What came before (so it doesn't repeat issues)
- What comes after (so it understands flow)
- But it's marked "DO NOT CRITIQUE" so it doesn't generate issues for other chunks

### Chunking Parameters

| Agent | Chunk Strategy | Target Size | Context |
|-------|---------------|-------------|---------|
| Clarity | Word-based | ~1500 words | 3 sentences |
| Rigor | Section-based | 1 section | 3 sentences |
| Adversary | Full document | N/A | N/A |
| Briefing | Full document | N/A | N/A |

### Backend vs Zorro Chunking Differences

| Aspect | Backend | Zorro |
|--------|---------|-------|
| Clarity target | ~1200 words | ~1500 words (settings.DEFAULT_CHUNK_WORDS) |
| Rigor strategy | Section-aware with tier sizing | Section-based |
| Context overlap | 3 sentences | 3 sentences (settings.CONTEXT_OVERLAP_SENTENCES) |
| Reference filtering | Excludes refs/bibliography | Not implemented |
| Paragraph boundary | Preserved | Preserved |

---

## APPENDIX B: Agent Input/Output Reference

### What Each Agent Receives

#### Briefing Agent
```python
Input:
- doc: DocObj (FULL document - needed for overview)
- steering: str | None

Output:
- BriefingOutput (summary, limitations, key claims)
- AgentMetrics
```

#### Clarity Agent
```python
Input:
- chunk: ClarityChunk  # NOT full doc
- briefing: BriefingOutput
- steering: str | None

Output per chunk:
- list[Finding]
- AgentMetrics

Total output:
- All chunk findings combined
- All chunk metrics combined
```

#### Rigor-Find Agent
```python
Input:
- chunk: RigorChunk  # One section
- briefing: BriefingOutput
- steering: str | None

Output per section:
- list[Finding] (no proposed_edit yet)
- AgentMetrics
```

#### Rigor-Rewrite Agent
```python
Input:
- findings: list[Finding]  # All findings from Rigor-Find
- doc: DocObj  # Needs full doc for context

Output:
- list[Finding] (with proposed_edit added)
- AgentMetrics
```

#### Adversary Agent
```python
Input:
- doc: DocObj  # FULL document (needs everything)
- briefing: BriefingOutput
- rigor_findings: list[Finding]  # To avoid duplication
- evidence: EvidencePack  # From Domain pipeline

Output:
- list[Finding]
- AgentMetrics
```

#### Domain Pipeline
```python
Input:
- doc: DocObj  # FULL document

Output:
- EvidencePack (for Adversary to use)
- Not converted to Finding objects
```

### Prompt Format for Chunked Agents

```
SYSTEM: You are a clarity reviewer focusing on writing quality...

USER:
## BRIEFING CONTEXT
Summary: This paper investigates...
Limitations acknowledged: Sample size, generalizability...

## CHUNK 3 of 5

[CONTEXT ONLY - DO NOT CRITIQUE: The methodology section described...]

[p_12] The results demonstrate a significant correlation between X and Y (r=0.72, p<0.01).

[p_13] However, when controlling for confounding variable Z, the correlation...

[CONTEXT ONLY - DO NOT CRITIQUE: The discussion section will address...]

<user_directive>
Focus on clarity of statistical reporting
</user_directive>
```

---

## APPENDIX C: Consolidated Findings from All Audit Reports

### From AGENTS_AUDIT_REPORT.md (Zorro Agents)

**Critical Issues Found:**
1. No semaphore in Clarity (unlimited parallel calls)
2. No error handling in BaseAgent
3. No input validation anywhere
4. Panel mode references non-existent models
5. No retry logic in any agent
6. No telemetry/metrics initialization

**Production Readiness: 6.5/10**

### From UTILITIES_SERVICES_AUDIT.md (Backend Reference)

**Backend Features Zorro Lacks:**
1. `asyncio.Semaphore(6)` for rate limiting
2. Prompt caching with `cache_control` headers
3. `LLM_DEBUG` mode for visibility
4. `DEBUG_DUMP` mode for intermediate state
5. Token tracking with CSV export
6. Mock mode for testing without API calls

### From MODEL_AUDIT_v1.md (Zorro Models)

**47 Models in Zorro, but missing:**
1. `track` field on Finding (CRITICAL)
2. `dimensions` field on Finding (CRITICAL)
3. `ReviewOutput` model (CRITICAL)
4. `ReviewMetadata` model (CRITICAL)
5. `ReviewSummary` model (CRITICAL)

**What Zorro Has That Backend Doesn't:**
1. Better `BriefingOutput` model (cleaner than DocumentInventory)
2. Typed SSE events (8 event types)
3. `EvidencePack` for Domain pipeline

### From PROMPT_SYSTEMS_COMPARISON.md

**Backend Prompts: 621 lines**
- 30 explicit guardrails
- 8 adversary attack examples
- 3 tier variants (quick/standard/deep)
- 4 document type voices

**Zorro Prompts: 333 lines (54% of backend)**
- 10 implicit guardrails
- 0 attack examples
- 0 tier variants
- 0 document type voices

**Coverage: 68%** - Zorro implements ~68% of backend prompt functionality

### From API_COMPARISON.md

**Backend: 15 endpoints**
- Document upload/parse
- Review run (streaming)
- Document export (DOCX with comments)
- Document management (list, get, delete)

**Zorro: 5 endpoints**
- Health check
- Parse document
- Run review (streaming)
- Get review status
- Demo documents

**Missing in Zorro:**
- Document upload
- Document export
- Document management
- Persistent storage

---

## APPENDIX D: File-by-File Fix Guide

### Phase 0: Crash Fixes (30 min)

| File | Issue | Fix |
|------|-------|-----|
| `app/agents/domain/target_extractor.py` | Parameter name bug | Match function signature to caller |
| `app/agents/domain/query_generator.py` | Parameter name bug | Match function signature to caller |
| `app/config/models.py:59` | Adversary uses Haiku | Change to Sonnet |
| `app/config/models.py:62-64` | Panel uses GPT-5/Gemini-3 | Remove or use real models |
| `app/services/orchestrator.py` | Deadlock on rigor_find failure | Add finally block to set event |

### Phase 1: Performance (2-3 hrs)

| File | Issue | Fix |
|------|-------|-----|
| `app/core/llm.py` | Sync client | Import AsyncAnthropic, add await |
| `app/core/llm.py` | No semaphore | Add `asyncio.Semaphore(6)` |
| `app/core/llm.py` | No logging | Add LLM_DEBUG mode |
| `app/core/perplexity.py:116-120` | Sequential batch | Use asyncio.gather with semaphore |
| `app/services/chunker.py:125-126` | N² index lookup | Precompute index map |

### Phase 2: Frontend Compatibility (3-4 hrs)

| File | Issue | Fix |
|------|-------|-----|
| `app/models/finding.py` | No track field | Add `track: Literal["A", "B", "C"]` |
| `app/models/finding.py` | No dimensions | Add `dimensions: list[Literal["WQ", "AS", "CR"]]` |
| `app/models/finding.py` | No sentence_ids | Add or derive from anchors |
| `app/models/review.py` | No ReviewOutput | Add model matching backend |
| `app/services/assembler.py` | Returns list[Finding] | Return ReviewOutput |

### Phase 3: Quality (4-6 hrs)

| File | Issue | Fix |
|------|-------|-----|
| `app/utils/grounding.py` | Doesn't exist | Copy from backend |
| `app/utils/dimensions.py` | Doesn't exist | Copy from backend |
| `app/services/assembler.py` | No limitation filter | Add `_filter_acknowledged()` |
| `app/services/assembler.py` | No summary gen | Add `generate_summary()` |
| `app/services/assembler.py` | Wrong dedup | Match backend (Track B exempt, C wins A) |

### Phase 4: Prompts (4-6 hrs)

| File | Issue | Fix |
|------|-------|-----|
| `app/composer/library.py` | Missing guardrails | Add 20 more from backend |
| `app/composer/library.py` | No attack examples | Add 8 from backend adversary |
| `app/composer/library.py` | No tier variants | Add quick/standard/deep modifiers |
| `app/core/llm.py` | No prompt caching | Add cache_control headers |

### Phase 5: API (6-8 hrs)

| File | Issue | Fix |
|------|-------|-----|
| `app/api/routes/documents.py` | Doesn't exist | Create upload/export/manage endpoints |
| `app/services/storage.py` | Doesn't exist | Add persistent document storage |
| `app/main.py` | CORS allows * | Restrict to allowed origins |
