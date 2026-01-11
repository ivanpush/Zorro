# Backend Improvement Plan
**Created:** 2026-01-10
**Status:** Ready for execution

---

## Instructions for Claude Code

You are improving the Zorro backend. Follow this plan phase by phase, checking off tasks as you complete them. After each phase, update the Build Log with what was done and any issues encountered.

**Rules:**
1. Complete each phase fully before moving to the next
2. After each phase, run tests to verify nothing broke
3. Update the Build Log after completing each phase
4. If you encounter blockers, document them in the Build Log and continue with what you can
5. Do NOT modify deferred items (Domain agent, Panel mode, Adversary Sonnet upgrade)

**Testing Order:**
- Phase 1-3: Test with Briefing + Clarity only
- Phase 4: Add Rigor to tests
- Phase 5: Add Adversary to tests
- Phase 6: Add Domain to tests (when enabled)

**Files you'll be modifying:**
- `app/core/llm.py` - Performance + Logging
- `app/core/perplexity.py` - Performance (defer until Domain enabled)
- `app/models/finding.py` - Frontend compatibility
- `app/models/review.py` - Frontend compatibility
- `app/services/assembler.py` - Frontend compatibility + Logging
- `app/services/chunker.py` - Logging
- `app/agents/clarity.py` - Logging
- `app/agents/rigor/finder.py` - Logging
- `app/agents/adversary/*.py` - Logging
- `app/config/settings.py` - Debug mode

---

## Build Log

| Date | Phase | Status | Notes |
|------|-------|--------|-------|
| | | | |

---

## Deferred Items (DO NOT TOUCH)

- ⏸️ **Domain agent parameter bugs** - Domain pipeline not currently enabled
- ⏸️ **Panel mode non-existent models** - Panel mode not currently used
- ⏸️ **Adversary Sonnet upgrade** - Keep Haiku during dev to save costs
- ⏸️ **Perplexity parallelization** - Defer until Domain enabled

---

## Phase 1: LLM Client Performance (1-2 hours)

**Goal:** Add concurrency control, retry logic, and timeouts to prevent runaway API calls.

**Test after:** Run Briefing + Clarity only, verify calls are limited and errors are handled.

### 1.1 Add Concurrency Semaphore
**File:** `app/core/llm.py`

Add a semaphore to limit concurrent LLM calls to 6 max.

```python
import asyncio

# Module-level semaphore
_semaphore = asyncio.Semaphore(6)

class LLMClient:
    async def call(self, ...):
        async with _semaphore:
            # existing call logic
```

- [ ] Add `_semaphore = asyncio.Semaphore(6)` at module level
- [ ] Wrap `call()` method body with `async with _semaphore:`
- [ ] Wrap `call_raw()` method body with `async with _semaphore:`

### 1.2 Add Retry Logic with Exponential Backoff
**File:** `app/core/llm.py`

Add retry for transient failures (rate limits, network errors).

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from anthropic import APIError, RateLimitError

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((APIError, RateLimitError))
)
async def _make_call(self, ...):
    # actual API call
```

- [ ] Add `tenacity` to `requirements.txt`
- [ ] Create internal `_make_call()` method with retry decorator
- [ ] Update `call()` to use `_make_call()`
- [ ] Update `call_raw()` to use similar pattern

### 1.3 Add Timeout Enforcement
**File:** `app/core/llm.py`

Prevent hung API calls from blocking forever.

```python
import asyncio

async def call(self, ...):
    async with _semaphore:
        try:
            response = await asyncio.wait_for(
                self._make_call(...),
                timeout=60.0
            )
        except asyncio.TimeoutError:
            raise LLMTimeoutError(f"LLM call timed out after 60s for agent {agent_id}")
```

- [ ] Create `LLMTimeoutError` exception class
- [ ] Wrap API calls with `asyncio.wait_for(..., timeout=60.0)`
- [ ] Log timeout errors

---

## Phase 2: Frontend Compatibility - Finding Model (2 hours)

**Goal:** Add `track`, `dimensions`, and `sentence_ids` fields that frontend expects.

**Test after:** Run Briefing + Clarity, verify findings have correct track/dimensions in output.

### 2.1 Add Track Field
**File:** `app/models/finding.py`

Frontend expects `track: "A" | "B" | "C"` for tab routing.

Track mapping:
- Track A (Writing Quality): `clarity` agent
- Track B (Methodology): `rigor_find`, `rigor_rewrite` agents
- Track C (Argumentation): `adversary`, `domain` agents

```python
Track = Literal["A", "B", "C"]

