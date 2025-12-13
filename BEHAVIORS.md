# Agent Behaviors Specification

This document defines the exact behavior, constraints, and output expectations for each ZORRO agent.

---

## General Agent Principles

### Independence
- Agents NEVER share mutable state
- Each agent receives a read-only DocObj
- Each agent returns a list of Findings
- Agents may receive a read-only ContextSnapshot from the Context Builder

### Grounding Requirement
- EVERY finding MUST have at least one anchor
- Anchors MUST quote actual text from the document
- Anchors MUST have valid paragraph/sentence IDs
- NO findings without text references are allowed

### Confidence Scores
- 0.0-0.5: Low confidence — only include if significant issue
- 0.5-0.7: Moderate confidence — include with caveats
- 0.7-0.9: High confidence — reliable finding
- 0.9-1.0: Very high confidence — near-certain issue

### Severity Assignment

| Severity | Criteria | Action Required |
|----------|----------|-----------------|
| Critical | Blocks publication/acceptance | Must address |
| Major | Significantly weakens work | Should address |
| Minor | Improves but not essential | Consider addressing |
| Suggestion | Enhancement opportunity | Optional |

---

## Context Builder

**Purpose**: Extract claims, scope, and limitations. Produce ContextSnapshot for other agents.

**Model**: Sonnet (standard), Opus (deep)

**Runs**: First, before all other agents

### Inputs
- DocObj
- ReviewConfig (for domain_hint)

### Outputs
- list[Finding]
- ContextSnapshot

### Analysis Tasks

1. **Main Claims Extraction**
   - Identify 3-7 primary claims
   - Focus on Abstract, Introduction conclusions
   - Capture what the document asserts as contributions

2. **Scope Identification**
   - What does the work explicitly cover?
   - What does it explicitly exclude?
   - What are the boundaries?

3. **Limitations Extraction**
   - Explicit limitations stated by authors
   - Caveats and qualifications
   - Acknowledged weaknesses

4. **Methodology Summary**
   - High-level approach
   - Key methods used
   - Data sources

5. **Domain Keywords**
   - Field-specific terminology
   - Technical terms
   - Used by Domain Validator for searches

### Finding Types

| Category | When to Generate |
|----------|------------------|
| scope_overclaim | Claim exceeds what evidence supports |
| scope_underclaim | Unnecessarily weak claim given evidence |
| scope_missing | Important scope boundary not defined |

### Example Findings

```json
{
  "category": "scope_overclaim",
  "severity": "major",
  "title": "Generalization beyond study population",
  "description": "The claim that results 'apply to all age groups' is not supported. The study only included participants aged 25-45.",
  "anchors": [{
    "paragraphId": "p_003",
    "sentenceId": "p_003_s_002",
    "quotedText": "These findings apply to all age groups"
  }],
  "confidence": 0.85
}
```

---

## Clarity Inspector

**Purpose**: Identify readability, flow, and structural issues.

**Model**: Haiku (standard), Sonnet (deep)

**Runs**: After Context Builder (uses ContextSnapshot)

### Analysis Passes

#### Pass 1: Local (Sentence/Paragraph)

Check each paragraph for:
- **Sentence clarity**: Ambiguous pronouns, unclear referents, convoluted syntax
- **Jargon density**: Undefined technical terms, acronym soup
- **Passive voice**: Excessive passive constructions obscuring agency
- **Paragraph structure**: Missing topic sentences, unfocused paragraphs
- **Sentence length**: Overly long sentences (>40 words)

#### Pass 2: Global (Section/Document)

Check document structure for:
- **Section coherence**: Do paragraphs within a section belong together?
- **Transitions**: Are there logical connectors between sections?
- **Flow**: Does the argument progress logically?
- **Redundancy**: Is content unnecessarily repeated?
- **Missing links**: Are there gaps in the logical chain?

### Finding Types

| Category | Description | Typical Severity |
|----------|-------------|------------------|
| clarity_sentence | Single sentence issues | minor/suggestion |
| clarity_paragraph | Paragraph-level problems | minor/major |
| clarity_section | Section organization | major |
| clarity_flow | Document-wide flow issues | major |

### When to Include ProposedEdit

ALWAYS attempt a proposed edit for:
- clarity_sentence (rewrite the sentence)
- clarity_paragraph (rewrite topic sentence or restructure)

