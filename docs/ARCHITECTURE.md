# System Architecture

Deep-dive into ZORRO's technical architecture, data flow, and design decisions.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│                         React + Vite + Tailwind                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐    │
│  │  Upload  │→ │  Setup   │→ │ Process  │→ │  Review Workspace        │    │
│  │  Screen  │  │  Screen  │  │  Screen  │  │  (includes export button)│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────────┘    │
│       │             │             │              │                          │
│       └─────────────┴──────┬──────┴──────────────┘                          │
│                            │                                                 │
│                     Axios + SSE Client                                       │
└────────────────────────────┼─────────────────────────────────────────────────┘
                             │ HTTP/SSE
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│                         FastAPI + Pydantic v2                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ POST /document  │  │ POST /review    │  │ POST /export    │             │
│  │      /parse     │  │      /start     │  │                 │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      SERVICE LAYER                               │       │
│  │  ┌──────────┐  ┌─────────────┐  ┌───────────┐  ┌────────────┐  │       │
│  │  │  Parser  │  │ Orchestrator│  │ Assembler │  │  Exporter  │  │       │
│  │  │ Service  │  │   Service   │  │ (dedup)   │  │  Service   │  │       │
│  │  └──────────┘  └──────┬──────┘  └───────────┘  └────────────┘  │       │
│  │                       │                                         │       │
│  │  ┌────────────────────┴────────────────────┐                   │       │
│  │  │              Composer                    │                   │       │
│  │  │  (Deterministic prompt builder)         │                   │       │
│  │  └─────────────────────────────────────────┘                   │       │
│  └──────────────────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ANALYSIS ENGINE                                    │
│                     (Using Instructor for structured outputs)                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         BRIEFING                                     │   │
│  │              (Summary, scope, limitations extraction)                │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                               │
│         ┌───────────────────┼───────────────────┐                          │
│         │                   │                   │                          │
│         ▼                   ▼                   ▼                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐    │
│  │  TRACK A    │    │  TRACK B    │    │         TRACK C              │    │
│  │  Clarity    │    │   Rigor     │    │         Domain               │    │
│  │  (Writing)  │    │ (Internal)  │    │       (External)             │    │
│  │             │    │             │    │  ┌─────────────────────┐    │    │
│  │ - Local     │    │ - Detection │    │  │ 1. Argument Finder  │    │    │
│  │ - Global    │    │ - Revision  │    │  │ 2. Query Generator  │    │    │
│  │             │    │             │    │  │ 3. Search Executor  │    │    │
│  │             │    │             │    │  │ 4. Fact Synthesizer │    │    │
│  │             │    │             │    │  └──────────┬──────────┘    │    │
│  │             │    │             │    │             │               │    │
│  │             │    │             │    │      Factual Package        │    │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┬───────────────┘    │
│         │                  │                         │                     │
│         │                  └────────────┬────────────┘                     │
│         │                               │                                  │
│         │                               ▼                                  │
│         │                  ┌─────────────────────────┐                     │
│         │                  │       ADVERSARY         │                     │
│         │                  │  (Argument teardown)    │                     │
│         │                  │                         │                     │
│         │                  │  Inputs:                │                     │
│         │                  │  - Rigor findings       │                     │
│         │                  │  - Domain factual pkg   │                     │
│         │                  └────────────┬────────────┘                     │
│         │                               │                                  │
│         └───────────────────────────────┤                                  │
│                                         │                                  │
│                                         ▼                                  │
│                          ┌─────────────────────────────┐                   │
│                          │         ASSEMBLER           │                   │
│                          │   (Deterministic dedup)     │                   │
│                          │                             │                   │
│                          │   Priority order:           │                   │
│                          │   1. Adversary (highest)    │                   │
│                          │   2. Rigor                  │                   │
│                          │   3. Clarity (lowest)       │                   │
│                          └─────────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Three-Track Pipeline

The analysis engine runs three parallel tracks after briefing:

