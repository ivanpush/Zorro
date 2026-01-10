# ZORRO Backend Build - Master Document v2

## System Overview

ZORRO is a multi-agent document review system. The backend orchestrates LLM agents that analyze documents and produce structured findings with precise text anchors.

**Build Principle**: Agents first using demo fixtures. Parsing comes LAST.

---

## Pipeline Architecture

```
Document
    │
    ├──────────────────────────┐
    ▼                          ▼
Briefing                   Domain Pipeline
(context extraction)       (external evidence)
    │                          │
    ▼                          │
    ├────────────┐             │
    ▼            ▼             │
Clarity      Rigor-Find        │
(word-chunk) (section-chunk)   │
    │            │             │
    │            ├─────────────┤
    │            │             │
    │            ▼             ▼
    │       Rigor-Rewrite   Adversary ─┬─ [Panel Mode]
    │            │             │       │   GPT-5 ──────┐
    │            │             │       │   Gemini-3 ───┼─→ Reconcile → votes 1/2/3
    │            │             │       │   Opus ───────┘
    └────────────┴─────────────┘
                     │
                     ▼
               Assembler (deterministic dedup)
                     │
                     ▼
               ReviewOutput + AgentMetrics
                     │
                     ▼
               Dev Banner (ReviewScreen)
```

---

## Agent Specifications

### Briefing Agent
- **Purpose**: Extract document context for downstream agents
- **Model**: Sonnet
- **Input**: DocObj
- **Output**: BriefingOutput (summary, claims, scope, limitations)
- **Timing**: ~2-3s

### Clarity Agent
- **Purpose**: Find writing/flow/grammar issues
- **Model**: Sonnet
- **Chunking**: Word-based (~1200 words per chunk)
- **Context Overlap**: 3 sentences before/after marked as `[CONTEXT ONLY - DO NOT CRITIQUE]`
- **Parallelization**: All chunks run in parallel
- **Output**: list[Finding] with category `clarity_*`

### Rigor Agent (2-Phase)
- **Purpose**: Find methodology/logic issues, then generate fixes

**Phase 1: Rigor-Find**
- **Model**: Sonnet
- **Chunking**: Section-aware (by section_id)
- **Context Overlap**: 3 sentences before/after as context
- **Output**: list[RigorFinding] (problems without rewrites)

**Phase 2: Rigor-Rewrite**
- **Model**: Sonnet
- **Input**: Rigor-Find output
- **Runs**: Parallel with Adversary (only needs Rigor-Find, not Domain)
- **Output**: list[Finding] with proposed_edit populated

### Domain Pipeline
- **Purpose**: Gather external evidence as ammunition for Adversary
- **4 Stages**: TargetExtractor → QueryGenerator → SearchExecutor → EvidenceSynthesizer

| Stage | Model | Purpose |
|-------|-------|---------|
| TargetExtractor | Sonnet | Extract claims, methods, study design limitations |
| QueryGenerator | Sonnet | Generate 4-6 search queries with rationale |
| SearchExecutor | Perplexity Sonar | Execute searches, collect citations |
| EvidenceSynthesizer | Sonnet | Categorize into EvidencePack buckets |

- **Output**: EvidencePack (design_limitations, contradictions, prior_work, etc.)

### Adversary Agent
- **Purpose**: "Reviewer 2" - hostile expert critique
- **Input**: Briefing + Rigor-Find findings + EvidencePack
- **Model**: Opus (single) or Panel Mode

**Panel Mode** (user-selected):
- Runs 3 frontier models in parallel: GPT-5, Gemini-3, Opus
- Reconciliation agent merges similar concerns
- Each issue tagged with vote count (1, 2, or 3)
- Issues with 3 votes = high confidence critical issues

- **Output**: list[Finding] with category `adversarial_*`, optional `votes` field

### Assembler
- **Purpose**: Deterministic deduplication and sorting
- **No LLM**: Pure logic
- **Priority**: Adversary (1) > Rigor (2) > Clarity (3)
- **Output Order**: Clarity → Rigor → Adversary (presentation)

