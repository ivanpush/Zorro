# Handoff - Create Context Transfer Document

Create a compact handoff at `.claude/handoff.md` for a new session to continue this work.

## Reality Check
Handoffs usually happen mid-task when context runs out, not at clean stopping points. Capture the actual messy state.

## Write to `.claude/handoff.md`:

```markdown
# Handoff
Generated: [timestamp]

## Task
[1-2 sentences - what we're trying to accomplish]

## Current State
[Where we actually are - be honest if it's mid-debug, mid-refactor, broken, etc.]

## Files Touched
- `path/file.ext` - [what/why, brief]

## Discussion & Decisions
[If there was back-and-forth, summarize the decision tree:
- User wanted X
- Tried Y, didn't work because Z
- Decided on W
- User preference: "exact quote if relevant"]

## Pending
- Immediate next action
- Other remaining work

## Blockers/Errors
[Current errors, failed attempts, what didn't work]

## Resume
[Exact next step - be specific]
```

## Rules
- Be blunt and factual
- Capture decision history, not just final state
- If mid-debug: say what's broken and what was tried
- No fluff, no verbose explanations
- Quote user preferences verbatim when relevant

Confirm handoff is ready. User runs `/lho` in new session.
