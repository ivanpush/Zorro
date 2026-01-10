---
description: Run a read-only project hygiene audit on a directory
argument-hint: <directory_path>
---

# Project Hygiene Audit

You are performing a **read-only project hygiene audit** on the directory: $ARGUMENTS

---

## Scope & Rules

- You MUST NOT modify code.
- You MUST NOT refactor, rename, delete, or move files.
- You MUST NOT invent context outside what exists in the repository.
- This is an **evaluation and recommendation pass only**.

---

## Objectives

Analyze the provided directory with two clearly separated lenses:

### 1. Repository & Directory Hygiene

Evaluate:
- Top-level folder structure clarity
- Redundant or ambiguous directories
- Files or folders that should be grouped, hidden, or elevated
- Overloaded root directories
- Naming consistency
- Clear separation of concerns (e.g., app / infra / scripts / experiments / configs)

Answer explicitly:
- What is clean and should not be touched
- What is confusing, redundant, or misleading
- What structural changes would improve clarity without over-engineering

### 2. Code Architecture & Modularity (High-Level)

Evaluate:
- Whether modules have clear responsibility boundaries
- Obvious coupling or circular dependency risks
- Files that are doing "too much"
- Repeated logic that looks unintentional
- Signs of premature abstraction or needless complexity

Do NOT comment on formatting, linting, or stylistic preferences unless they materially harm comprehension.

---

## 3. Audit Artifact (Required Output)

At the project root:
1. Ensure a folder exists named `audits/`
2. If it already exists, reuse it
3. Inside it, create a new Markdown file named: `hygiene-audit-YYYY-MM-DD.md` (use today's date)

### Markdown File Structure (MANDATORY)

The file must contain exactly these sections:

```markdown
# Hygiene Audit — YYYY-MM-DD

## Scope
- Audited directory: <path>

## Executive Summary
- 3–6 bullets
- Blunt, high-signal, no filler

## What's Solid (Do Not Touch)
- Things that are working and should be left alone

## Structural Issues
- Directory / repo-level concerns

## Architectural Issues
- Code organization & modularity concerns

## Suggested Fixes (Not Implemented)
- Each item must be:
  - Actionable
  - Scoped
  - Independent

## Implementation Prompts
```

---

## 4. Implementation Prompts (Important)

Under **Implementation Prompts**, generate one self-contained Claude Code prompt per suggested fix.

Each prompt must:
- Be copy-paste runnable
- Clearly state:
  - What to change
  - What not to change
  - Files or directories in scope
- Avoid cascading refactors

Format each prompt like:

```markdown
### Fix X: <Short Description>

**Prompt:**
<exact Claude Code prompt text>
```

---

## Tone & Style

- Direct
- No flattery
- No "best practice" hand-waving
- Prefer fewer, higher-confidence findings over exhaustive lists
- If something is fine, say it's fine.

---

**Begin the audit now.** Explore the directory structure, read key files to understand architecture, then produce the audit artifact.