---

## Chunking Specifications

### Clarity Chunking (Word-Based)

```python
def chunk_for_clarity(doc: DocObj, target_words: int = 1200) -> list[ClarityChunk]:
    """
    Chunk document by word count, respecting paragraph boundaries.
    Each chunk includes 3-sentence context overlap.
    """
    chunks = []
    current_chunk_paragraphs = []
    current_word_count = 0
    
    for para in doc.paragraphs:
        para_words = len(para.text.split())
        
        if current_word_count + para_words > target_words and current_chunk_paragraphs:
            # Finalize chunk
            chunks.append(build_chunk(current_chunk_paragraphs, doc))
            current_chunk_paragraphs = []
            current_word_count = 0
        
        current_chunk_paragraphs.append(para)
        current_word_count += para_words
    
    # Don't forget last chunk
    if current_chunk_paragraphs:
        chunks.append(build_chunk(current_chunk_paragraphs, doc))
    
    return chunks

def build_chunk(paragraphs: list[Paragraph], doc: DocObj) -> ClarityChunk:
    """Build chunk with 3-sentence context before and after."""
    first_para_idx = doc.paragraphs.index(paragraphs[0])
    last_para_idx = doc.paragraphs.index(paragraphs[-1])
    
    # Get 3 sentences before (from previous paragraphs)
    context_before = get_last_n_sentences(doc.paragraphs[:first_para_idx], n=3)
    
    # Get 3 sentences after (from following paragraphs)
    context_after = get_first_n_sentences(doc.paragraphs[last_para_idx+1:], n=3)
    
    return ClarityChunk(
        paragraphs=paragraphs,
        context_before=context_before,  # Marked [CONTEXT ONLY]
        context_after=context_after,    # Marked [CONTEXT ONLY]
    )
```

### Rigor Chunking (Section-Aware)

```python
def chunk_for_rigor(doc: DocObj) -> list[RigorChunk]:
    """
    Chunk document by section for rigor analysis.
    Each section becomes one chunk with context overlap.
    """
    chunks = []
    
    for section in doc.sections:
        section_paras = [p for p in doc.paragraphs if p.section_id == section.section_id]
        
        # Get context from adjacent sections
        section_idx = doc.sections.index(section)
        
        context_before = []
        if section_idx > 0:
            prev_section = doc.sections[section_idx - 1]
            prev_paras = [p for p in doc.paragraphs if p.section_id == prev_section.section_id]
            context_before = get_last_n_sentences(prev_paras, n=3)
        
        context_after = []
        if section_idx < len(doc.sections) - 1:
            next_section = doc.sections[section_idx + 1]
            next_paras = [p for p in doc.paragraphs if p.section_id == next_section.section_id]
            context_after = get_first_n_sentences(next_paras, n=3)
        
        chunks.append(RigorChunk(
            section=section,
            paragraphs=section_paras,
            context_before=context_before,
            context_after=context_after,
        ))
    
    return chunks
```

---

## Global Configuration

### config/models.py