```
                              BRIEFING
                                 │
                                 │ (summary, scope, limitations)
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
   ┌─────────┐              ┌─────────┐              ┌─────────┐
   │ TRACK A │              │ TRACK B │              │ TRACK C │
   │ Writing │              │ Thinking│              │ External│
   │         │              │ (Int.)  │              │ (Ext.)  │
   └────┬────┘              └────┬────┘              └────┬────┘
        │                        │                        │
        │                        │                        │
   ┌────┴────┐              ┌────┴────┐              ┌────┴────┐
   │ Clarity │              │  Rigor  │              │ Domain  │
   │Inspector│              │Inspector│              │Validator│
   └────┬────┘              └────┬────┘              └────┬────┘
        │                        │                        │
        │                        │    Factual Package     │
        │                        │◄───────────────────────┤
        │                        │                        │
        │                   ┌────┴────┐                   │
        │                   │Adversary│◄──────────────────┘
        │                   │ Critic  │
        │                   └────┬────┘
        │                        │
        └────────────┬───────────┘
                     │
                     ▼
              ┌─────────────┐
              │  ASSEMBLER  │
              │             │
              │ C > B > A   │
              └─────────────┘
```

### Track A: Clarity (Writing)
- **Purpose**: Surface readability, flow, and structural issues
- **Input**: Briefing context
- **Model**: Haiku (standard), Sonnet (deep)
- **Priority**: Lowest (3rd) — style issues deferred to substance

### Track B: Rigor (Internal Thinking)
- **Purpose**: Find methodological and logical problems
- **Input**: Briefing context
- **Components**:
  1. Detection pass
  2. Revision pass
- **Model**: Sonnet (standard), Opus (deep)
- **Output**: Feeds into Adversary
- **Priority**: Medium (2nd)

### Track C: Domain (External Search)
- **Purpose**: Validate claims against external knowledge
- **Input**: Document directly (starts immediately, no briefing dependency)
- **Components**:
  1. **Argument Finder** — Break down document, identify key claims
  2. **Query Generator** — Generate search queries for validation
  3. **Search Executor** — Run Perplexity searches
  4. **Fact Synthesizer** — Compile factual package
- **Model**: Perplexity (sonar/sonar-pro)
- **Output**: Factual package → feeds into Adversary

### Adversary (Convergence Point)
- **Purpose**: Tear apart the argument, find fatal flaws
- **Inputs**: 
  - Rigor findings (Track B)
  - Factual package (Track C)
- **Model**: Sonnet (standard), Opus (deep)
- **Priority**: Highest (1st) — most substantive critiques

---

## Component Details

### Briefing Agent

First agent to run. Extracts context for downstream agents.

```python
class BriefingOutput(BaseModel):
    summary: str                    # Document summary
    main_claims: list[str]          # Primary assertions
    stated_scope: str | None        # Explicit scope
    stated_limitations: list[str]   # Acknowledged limitations
    methodology_summary: str | None # Approach overview
    domain_keywords: list[str]      # Field-specific terms
```

**Consumers**:
- Clarity Inspector (for context-aware writing feedback)
- Rigor Inspector (to avoid re-flagging acknowledged limitations)

### Domain Validator Pipeline

Four-stage pipeline for external validation:

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOMAIN VALIDATOR                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                            │
│  │ 1. ARGUMENT     │  What is this document really about?       │
│  │    FINDER       │  What are the key claims?                  │
│  │                 │  What would need external validation?      │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 2. QUERY        │  Generate specific search queries          │
│  │    GENERATOR    │  - Fact-check queries                      │
│  │                 │  - Convention queries                      │
│  │                 │  - Terminology queries                     │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 3. SEARCH       │  Execute queries via Perplexity            │
│  │    EXECUTOR     │  - Parallel execution                      │
│  │                 │  - Rate limiting                           │
│  │                 │  - Citation extraction                     │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 4. FACT         │  Compile findings into factual package     │
│  │    SYNTHESIZER  │  - Contradictions found                    │
│  │                 │  - Confirmations found                     │
│  │                 │  - Conventions violated                    │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   FACTUAL PACKAGE                        │    │
│  │  - Validated claims (with sources)                      │    │
│  │  - Contradicted claims (with sources)                   │    │
│  │  - Convention violations                                │    │
│  │  - Terminology issues                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│                      To: ADVERSARY                               │
└─────────────────────────────────────────────────────────────────┘
```

### Adversary Agent

The convergence point that receives inputs from Rigor and Domain:

```python
class AdversaryInput(BaseModel):
    doc: DocObj
    briefing: BriefingOutput
    rigor_findings: list[Finding]
    factual_package: FactualPackage

class FactualPackage(BaseModel):
    validated_claims: list[ValidatedClaim]
    contradicted_claims: list[ContradicatedClaim]
    convention_violations: list[ConventionViolation]
    terminology_issues: list[TerminologyIssue]
