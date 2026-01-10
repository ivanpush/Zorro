# ZORRO Backend - Claude Implementation Prompts

Copy these prompts to Claude for each build phase.

---

## PHASE 1: Project Setup

```
Create the ZORRO backend project structure.

Requirements:
1. Python FastAPI project in `backend/`
2. pyproject.toml with dependencies:
   - fastapi>=0.109.0
   - uvicorn[standard]>=0.27.0
   - pydantic>=2.5.0
   - pydantic-settings>=2.0.0
   - instructor>=1.0.0
   - anthropic>=0.18.0
   - openai>=1.0.0 (for panel mode)
   - google-generativeai>=0.3.0 (for panel mode)
   - httpx>=0.26.0
   - python-docx>=1.1.0
   - pymupdf>=1.23.0
   - pytest>=7.4.0 (dev)
   - pytest-asyncio>=0.23.0 (dev)

3. Directory structure:
   backend/
   ├── app/
   │   ├── __init__.py
   │   ├── main.py
   │   ├── config/
   │   ├── models/
   │   ├── composer/
   │   ├── agents/
   │   ├── services/
   │   ├── api/
   │   └── core/
   ├── tests/
   └── pyproject.toml

4. main.py: FastAPI app with CORS (localhost:5173), health endpoint

5. .env.example with required keys

Just skeleton - no implementation yet.
```

---

## PHASE 2: Pydantic Models

```
Create all Pydantic models for ZORRO.

I'll provide the model definitions. Create these files:
- app/models/document.py
- app/models/finding.py (with camelCase serialization!)
- app/models/briefing.py
- app/models/domain.py
- app/models/chunks.py
- app/models/metrics.py
- app/models/review.py
- app/models/events.py
- app/models/__init__.py

CRITICAL: Finding model must serialize to camelCase:
- agent_id → agentId
- created_at → createdAt
- proposed_edit → proposedEdit

Use @model_serializer decorator.

[PASTE CONTENT FROM 01_PYDANTIC_MODELS.md]
```

---

## PHASE 3: Global Config

```
Create the global configuration module.

app/config/settings.py - Environment settings with pydantic-settings
app/config/models.py - MODEL_COSTS dict, AGENT_MODELS dict, helper functions

This is the SINGLE SOURCE OF TRUTH for:
- Which model each agent uses
- Cost per model (input/output per 1M tokens)
- Panel mode model list

[PASTE CONTENT FROM 02_GLOBAL_CONFIG.md]
```

---

## PHASE 4: Core Infrastructure

```
Create core infrastructure:

1. app/core/llm.py - Instructor-wrapped client with metrics collection
   - Every call returns (response, AgentMetrics)
   - Automatic token counting and cost calculation
   - Uses config to get model for agent_id

2. app/core/perplexity.py - Perplexity Sonar client
   - search(query_id, query_text) → (SearchResult, sources, metrics)
   - search_batch for multiple queries

3. app/services/chunker.py - Document chunking
   - chunk_for_clarity(doc, target_words=1200) - word-based
   - chunk_for_rigor(doc) - section-based
   - 3-sentence context overlap before/after
   - Context marked [CONTEXT ONLY - DO NOT CRITIQUE]

[PASTE CONTENT FROM 04_CORE_INFRASTRUCTURE.md]
```

---

## PHASE 5: Composer

```
Create the Composer (prompt library and builder).

app/composer/library.py - All prompt templates:
- BRIEFING_SYSTEM, BRIEFING_USER
- CLARITY_SYSTEM, CLARITY_USER (handles chunks)
- RIGOR_FIND_SYSTEM, RIGOR_FIND_USER (section chunks)
- RIGOR_REWRITE_SYSTEM, RIGOR_REWRITE_USER
- DOMAIN_TARGET_SYSTEM, DOMAIN_TARGET_USER
- DOMAIN_QUERY_SYSTEM, DOMAIN_QUERY_USER
- DOMAIN_SYNTH_SYSTEM, DOMAIN_SYNTH_USER
- ADVERSARY_SYSTEM, ADVERSARY_USER
- RECONCILE_SYSTEM, RECONCILE_USER (panel mode)

app/composer/builder.py - Composer class with build_*_prompt methods

[PASTE CONTENT FROM 03_COMPOSER_PROMPTS.md]
```

---

## PHASE 6: Base Agent

```
Create the base agent class.

app/agents/base.py:

```python
from abc import ABC, abstractmethod
from typing import TypeVar, Generic
from pydantic import BaseModel

from app.core.llm import get_llm_client
from app.composer import Composer
from app.models import AgentMetrics

T = TypeVar("T", bound=BaseModel)

class BaseAgent(ABC, Generic[T]):
    """Base class for all LLM agents."""
    
    def __init__(self):
        self.client = get_llm_client()
        self.composer = Composer()
    
    @property
    @abstractmethod
    def agent_id(self) -> str:
        """Return agent ID for model lookup."""
        pass
    
    @abstractmethod
    async def run(self, *args, **kwargs) -> tuple[T, AgentMetrics]:
        """Execute agent. Returns (result, metrics)."""
        pass
```

Write test to verify agent_id maps to valid model.
```

---

## PHASE 7: Briefing Agent

```
Create the Briefing agent.

app/agents/briefing.py:
- Extends BaseAgent
- agent_id = "briefing"
- Input: DocObj, optional steering
- Output: (BriefingOutput, AgentMetrics)
- Uses Instructor for structured output

Test with demo fixture.
```