AGENT_TO_TRACK: dict[str, Track] = {
    "clarity": "A",
    "rigor_find": "B",
    "rigor_rewrite": "B",
    "adversary": "C",
    "adversary_panel": "C",
    "domain": "C",
}

class Finding(BaseModel):
    ...
    track: Track = Field(default="A")

    def __init__(self, **data):
        super().__init__(**data)
        # Auto-derive track from agent_id if not set
        if "track" not in data:
            self.track = AGENT_TO_TRACK.get(self.agent_id, "A")
```

- [ ] Add `Track` type literal
- [ ] Add `AGENT_TO_TRACK` mapping dict
- [ ] Add `track` field to `Finding` model
- [ ] Add auto-derivation logic in `__init__` or validator
- [ ] Update serializer to include `"track": self.track`

### 2.2 Add Dimensions Field
**File:** `app/models/finding.py`

Frontend uses dimensions for summary charts and filtering.

Dimension mapping:
- WQ (Writing Quality): `clarity_*` categories
- CR (Claim Rigor): `rigor_*` categories
- AS (Argument Strength): `adversarial_*`, `scope_*`, `domain_*` categories

```python
Dimension = Literal["WQ", "AS", "CR"]

CATEGORY_TO_DIMENSIONS: dict[str, list[Dimension]] = {
    "clarity_sentence": ["WQ"],
    "clarity_paragraph": ["WQ"],
    "clarity_section": ["WQ"],
    "clarity_flow": ["WQ"],
    "rigor_methodology": ["CR"],
    "rigor_logic": ["CR"],
    "rigor_evidence": ["CR"],
    "rigor_statistics": ["CR"],
    "scope_overclaim": ["AS"],
    "scope_underclaim": ["AS"],
    "scope_missing": ["AS"],
    "domain_convention": ["AS", "CR"],
    "domain_terminology": ["AS", "CR"],
    "domain_factual": ["AS", "CR"],
    "adversarial_weakness": ["AS"],
    "adversarial_gap": ["AS"],
    "adversarial_alternative": ["AS"],
}

class Finding(BaseModel):
    ...
    dimensions: list[Dimension] = Field(default_factory=list)
```

- [ ] Add `Dimension` type literal
- [ ] Add `CATEGORY_TO_DIMENSIONS` mapping dict
- [ ] Add `dimensions` field to `Finding` model
- [ ] Add auto-derivation from category
- [ ] Update serializer to include `"dimensions": self.dimensions`

### 2.3 Add sentence_ids Field
**File:** `app/models/finding.py`

Frontend expects `sentence_ids: list[str]` for text highlighting.

```python
class Finding(BaseModel):
    ...

    @property
    def sentence_ids(self) -> list[str]:
        """Extract sentence_ids from anchors."""
        return [a.sentence_id for a in self.anchors if a.sentence_id]
```

- [ ] Add `sentence_ids` property to `Finding`
- [ ] Update serializer to include `"sentenceIds": self.sentence_ids`

---

## Phase 3: Frontend Compatibility - ReviewOutput Model (2 hours)

**Goal:** Create proper output structure with summary stats and metadata.

**Test after:** Run Briefing + Clarity, verify API returns full ReviewOutput structure.

### 3.1 Create ReviewOutput Models
**File:** `app/models/review.py`

```python
from pydantic import BaseModel
from typing import Any

class ReviewSummary(BaseModel):
    """Summary statistics for review results."""
    total_findings: int
    by_track: dict[str, int]  # {"A": 5, "B": 3, "C": 2}
    by_severity: dict[str, int]  # {"critical": 1, "major": 4, ...}
    by_dimension: dict[str, int]  # {"WQ": 5, "AS": 3, "CR": 2}

class ReviewMetadata(BaseModel):
    """Execution metadata."""
    total_time_ms: float
    total_cost_usd: float
    agents_run: list[str]
    model_usage: dict[str, int] = {}  # model -> token count