```

**Adversary's job**:
- Use Rigor findings to identify internal weaknesses
- Use Factual Package to identify external contradictions
- Synthesize into highest-priority findings
- Act as "Reviewer 2" — the skeptical expert

### Assembler (Deterministic Deduplication)

Non-LLM component that merges findings with priority rules:

```python
class Assembler:
    """
    Deterministic deduplication with track priority.
    
    Priority (highest to lowest):
    1. Track C: Adversary findings
    2. Track B: Rigor findings  
    3. Track A: Clarity findings
    
    Presentation order (to user) is reversed:
    Clarity → Rigor → Adversary
    """
    
    TRACK_PRIORITY = {
        "adversary": 1,    # Highest
        "rigor": 2,
        "clarity": 3,      # Lowest
    }
    
    def assemble(self, findings: list[Finding]) -> list[Finding]:
        # Group by anchor overlap
        # When overlap detected:
        #   - Keep finding from higher-priority track
        #   - Merge descriptions if meaningfully different
        # Sort for presentation: Clarity → Rigor → Adversary
        ...
```

### Composer (Prompt Builder)

Deterministic prompt construction from a library:

```python
class Composer:
    """
    Builds prompts from template library.
    No LLM calls — pure string construction.
    """
    
    def __init__(self, prompt_library: PromptLibrary):
        self.library = prompt_library
    
    def compose_briefing_prompt(self, doc: DocObj, config: ReviewConfig) -> str:
        template = self.library.get("briefing", config.tier)
        return template.format(
            document_text=self._prepare_doc_text(doc),
            section_list=self._format_sections(doc),
            domain_hint=config.domain_hint or "",
        )
    
    def compose_clarity_prompt(self, doc: DocObj, briefing: BriefingOutput) -> str:
        ...
    
    def compose_adversary_prompt(
        self, 
        doc: DocObj, 
        rigor_findings: list[Finding],
        factual_package: FactualPackage
    ) -> str:
        ...
```

---

## Instructor Integration

All LLM outputs are structured using [Instructor](https://github.com/jxnl/instructor):

```python
import instructor
from anthropic import Anthropic

client = instructor.from_anthropic(Anthropic())

class ClarityFindings(BaseModel):
    findings: list[Finding]

# Structured output with validation
response = client.messages.create(
    model="claude-3-haiku-20240307",
    max_tokens=4096,
    messages=[{"role": "user", "content": prompt}],
    response_model=ClarityFindings,
)

# response is already a ClarityFindings instance
```

### Validation Fallback

Instructor includes retry logic, but we add a fallback validator:

```python
from instructor import Maybe

class ValidatedFinding(BaseModel):
    """Finding with validation rules"""
    
    @field_validator('anchors')
    @classmethod
    def anchors_not_empty(cls, v):
        if not v:
            raise ValueError("Finding must have at least one anchor")
        return v
    
    @field_validator('anchors')
    @classmethod
    def quoted_text_exists(cls, v):
        for anchor in v:
            if not anchor.quoted_text.strip():
                raise ValueError("Anchor must have quoted text")
        return v

# Use Maybe for graceful failure
response = client.messages.create(
    ...,
    response_model=Maybe[ClarityFindings],
)

if response.result is None:
    logger.warning("instructor_validation_failed", error=response.error)
    # Fallback: parse raw response manually
```

---

## Execution Flow

### Full Pipeline Execution

```
1. PARSE
   └── Document → DocObj

2. START REVIEW
   └── Create ReviewJob
   └── Launch background task

3. BRIEFING (blocking)
   └── Briefing agent runs
   └── Produces BriefingOutput

4. PARALLEL TRACKS (concurrent)
   │
   ├── Track A: Clarity
   │   └── Input: DocObj + BriefingOutput
   │   └── Output: list[Finding]
   │
   ├── Track B: Rigor
   │   └── Input: DocObj + BriefingOutput
   │   └── Output: list[Finding] → to Adversary
   │
   └── Track C: Domain (STARTS IMMEDIATELY - no briefing wait)
       └── Input: DocObj
       └── 4 substages
       └── Output: FactualPackage → to Adversary

5. ADVERSARY (waits for B + C)
   └── Input: Rigor findings + Factual package
   └── Output: list[Finding]

6. ASSEMBLER (after all complete)
   └── Input: All findings from all tracks
   └── Deduplicate with priority: C > B > A
   └── Output: Final list[Finding]