---

## PHASE 8: Clarity Agent

```
Create the Clarity agent with chunking.

app/agents/clarity.py:
- Extends BaseAgent
- agent_id = "clarity"
- Input: DocObj, BriefingOutput, optional steering
- Process:
  1. Chunk document (1200 words, 3-sentence overlap)
  2. Run all chunks in parallel
  3. Merge findings from all chunks
- Output: (list[Finding], list[AgentMetrics])

Each finding must have:
- agent_id = "clarity"
- category starting with "clarity_"
- Valid anchor with paragraph_id and quoted_text

Test: findings only reference paragraphs in their chunk (not CONTEXT ONLY)
```

---

## PHASE 9: Rigor Agents

```
Create the 2-phase Rigor agents.

app/agents/rigor/finder.py - RigorFinder:
- agent_id = "rigor_find"
- Chunks by section
- Parallel execution
- Output: list of raw findings (no rewrites)

app/agents/rigor/rewriter.py - RigorRewriter:
- agent_id = "rigor_rewrite"
- Input: findings from RigorFinder
- Generates proposed_edit for each finding
- Can run PARALLEL with Adversary (only needs Rigor-Find)

app/agents/rigor/__init__.py - exports both
```

---

## PHASE 10: Domain Pipeline

```
Create the 4-stage Domain pipeline.

app/agents/domain/target_extractor.py:
- Extracts DomainTargets from document
- Identifies study design limitations (CRITICAL)

app/agents/domain/query_generator.py:
- Generates 4-6 SearchQueries from targets

app/agents/domain/search_executor.py:
- Executes queries via Perplexity
- Returns SearchResults and SourceSnippets

app/agents/domain/evidence_synthesizer.py:
- Synthesizes results into EvidencePack
- Categories: design_limitations, contradictions, prior_work, etc.

app/agents/domain/pipeline.py - DomainPipeline:
- Orchestrates all 4 stages
- Output: (EvidencePack, list[AgentMetrics])
```

---

## PHASE 11: Adversary Agent

```
Create Adversary agent with panel mode support.

app/agents/adversary/single.py - SingleAdversary:
- agent_id = "adversary"
- Uses Opus model
- Input: DocObj, Briefing, Rigor findings, EvidencePack
- Output: list[Finding]

app/agents/adversary/panel.py - PanelAdversary:
- Runs 3 frontier models in parallel:
  - adversary_panel_claude (Opus)
  - adversary_panel_openai (GPT-5)
  - adversary_panel_google (Gemini-3)
- Same input as single

app/agents/adversary/reconcile.py - Reconciler:
- Merges findings from 3 models
- Similar findings merged, votes counted (1, 2, or 3)
- Output: list[Finding] with votes field set

app/agents/adversary/__init__.py - AdversaryAgent:
- Takes panel_mode: bool
- Routes to Single or Panel+Reconcile
```

---

## PHASE 12: Assembler

```
Create the Assembler (deterministic deduplication).

app/services/assembler.py:

Priority for dedup (lower wins):
- adversary, adversary_panel: 1
- rigor_find, rigor_rewrite, domain: 2  
- clarity: 3

Presentation order (lower = earlier):
- clarity: 1
- rigor: 2
- domain: 3
- adversary: 4

Logic:
1. Group findings by paragraph_id
2. Within paragraph, check anchor overlap
3. When overlap, keep higher priority (lower number)
4. Sort final list by presentation order

Test with overlapping_findings fixture.
```

---

## PHASE 13: Orchestrator

```
Create the Orchestrator (pipeline coordinator).

app/services/orchestrator.py:

Pipeline flow:
1. Briefing || Domain (parallel)
2. Clarity (chunked) || Rigor-Find (section-chunked) (after Briefing)
3. Rigor-Rewrite || Adversary (parallel, after their deps)
4. Assembler (after all)

Track ReviewMetrics throughout.
Handle errors gracefully (agent fail doesn't crash pipeline).

Output: ReviewJob with findings and metrics for dev banner.
```

---

## PHASE 14: API Endpoints

```
Create FastAPI routes.

app/api/routes/review.py:
- POST /review/start - starts review, returns job_id
- GET /review/{job_id}/stream - SSE endpoint (stub for now)
- GET /review/{job_id}/result - get final result with dev banner

app/api/routes/health.py:
- GET /health

Register in main.py.
```

---

## PHASE 15: SSE Infrastructure

```
Implement SSE streaming (after basic flow works).

Event types from app/models/events.py:
- phase_started, phase_completed
- agent_started, agent_completed
- finding_discovered
- review_completed (includes metrics for dev banner)
- error

Modify orchestrator to yield events.
Frontend displays events in real-time.
```

---

## COMMIT MESSAGES

```
chore(backend): initialize project structure
feat(models): add all Pydantic models with camelCase serialization
feat(config): add global model registry and cost tracking
feat(core): add LLM client with metrics collection
feat(core): add Perplexity client
feat(services): add document chunker with context overlap
feat(composer): add prompt library and builder
feat(agents): add base agent class
feat(agents): add briefing agent
feat(agents): add clarity agent with parallel chunking
feat(agents): add rigor finder and rewriter
feat(agents): add domain pipeline (4 stages)
feat(agents): add adversary with panel mode support
feat(services): add assembler with priority dedup
feat(services): add orchestrator pipeline
feat(api): add review endpoints
feat(api): add SSE streaming
test: add unit and integration tests
```
