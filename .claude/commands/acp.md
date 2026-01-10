# Add, Commit, Push

Stage all changes, generate a comprehensive commit, and push to remote.

## Instructions

1. **Analyze changes**: Run `git status` and `git diff` to understand what's being committed.

2. **Stage all changes**: Run `git add -A` to stage everything.

3. **Categorize the changes**:
   - Which layer? (frontend/backend/both)
   - Which domain? (agents, parsers, UI components, types, fixtures, etc.)
   - Breaking changes to DocObj or Finding schemas?

4. **Generate commit message** with this structure:
   ```
   <type>(<scope>): <short summary>

   <body - what and why, not how>

   <footer - breaking changes, related issues>
   ```

   Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`

   Scopes: `agent`, `parser`, `ui`, `api`, `types`, `fixture`, `export`, `sse`, `repo`

5. **Include in body**:
   - What problem this solves or feature it adds
   - Why this approach was chosen
   - Any agents or screens affected
   - Type changes (if Pydantic or TypeScript types modified)

6. **Flag if**:
   - DocObj structure changed (warn: affects all parsers, agents, exports)
   - Finding/Anchor schema changed (warn: affects fixtures)
   - New dependencies added

7. **Execute the commit** with the generated message.

8. **Push to remote**: Run `git push` after successful commit.

## Example Output

```
feat(agent): add statistical validation agent

Adds StatisticalAgent that checks for:
- Unreported p-values and effect sizes
- Sample size justification
- Multiple comparison corrections

Integrates with existing orchestrator parallel execution.
Includes demo fixtures for testing.

Affects: backend/app/agents/, frontend/src/fixtures/
```