7. COMPLETE
   └── Store findings
   └── Emit review_completed event
```

### Timing Diagram

```
Time →
─────────────────────────────────────────────────────────────────────►

│ Parse │ Briefing │
        │          │
        │          ├─── Clarity ────────────────────────────┐
        │          │                                        │
        │          └─── Rigor ──────────────┐               │
        │                                   │               │
        └─ Domain ──────────────────────────┤               │
           (starts immediately)             │               │
                                            ▼               │
                                     ┌─ Adversary ─┐        │
                                     └─────────────┘        │
                                            │               │
                                            └───────┬───────┘
                                                    │
                                                    ▼
                                              ┌─ Assembler ─┐
                                              └─────────────┘
                                                    │
                                                    ▼
                                                Complete
```

---

## Data Flow Details

### DocObj Immutability

```
DocObj created at parse time
         │
         │  NEVER MODIFIED
         │
         ▼
    ┌─────────┐
    │ DocObj  │──────────────────────────────────────┐
    │         │                                       │
    │ - id    │    Read by all agents                │
    │ - paras │    Referenced by all findings        │
    │ - sents │    Used for export mapping           │
    └─────────┘                                       │
         │                                            │
         └────────────────────────────────────────────┘
```

### Finding Anchor Chain

```
Finding
├── anchors[]
│   ├── Anchor
│   │   ├── paragraph_id: "p_023"  ──────► DocObj.paragraphs[22]
│   │   ├── sentence_id: "p_023_s_002" ──► DocObj.paragraphs[22].sentences[1]
│   │   └── quoted_text: "exact text" ───► Must match actual text
│   └── ...
└── proposed_edit
    └── anchor ──────────────────────────► Same reference system
```

---

## Export Architecture

Export is triggered by a button in the Review Workspace (not a separate screen):

```
┌─────────────────────────────────────────┐
│         REVIEW WORKSPACE                 │
│                                          │
│  ┌────────────────┐  ┌────────────────┐ │
│  │ Document View  │  │ Findings Panel │ │
│  │                │  │                │ │
│  │                │  │                │ │
│  └────────────────┘  └────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  [Download Reviewed Document ▼]    │ │  ◄── Export button
│  │    ○ Include unresolved as comments│ │
│  │    Author: [ZORRO Review      ]    │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
         │
         │ Click "Download"
         ▼
┌─────────────────────────────────────────┐
│           EXPORT SERVICE                 │
│                                          │
│  1. Collect decisions                    │
│  2. Map findings → document locations    │
│  3. Apply tracked changes for accepts    │
│  4. Add comments for unresolved          │
│  5. Generate DOCX with python-docx       │
│  6. Return file for download             │
└─────────────────────────────────────────┘
```

---

## Error Handling Strategy

### Agent Failure Isolation

```python
async def run_track_a(doc: DocObj, briefing: BriefingOutput) -> list[Finding]:
    try:
        return await clarity_inspector.analyze(doc, briefing)
    except Exception as e:
        logger.error("track_a_failed", error=str(e))
        emit_event(ErrorEvent(
            message="Clarity analysis failed",
            recoverable=True
        ))
        return []  # Continue with other tracks
```

### Graceful Degradation

| Failure | Impact | Behavior |
|---------|--------|----------|
| Briefing fails | All tracks affected | Abort review, show error |
| Clarity fails | Track A missing | Continue, note incomplete |
| Rigor fails | Track B + Adversary affected | Continue with Domain only |
| Domain fails | Adversary has partial input | Adversary runs with Rigor only |
| Adversary fails | Missing highest-priority findings | Continue with B + A |
| Assembler fails | Cannot deduplicate | Return raw findings |

---

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...

# Optional
LOG_LEVEL=INFO
MAX_DOCUMENT_PAGES=100
MAX_CONCURRENT_AGENTS=4

# Model overrides (for testing)
BRIEFING_MODEL=claude-3-sonnet-20240229
CLARITY_MODEL=claude-3-haiku-20240307
RIGOR_MODEL=claude-3-sonnet-20240229
ADVERSARY_MODEL=claude-3-sonnet-20240229
```

### Review Tiers

| Component | Standard | Deep |
|-----------|----------|------|
| Briefing | Sonnet | Opus |
| Clarity | Haiku | Sonnet |
| Rigor | Sonnet | Opus |
| Domain | Sonar | Sonar-Pro |
| Adversary | Sonnet | Opus |
