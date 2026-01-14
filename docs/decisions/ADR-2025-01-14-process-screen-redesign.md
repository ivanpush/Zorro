# ADR: ProcessScreen Pipeline Visualization Redesign

*Date: 2025-01-14 | Category: ui | Status: Accepted*

## Context

The original ProcessScreen used a phase-based progress indicator with four stages (researching, assessing, evaluating, synthesizing) shown as dots at the bottom. This didn't communicate what was actually happening during document analysis.

Users had no visibility into:
- Which specific agent was running
- What that agent was doing
- What findings were being discovered in real-time

## Options Considered

### Option A: Keep Phase-Based Progress

Keep the simple 4-phase dots with generic labels.

**Pros:**
- Already implemented
- Simple mental model

**Cons:**
- No insight into actual agent work
- Feels like a black box
- Generic labels don't explain what's happening

### Option B: Agent-Node Pipeline with Live Status

Replace phases with a vertical timeline showing each agent as a node with:
- Rotating contextual status messages per agent type
- Visual indicators (pulse for active, check for complete)
- Simulated "document reading" snippets
- Real-time finding discovery with flash effects

**Pros:**
- Users see exactly which agent is running
- Contextual messages explain what's being checked
- Findings appear as discovered (engagement)
- Feels more transparent and intelligent

**Cons:**
- More complex implementation
- Status messages are illustrative, not literal

## Decision

We chose **Option B (Agent-Node Pipeline)** because:

1. **Transparency** — Users understand what each agent does
2. **Engagement** — Watching findings appear is more satisfying than watching dots
3. **Trust** — Seeing specific actions ("Checking sentence complexity...") builds confidence
4. **Consistency** — Aligns with the review screen's agent-attributed findings

## Consequences

- Each agent category has curated status messages (briefing, clarity, rigor, adversary, domain, assembler)
- Status messages rotate every 2.2 seconds during agent execution
- Last 6 findings shown to keep UI focused (no scroll)
- Orange accent color scheme with flash animation on new findings
- Demo mode simulates realistic agent timing and finding discovery

## Related

- `frontend/src/screens/ProcessScreen.tsx` — Full implementation
- `frontend/src/screens/ProcessScreen.old.tsx` — Previous implementation (backup)