For section/flow issues, describe the fix but don't rewrite entire sections.

### Example Finding

```json
{
  "category": "clarity_sentence",
  "severity": "minor",
  "title": "Ambiguous pronoun reference",
  "description": "The pronoun 'it' could refer to either 'the model' or 'the dataset'. Clarify which is intended.",
  "anchors": [{
    "paragraphId": "p_015",
    "sentenceId": "p_015_s_003",
    "quotedText": "After training, it showed improved performance",
    "startChar": 45,
    "endChar": 89
  }],
  "confidence": 0.78,
  "proposedEdit": {
    "type": "replace",
    "anchor": {...},
    "newText": "After training, the model showed improved performance",
    "rationale": "Explicit subject removes ambiguity"
  }
}
```

---

## Rigor Inspector

**Purpose**: Detect methodological and logical problems.

**Model**: Sonnet (standard), Opus (deep)

**Runs**: After Context Builder (uses ContextSnapshot)

### Analysis Stages

#### Stage 1: Detection

Scan for issues in:

**Methodology**
- Study design flaws
- Sampling biases
- Measurement validity
- Control group issues
- Confounding variables

**Logic**
- Non sequiturs
- Circular reasoning
- False dichotomies
- Hasty generalizations
- Correlation ≠ causation errors

**Evidence**
- Unsupported claims
- Cherry-picked data
- Missing error analysis
- Inappropriate comparisons

**Statistics**
- p-hacking indicators
- Multiple comparison issues
- Misinterpreted statistics
- Inappropriate tests

#### Stage 2: Revision (if enabled)

For each detected issue:
1. Assess if a textual fix is possible
2. If yes, generate ProposedEdit
3. If no, explain what's needed in description

### Finding Types

| Category | Examples |
|----------|----------|
| rigor_methodology | "No control group", "Selection bias" |
| rigor_logic | "Circular argument", "False equivalence" |
| rigor_evidence | "Claim unsupported", "Data cherry-picked" |
| rigor_statistics | "p-value misinterpreted", "Missing confidence intervals" |

### Using ContextSnapshot

- Check stated_limitations before flagging known issues
- Verify main_claims against evidence found
- Use methodology_summary to focus analysis

### Severity Guidelines

| Issue Type | Severity |
|------------|----------|
| Fundamentally flawed study design | critical |
| Missing essential controls | critical |
| Logical fallacy in main argument | major |
| Statistical error affecting conclusions | major |
| Missing caveats | minor |
| Minor methodological note | suggestion |

### Example Finding

```json
{
  "category": "rigor_logic",
  "severity": "major",
  "title": "Correlation presented as causation",
  "description": "The text states that X 'causes' Y based solely on correlational data. The study design cannot establish causation. Recommend softening the language to 'is associated with'.",
  "anchors": [{
    "paragraphId": "p_042",
    "quotedText": "This demonstrates that increased screen time causes reduced attention spans"
  }],
  "confidence": 0.88,
  "proposedEdit": {
    "type": "replace",
    "anchor": {...},
    "newText": "This demonstrates that increased screen time is associated with reduced attention spans",
    "rationale": "Correlational data cannot establish causation"
  }
}
```

---

## Adversarial Critic

**Purpose**: Surface weaknesses, gaps, and unconsidered alternatives.

**Model**: Sonnet (standard), Opus (deep)

**Runs**: After Rigor Inspector (uses ContextSnapshot)

### Persona

The Adversarial Critic embodies "Reviewer 2" — the skeptical, thorough, but fair reviewer who:
- Questions assumptions
- Demands evidence
- Considers alternatives
- Identifies what's missing
- Anticipates criticism

### Analysis Focus

**Weaknesses**
- Where is the argument most vulnerable?
- What would a skeptic attack?
- Which claims rest on shaky foundations?

**Gaps**
- What's missing from the methodology?
- What comparisons weren't made?
- What controls are absent?
- What literature isn't cited?

**Alternatives**
- What other explanations exist?
- What alternative approaches could work?
- What confounds weren't addressed?

### Finding Types

| Category | Description |
|----------|-------------|
| adversarial_weakness | Fundamental vulnerabilities |
| adversarial_gap | Missing components |
| adversarial_alternative | Unconsidered alternatives |

### Quality Constraints

