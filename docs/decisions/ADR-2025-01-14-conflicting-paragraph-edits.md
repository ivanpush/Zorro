# ADR: Handling Conflicting Paragraph Edits

*Date: 2025-01-14 | Category: agents | Status: Accepted*

## Context

When multiple findings target the same paragraph, accepting one rewrite can invalidate others. For example:
- Finding A suggests rewriting the entire paragraph for clarity
- Finding B suggests editing just one sentence within it
- When user accepts Finding A's rewrite, Finding B's anchor no longer exists

How should we handle these conflicts?

## Options Considered

### Option A: Anchor Invalidation + Warning

When a rewrite is applied, detect findings with overlapping anchors and warn the user before dismissing them.

**Pros:**
- Simple to implement (~6 hours)
- Transparent — user sees exactly what will happen
- User retains full control
- No additional API costs

**Cons:**
- User might lose suggestions they wanted to keep
- Requires manual re-application of dismissed edits

### Option B: LLM Merge Agent

Add a new agent that intelligently merges conflicting edits into a single coherent rewrite.

**Pros:**
- No lost work — all suggestions incorporated
- Single review instead of N separate ones
- Leverages LLM's semantic understanding

**Cons:**
- Complex implementation (~30 hours)
- Additional API cost (~$0.10/document)
- "Magic" problem — user sees text they didn't write
- Authorship confusion — which agent wrote this?
- Violates architecture principle: "agents never share state"
- Hard to debug when merge produces weird results
- All-or-nothing acceptance (can't partially reject)

### Option C: Prompt-Level Span Consolidation

Prevent conflicts at the source by instructing the Rigor finder to consolidate overlapping issues into single findings.

**Pros:**
- Prevents problem rather than fixing it after
- No additional agents or API calls
- Simple prompt changes (~5 minutes)
- Findings remain attributable to single agent

**Cons:**
- Only addresses same-agent conflicts
- Cross-agent conflicts still need handling

## Decision

We chose **Option C (Prompt-Level Consolidation)** as the primary approach because:

1. **Prevention > Cure** — Better to not create conflicting findings than to resolve them later
2. **Transparency** — Users see exactly what each agent found
3. **Architecture alignment** — Preserves "agents never share state" principle
4. **Cost** — Zero additional API calls or complexity
5. **High-stakes domain** — Medical/grant writing needs explicit control, not AI "magic"

For cross-agent conflicts (e.g., Clarity vs Rigor on same span), we'll implement Option A as a fallback.

## Consequences

- Added span consolidation rules to `RIGOR_FIND_SYSTEM` and `RIGOR_FIND_USER` prompts
- Rigor finder now combines overlapping/nested issues into single findings
- Cross-agent conflicts may still occur — frontend warning (Option A) is a future enhancement
- No merge agent needed — keeps architecture simple

## Related

- `backend/app/composer/library.py` — Rigor finder prompts (lines 118-124, 142-144)
- `backend/docs/TODO_2025-01-12.md` — Original problem description
