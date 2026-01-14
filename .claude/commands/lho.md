# Load Handoff - Resume from Previous Session

## Steps

1. **Check** `.claude/handoff.md` exists
   - If not: "No handoff found. Run /ho in previous session."

2. **Read** the handoff file

3. **Archive** it:
   ```bash
   mv .claude/handoff.md .claude/handoff.loaded.md
   ```

4. **Brief the user** - 2-3 lines max:
   - What task
   - Current state
   - What you're doing next

5. **Continue** with the "Resume" instruction
