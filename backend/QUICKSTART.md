# ZORRO Backend v2 - Quick Start

Read this first.

---

## What's Different in v2

| Component | v1 (Wrong) | v2 (Correct) |
|-----------|------------|--------------|
| Clarity | Single pass | Chunked (1200 words) + 3-sentence context overlap |
| Rigor | Single agent | 2-phase: Find → Rewrite (parallel with Adversary) |
| Domain | After Briefing | Parallel with Briefing |
| Adversary | Single model | Panel mode option: 3 models → reconcile → votes |
| Config | Scattered | Global registry (models.py) |
| Metrics | None | Every call tracked → dev banner |
| Dev Banner | Export | ReviewScreen (collapsible) |

---

## Pipeline Flow

```
Document
    │
    ├─────────────────────────┐
    ▼                         ▼
Briefing                  Domain (4-stage)
    │                         │
    ▼                         │
    ├────────┐                │
    ▼        ▼                │
Clarity   Rigor-Find          │
(chunks)  (sections)          │
    │        │                │
    │        ├────────────────┤
    │        │                │
    │        ▼                ▼
    │   Rigor-Rewrite    Adversary ─── [Panel: 3 models → reconcile]
    │        │                │
    └────────┴────────────────┘
                   │
                   ▼
             Assembler (dedup)
                   │
                   ▼
             Output + DevBanner
```

---

## Files in This Kit

```
docs/
├── 00_MASTER_BUILD.md      # Architecture overview
├── 01_PYDANTIC_MODELS.md   # All models (copy exactly)
├── 02_GLOBAL_CONFIG.md     # Model registry, costs
├── 03_COMPOSER_PROMPTS.md  # All prompts
├── 04_CORE_INFRASTRUCTURE.md # LLM client, chunker
└── 05_TDD_TESTS.md         # Test specs

prompts/
└── IMPLEMENTATION_PROMPTS.md # What to give Claude
```

---

## Build Order

1. **Project setup** - skeleton
2. **Models** - Pydantic (camelCase!)
3. **Config** - model registry
4. **Core** - LLM client with metrics, Perplexity client, chunker
5. **Composer** - prompts
6. **Agents** - Briefing → Clarity → Rigor → Domain → Adversary
7. **Assembler** - dedup logic
8. **Orchestrator** - pipeline
9. **API** - endpoints
10. **SSE** - streaming (last)

---

## Critical Things

### 1. camelCase Output
```json
{"agentId": "clarity", "proposedEdit": {"newText": "..."}}
```
NOT `agent_id`, `proposed_edit`, `new_text`

### 2. Context Overlap
Chunks include 3 sentences before/after marked:
```
[CONTEXT ONLY - DO NOT CRITIQUE: Previous sentences here.]
```
Agents must NOT flag issues in context-only text.

### 3. Metrics Collection
Every LLM call returns `(response, AgentMetrics)`.
Orchestrator aggregates into `ReviewMetrics.to_dev_banner()`.

### 4. Panel Mode Votes
When `panel_mode=True`:
- 3 models run in parallel
- Similar findings merged
- `votes: 1|2|3` shows agreement level

### 5. Assembler Priority
```
Adversary (1) > Rigor/Domain (2) > Clarity (3)
```
Presentation order reversed: Clarity → Rigor → Adversary

---

## Environment

```bash
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
OPENAI_API_KEY=sk-...      # Panel mode
GOOGLE_API_KEY=...          # Panel mode
```

---

## Quick Test

```bash
cd backend
pip install -e ".[dev]"
pytest tests/unit -v
```

---

## Done When

1. `pytest` passes
2. Pipeline runs on demo doc
3. Dev banner shows cost/time per agent
4. Panel mode produces vote counts
5. Frontend displays findings correctly