```python
"""
Central model registry and cost tracking.
All agent-to-model mappings live here.
"""

from typing import Literal
from pydantic import BaseModel


class ModelCost(BaseModel):
    """Cost per 1M tokens."""
    input: float
    output: float


# Model cost registry (USD per 1M tokens)
MODEL_COSTS: dict[str, ModelCost] = {
    # Anthropic
    "claude-opus-4": ModelCost(input=15.0, output=75.0),
    "claude-sonnet-4": ModelCost(input=3.0, output=15.0),
    # OpenAI
    "gpt-5": ModelCost(input=10.0, output=30.0),  # TBD - placeholder
    # Google
    "gemini-3-opus": ModelCost(input=10.0, output=30.0),  # TBD - placeholder
    # Perplexity
    "perplexity-sonar": ModelCost(input=1.0, output=1.0),
    "perplexity-sonar-pro": ModelCost(input=3.0, output=15.0),
}


# Agent to model mapping
AGENT_MODELS: dict[str, str] = {
    # Briefing
    "briefing": "claude-sonnet-4",
    
    # Clarity
    "clarity": "claude-sonnet-4",
    
    # Rigor
    "rigor_find": "claude-sonnet-4",
    "rigor_rewrite": "claude-sonnet-4",
    
    # Domain pipeline
    "domain_target_extractor": "claude-sonnet-4",
    "domain_query_generator": "claude-sonnet-4",
    "domain_search": "perplexity-sonar",
    "domain_evidence_synthesizer": "claude-sonnet-4",
    
    # Adversary
    "adversary": "claude-opus-4",
    "adversary_reconcile": "claude-sonnet-4",
    
    # Panel mode models (used when panel_mode=True)
    "adversary_panel_1": "gpt-5",
    "adversary_panel_2": "gemini-3-opus",
    "adversary_panel_3": "claude-opus-4",
}


def get_model(agent_id: str) -> str:
    """Get model name for an agent."""
    return AGENT_MODELS.get(agent_id, "claude-sonnet-4")


def get_cost(model: str) -> ModelCost:
    """Get cost structure for a model."""
    return MODEL_COSTS.get(model, ModelCost(input=3.0, output=15.0))


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate USD cost for a call."""
    cost = get_cost(model)
    return (input_tokens * cost.input / 1_000_000) + (output_tokens * cost.output / 1_000_000)
```

---

## Agent Metrics Collection

### models/metrics.py

```python
"""
Metrics collection for dev banner display.
Every agent call produces AgentMetrics.
Orchestrator aggregates into ReviewMetrics.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class AgentMetrics(BaseModel):
    """Metrics from a single agent call."""
    agent_id: str
    model: str
    input_tokens: int
    output_tokens: int
    time_ms: float
    cost_usd: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Optional chunk info for parallelized agents
    chunk_index: int | None = None
    chunk_total: int | None = None


class ReviewMetrics(BaseModel):
    """Aggregated metrics for entire review - displayed in dev banner."""
    agent_metrics: list[AgentMetrics] = Field(default_factory=list)
    
    # Computed summaries
    total_time_ms: float = 0
    total_cost_usd: float = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    
    def add(self, metrics: AgentMetrics) -> None:
        """Add agent metrics and update totals."""
        self.agent_metrics.append(metrics)
        self.total_time_ms += metrics.time_ms
        self.total_cost_usd += metrics.cost_usd
        self.total_input_tokens += metrics.input_tokens
        self.total_output_tokens += metrics.output_tokens
    
    def by_agent(self) -> dict[str, dict]:
        """Group metrics by agent for dev banner display."""
        result = {}
        for m in self.agent_metrics:
            if m.agent_id not in result:
                result[m.agent_id] = {
                    "model": m.model,
                    "calls": 0,
                    "time_ms": 0,
                    "cost_usd": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                }
            result[m.agent_id]["calls"] += 1
            result[m.agent_id]["time_ms"] += m.time_ms
            result[m.agent_id]["cost_usd"] += m.cost_usd
            result[m.agent_id]["input_tokens"] += m.input_tokens
            result[m.agent_id]["output_tokens"] += m.output_tokens
        return result
    
    def to_dev_banner(self) -> dict:
        """Format for frontend dev banner."""
        return {
            "total": {
                "time_s": round(self.total_time_ms / 1000, 2),
                "cost_usd": round(self.total_cost_usd, 4),
                "tokens": self.total_input_tokens + self.total_output_tokens,
            },
            "agents": self.by_agent(),
        }
```

---

## Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI app
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py             # Environment config
│   │   └── models.py               # MODEL_COSTS, AGENT_MODELS
│   │
│   ├── models/                     # Pydantic models
│   │   ├── __init__.py
│   │   ├── document.py             # DocObj, Paragraph, Section
│   │   ├── finding.py              # Finding, Anchor, ProposedEdit
│   │   ├── briefing.py             # BriefingOutput
│   │   ├── domain.py               # EvidencePack, SearchPriority, etc.
│   │   ├── review.py               # ReviewConfig, ReviewJob
│   │   ├── metrics.py              # AgentMetrics, ReviewMetrics
│   │   ├── chunks.py               # ClarityChunk, RigorChunk
│   │   └── events.py               # SSE event types
│   │
│   ├── composer/                   # Prompt management
│   │   ├── __init__.py
│   │   ├── library.py              # All prompt templates
│   │   └── builder.py              # Renders prompts with context
│   │
│   ├── agents/                     # LLM agents
│   │   ├── __init__.py
│   │   ├── base.py                 # BaseAgent with metrics collection
│   │   ├── briefing.py
│   │   ├── clarity.py              # Parallelized by chunk
│   │   ├── rigor/
│   │   │   ├── __init__.py
│   │   │   ├── finder.py           # Rigor-Find (parallelized by section)
│   │   │   └── rewriter.py         # Rigor-Rewrite
│   │   ├── adversary/
│   │   │   ├── __init__.py
│   │   │   ├── single.py           # Single-model adversary
│   │   │   ├── panel.py            # Panel mode (3 models)
│   │   │   └── reconcile.py        # Merge + vote counting
│   │   └── domain/
│   │       ├── __init__.py
│   │       ├── target_extractor.py
│   │       ├── query_generator.py
│   │       ├── search_executor.py  # Perplexity client
│   │       └── evidence_synthesizer.py
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── orchestrator.py         # Pipeline runner
│   │   ├── assembler.py            # Deterministic dedup
│   │   ├── chunker.py              # Word/section chunking
│   │   ├── fixture_loader.py       # Demo doc loader
│   │   └── exporter.py             # DOCX export
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── health.py
│   │       ├── review.py           # SSE streaming endpoint
│   │       └── export.py
│   │
│   └── core/
│       ├── __init__.py
│       ├── llm.py                  # Instructor client with metrics
│       └── perplexity.py           # Perplexity API client
│
├── tests/
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│       ├── demo_doc.json
│       └── demo_review.json
│
├── pyproject.toml
└── .env.example
```

---

## Build Phases

### Phase 1: Foundation
- Project setup, dependencies
- Pydantic models (all)
- Global config (models.py)
- Fixture loader

### Phase 2: Metrics & Base Agent
- AgentMetrics, ReviewMetrics models
- BaseAgent with automatic metrics collection
- LLM client wrapper that captures tokens

### Phase 3: Composer
- Prompt library (all templates)
- Prompt builder

### Phase 4: Chunker
- Word-based chunking for Clarity
- Section-aware chunking for Rigor
- Context overlap (3 sentences)

### Phase 5: Briefing Agent
- First working agent
- Verify metrics collection

### Phase 6: Clarity Agent
- Parallel chunk processing
- Merge chunk results

### Phase 7: Rigor Agents
- Rigor-Find (parallel by section)
- Rigor-Rewrite (parallel, after Find)

### Phase 8: Domain Pipeline
- TargetExtractor
- QueryGenerator
- SearchExecutor (Perplexity)
- EvidenceSynthesizer

### Phase 9: Adversary
- Single-model adversary
- Panel mode (3 models)
- Reconciliation + vote counting

### Phase 10: Assembler
- Deduplication logic
- Priority rules
- Output sorting

### Phase 11: Orchestrator
- Full pipeline coordination
- Parallel execution
- Metrics aggregation

### Phase 12: SSE Infrastructure
- Event types
- Streaming endpoint
- Frontend integration

### Phase 13: Export
- DOCX with track changes
- Dev banner data included

### Phase 14: Parsing (LAST)
- PDF parser
- DOCX parser
- Indexer (creates DocObj)

---

## Success Criteria

1. All tests pass
2. Pipeline processes demo doc end-to-end
3. Dev banner shows accurate cost/time per agent
4. Panel mode produces vote counts
5. Frontend displays findings correctly
6. SSE streams events in real-time
