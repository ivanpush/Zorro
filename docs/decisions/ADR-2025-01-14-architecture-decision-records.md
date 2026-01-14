# ADR: Adopting Architecture Decision Records

*Date: 2025-01-14 | Category: architecture | Status: Accepted*

## Context

Design decisions were being made in conversations but not documented. When revisiting past choices, there was no record of:
- What alternatives were considered
- Why a particular approach was chosen
- What tradeoffs were accepted

This makes it hard to:
- Onboard new contributors
- Revisit decisions when context changes
- Avoid re-debating settled questions

## Options Considered

### Option A: Informal Documentation

Keep decisions in TODO files, commit messages, or code comments.

**Pros:**
- No new process
- Already happening organically

**Cons:**
- Scattered across files
- Missing context (what was rejected and why)
- Hard to find later

### Option B: Architecture Decision Records (ADRs)

Structured documents capturing:
- Context/problem
- Options considered with pros/cons
- Decision and rationale
- Consequences

Stored in `docs/decisions/` with consistent naming.

**Pros:**
- Searchable, centralized
- Forces explicit reasoning
- Captures rejected alternatives
- Standard format (widely used in industry)

**Cons:**
- Overhead to write
- Might become stale if not maintained

## Decision

We chose **Option B (ADRs)** because:

1. **Institutional memory** — Decisions survive beyond the conversation
2. **Onboarding** — New contributors can understand why things are the way they are
3. **Accountability** — Forces explicit reasoning before implementing
4. **Reversibility** — Easy to mark decisions as superseded when context changes

## Consequences

- Created `/adr` slash command for easy ADR creation
- ADRs stored in `docs/decisions/ADR-YYYY-MM-DD-<slug>.md`
- Categories: architecture, agents, ui, data-model, integration, performance
- Status field tracks: Accepted, Superseded, Deprecated

## Related

- `.claude/commands/adr.md` — Slash command definition
- `docs/decisions/` — ADR storage location