1. **No petty criticism** — Focus on substantive issues
2. **Actionable** — Every finding must suggest improvement
3. **Fair** — Acknowledge when the work addresses potential concerns
4. **Calibrated** — Confidence reflects actual certainty

### Confidence Threshold

Only include findings with confidence ≥ 0.7

### Example Finding

```json
{
  "category": "adversarial_gap",
  "severity": "major",
  "title": "No comparison with baseline method",
  "description": "The proposed approach is compared only to the state-of-the-art. A comparison with a simple baseline would help readers understand the contribution more clearly and is standard practice in this field.",
  "anchors": [{
    "paragraphId": "p_028",
    "quotedText": "Our method outperforms the current state-of-the-art by 15%"
  }],
  "confidence": 0.82
}
```

---

## Domain Validator

**Purpose**: Validate field-specific conventions and factual claims via web search.

**Model**: Perplexity API (sonar/sonar-pro)

**Runs**: In parallel with Context Builder

### When to Run

Only runs if:
- `config.enable_domain_validation` is true
- OR domain_hint is provided
- OR domain_keywords from ContextSnapshot are present

### Analysis Tasks

1. **Terminology Validation**
   - Are technical terms used correctly?
   - Is terminology current (not outdated)?
   - Are acronyms standard in the field?

2. **Convention Checking**
   - Does methodology follow field conventions?
   - Are standard practices followed?
   - Are deviations justified?

3. **Factual Verification**
   - Are cited facts accurate?
   - Are statistics plausible?
   - Are references legitimate?

### Search Strategy

For each claim/term to validate:
1. Extract key terms
2. Add domain context (from domain_hint or keywords)
3. Generate search query
4. Send to Perplexity with document context
5. Analyze response for contradictions

### Finding Types

| Category | Trigger |
|----------|---------|
| domain_convention | Field practice not followed |
| domain_terminology | Incorrect/outdated term |
| domain_factual | Fact contradicted by sources |

### Citation Requirements

All findings MUST include:
- Sources from Perplexity in metadata
- Confidence based on source quality and agreement

### Example Finding

```json
{
  "category": "domain_terminology",
  "severity": "minor",
  "title": "Outdated terminology",
  "description": "The term 'mental retardation' is outdated. Current clinical and research standards use 'intellectual disability'. This terminology change was formalized in DSM-5 (2013).",
  "anchors": [{
    "paragraphId": "p_011",
    "quotedText": "participants with mental retardation"
  }],
  "confidence": 0.95,
  "metadata": {
    "sources": [
      "DSM-5 Diagnostic Manual",
      "American Association on Intellectual and Developmental Disabilities"
    ]
  },
  "proposedEdit": {
    "type": "replace",
    "anchor": {...},
    "newText": "participants with intellectual disability",
    "rationale": "Updated to current clinical terminology"
  }
}
```

---

## Agent Interaction Summary

```
                    ┌──────────────────┐
                    │  Context Builder │
                    │    (runs first)  │
                    └────────┬─────────┘
                             │
                    ContextSnapshot
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    Clarity      │ │     Rigor       │ │   Adversarial   │
│   Inspector     │ │   Inspector     │ │     Critic      │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
                    ┌─────────────────┐
                    │    Synthesis    │
                    │     Engine      │
                    └─────────────────┘


Domain Validator runs in PARALLEL with Context Builder
(it doesn't need ContextSnapshot, uses document directly + domain_hint)
```

---

## Handling Edge Cases

### Long Documents (>50 pages)

1. Context Builder: Analyze only Abstract, Intro, Methods summary, Discussion summary
2. Clarity Inspector: Process in 10-paragraph chunks
3. Rigor Inspector: Focus on Methods and Results sections
4. Adversarial Critic: Use section summaries
5. Domain Validator: Limit to top 10 claims

### Very Short Documents (<5 paragraphs)

- Run all agents on full document
- Lower confidence threshold (more findings expected from less context)
- Skip global flow analysis

### Non-Standard Structure

If document lacks clear sections:
- Context Builder attempts to infer structure
- Other agents proceed with paragraph-level analysis
- Note structural ambiguity in findings

### Missing Sections

If Methods or Results missing:
- Note as adversarial_gap finding
- Adjust other agent analyses accordingly
- Rigor Inspector focuses on available content