class ReviewOutput(BaseModel):
    """Complete review output for API response."""
    findings: list[Finding]
    summary: ReviewSummary
    metadata: ReviewMetadata
    narrative: str | None = None
```

- [ ] Add `ReviewSummary` model
- [ ] Add `ReviewMetadata` model
- [ ] Add `ReviewOutput` model
- [ ] Add to `app/models/__init__.py` exports

### 3.2 Update Assembler to Build ReviewOutput
**File:** `app/services/assembler.py`

```python
from app.models import ReviewOutput, ReviewSummary, ReviewMetadata, AgentMetrics
from collections import Counter

class Assembler:
    def assemble(
        self,
        findings: list[Finding],
        metrics: list[AgentMetrics]
    ) -> ReviewOutput:
        deduped = self._deduplicate(findings)
        summary = self._build_summary(deduped)
        metadata = self._build_metadata(metrics)
        return ReviewOutput(
            findings=deduped,
            summary=summary,
            metadata=metadata
        )

    def _build_summary(self, findings: list[Finding]) -> ReviewSummary:
        by_track = Counter(f.track for f in findings)
        by_severity = Counter(f.severity for f in findings)
        by_dimension = Counter(d for f in findings for d in f.dimensions)
        return ReviewSummary(
            total_findings=len(findings),
            by_track=dict(by_track),
            by_severity=dict(by_severity),
            by_dimension=dict(by_dimension),
        )

    def _build_metadata(self, metrics: list[AgentMetrics]) -> ReviewMetadata:
        return ReviewMetadata(
            total_time_ms=sum(m.time_ms for m in metrics),
            total_cost_usd=sum(m.cost_usd for m in metrics),
            agents_run=list(set(m.agent_id for m in metrics)),
            model_usage={},  # TODO: aggregate by model
        )
```

- [ ] Import new models
- [ ] Add `_build_summary()` method
- [ ] Add `_build_metadata()` method
- [ ] Change `assemble()` signature to accept metrics
- [ ] Change `assemble()` return type to `ReviewOutput`

### 3.3 Update Orchestrator to Use New Assembler
**File:** `app/services/orchestrator.py`

Update the assembler call to pass metrics and handle ReviewOutput.

- [ ] Pass `all_metrics` to `assembler.assemble()`
- [ ] Update `ReviewCompletedEvent` to use `ReviewOutput` fields

### 3.4 Fix Dedup Logic in Assembler
**File:** `app/services/assembler.py`

Backend dedup rules:
1. Track B (Rigor) - NEVER deduplicated (all kept)
2. Track A vs C overlap - Keep C (Adversary wins over Clarity)
3. When C replaces A - merge dimensions from both
4. Same track conflicts - keep higher priority (first one)

```python
def _deduplicate(self, findings: list[Finding]) -> list[Finding]:
    # Track B exempt from dedup
    track_b = [f for f in findings if f.track == "B"]
    others = [f for f in findings if f.track != "B"]

    # Dedup others with Track C > Track A rule
    deduped = self._dedup_with_track_priority(others)

    # Sort: Track B first, then others
    return self._sort_by_presentation(track_b + deduped)

def _dedup_with_track_priority(self, findings: list[Finding]) -> list[Finding]:
    # Group by paragraph for overlap detection
    # When overlap detected between A and C, keep C and merge dimensions
    ...
```

- [ ] Implement Track B exemption from dedup
- [ ] Implement Track C > Track A priority rule
- [ ] Add dimension merging when C replaces A
- [ ] Update `_findings_overlap()` to use sentence_ids

---

## Phase 4: Observability & Logging (2 hours)

**Goal:** Add logging throughout so we can see what's happening.

**Test after:** Run Briefing + Clarity + Rigor, verify logs show call details.

### 4.1 Add Logging to LLM Client
**File:** `app/core/llm.py`

```python
import logging

logger = logging.getLogger("zorro.llm")

async def call(self, ...):
    ...
    logger.info(
        f"LLM call: agent={agent_id} model={model} "
        f"in={input_tokens} out={output_tokens} "
        f"time={elapsed_ms:.0f}ms cost=${cost:.4f}"
    )
    return response, metrics
