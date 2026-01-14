# Architecture Decision Record

Document a design decision with context, options considered, and rationale.

## Instructions

1. **Gather context** from the conversation:
   - What was the question or problem?
   - What options were discussed?
   - What was chosen and why?

2. **Determine category** (one of):
   - `architecture` — system design, data flow, component boundaries
   - `agents` — agent behavior, prompts, orchestration
   - `ui` — frontend patterns, UX decisions
   - `data-model` — DocObj, Finding, Anchor schema changes
   - `integration` — APIs, external services, SSE
   - `performance` — optimization tradeoffs

3. **Create the ADR file** at:
   ```
   docs/decisions/ADR-YYYY-MM-DD-<slug>.md
   ```

   Use kebab-case for the slug (e.g., `conflicting-paragraph-edits`).

4. **Use this template**:

```markdown
# ADR: <Title>

*Date: YYYY-MM-DD | Category: <category> | Status: Accepted*

## Context

What is the problem or question we faced?

## Options Considered

### Option A: <Name>
<Description>

**Pros:**
- ...

**Cons:**
- ...

### Option B: <Name>
<Description>

**Pros:**
- ...

**Cons:**
- ...

(Add more options as needed)

## Decision

We chose **Option X** because:
- <reason 1>
- <reason 2>
- <reason 3>

## Consequences

- <what this means going forward>
- <any tradeoffs accepted>
- <future considerations>

## Related

- <links to relevant files, PRs, or other ADRs>
```

5. **After creating**, report:
   - File path created
   - Brief summary of the decision

## Example

For a decision about handling conflicting paragraph edits:

```
docs/decisions/ADR-2025-01-14-conflicting-paragraph-edits.md

Category: agents
Decision: Use prompt-level span consolidation instead of LLM merge agent
Reason: Simpler, transparent, preserves user control in high-stakes writing
```