```

- [ ] Add `logger = logging.getLogger("zorro.llm")`
- [ ] Log every successful call with metrics
- [ ] Log errors and retries
- [ ] Log timeouts

### 4.2 Add Logging to Agents
**Files:** `app/agents/clarity.py`, `app/agents/rigor/finder.py`, `app/agents/adversary/single.py`

```python
import logging
logger = logging.getLogger("zorro.agents")

# In run_streaming or run method:
logger.info(f"[{self.agent_id}] Starting: {num_chunks} chunks")
logger.info(f"[{self.agent_id}] Chunk {idx}/{total}: {len(findings)} findings")
logger.info(f"[{self.agent_id}] Complete: {total_findings} findings, ${total_cost:.3f}")
```

- [ ] Add logging to Clarity agent
- [ ] Add logging to Rigor finder
- [ ] Add logging to Adversary agent

### 4.3 Add Logging to Services
**Files:** `app/services/chunker.py`, `app/services/assembler.py`

```python
import logging
logger = logging.getLogger("zorro.services")

# Chunker:
logger.info(f"[chunker] Created {len(chunks)} chunks from {len(paragraphs)} paragraphs")

# Assembler:
logger.info(f"[assembler] Dedup: {input_count} → {output_count} ({removed} removed)")
```

- [ ] Add logging to Chunker
- [ ] Add logging to Assembler

### 4.4 Add Debug Mode Settings
**File:** `app/config/settings.py`

```python
class Settings(BaseSettings):
    ...
    llm_debug: bool = False  # Log full prompts/responses
    debug_dump: bool = False  # Save intermediates to JSON files
```

- [ ] Add `llm_debug` setting
- [ ] Add `debug_dump` setting
- [ ] Implement conditional verbose logging in LLM client

---

## Phase 5: Integration Testing - Add Rigor

**Goal:** Verify Rigor agent works with all the changes.

**Test:** Run Briefing + Clarity + Rigor together.

- [ ] Run full pipeline with Rigor enabled
- [ ] Verify Rigor findings have `track: "B"`
- [ ] Verify Rigor findings are NOT deduplicated
- [ ] Verify logging shows Rigor chunk processing
- [ ] Check ReviewOutput includes Rigor stats

---

## Phase 6: Integration Testing - Add Adversary

**Goal:** Verify Adversary agent works with all the changes.

**Test:** Run Briefing + Clarity + Rigor + Adversary together.

- [ ] Run full pipeline with Adversary enabled
- [ ] Verify Adversary findings have `track: "C"`
- [ ] Verify Adversary wins over Clarity in dedup (C > A)
- [ ] Verify dimension merging works
- [ ] Verify logging shows Adversary processing
- [ ] Check ReviewOutput includes Adversary stats

---

## Phase 7: Integration Testing - Add Domain (When Enabled)

**Goal:** Verify Domain pipeline works when enabled.

**Prerequisites:** Fix domain agent parameter bugs first (currently deferred).

- [ ] Fix `target_extractor.py` parameter names
- [ ] Fix `query_generator.py` parameter names
- [ ] Parallelize Perplexity batch search
- [ ] Run full pipeline with Domain enabled
- [ ] Verify Domain findings have `track: "C"`
- [ ] Verify logging shows Domain processing

---

## Verification Checklist

After all phases complete:

- [ ] LLM calls limited to 6 concurrent
- [ ] Retries happen on transient failures
- [ ] Timeouts prevent hung calls
- [ ] Findings have `track` field
- [ ] Findings have `dimensions` field
- [ ] Findings have `sentenceIds` in serialized output
- [ ] API returns `ReviewOutput` with summary and metadata
- [ ] Track B findings never deduplicated
- [ ] Track C wins over Track A in dedup
- [ ] Dimensions merged on replacement
- [ ] Logs show all LLM calls with metrics
- [ ] Logs show agent progress

---

## Files Modified Summary

```
Phase 1 (Performance):
  app/core/llm.py
  requirements.txt

Phase 2 (Finding Model):
  app/models/finding.py

Phase 3 (ReviewOutput):
  app/models/review.py
  app/models/__init__.py
  app/services/assembler.py
  app/services/orchestrator.py

Phase 4 (Logging):
  app/core/llm.py
  app/agents/clarity.py
  app/agents/rigor/finder.py
  app/agents/adversary/single.py
  app/services/chunker.py
  app/services/assembler.py
  app/config/settings.py
```
