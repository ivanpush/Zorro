# TDD PROTOCOL - READ BEFORE EVERY PHASE

## THE RULE

```
WRITE TEST → RUN TEST → SEE IT FAIL → IMPLEMENT → RUN TEST → SEE IT PASS
```

**NEVER write implementation before the test exists and fails.**

---

## WORKFLOW FOR EVERY PHASE

### Step 1: Write the test file ONLY
```bash
# Create/update test file
# DO NOT touch implementation yet
```

### Step 2: Run the test
```bash
pytest tests/unit/test_<module>.py -v
```

### Step 3: Confirm it fails
You MUST see RED (failures). If tests pass, something is wrong:
- Test isn't actually testing anything
- Implementation already exists (shouldn't)
- Test is broken

**Log the failure:**
```
[PHASE X] TEST WRITTEN - EXPECTED FAIL
File: tests/unit/test_<module>.py
Tests: X failed, 0 passed
Failures:
- test_xxx: <reason>
- test_yyy: <reason>
```

### Step 4: Write MINIMAL implementation
Only write enough code to make the failing tests pass. No more.

### Step 5: Run test again
```bash
pytest tests/unit/test_<module>.py -v
```

### Step 6: Confirm it passes
You MUST see GREEN. If it fails:

**STOP. DO NOT CONTINUE.**

Log the failure:
```
[PHASE X] IMPLEMENTATION FAILED
File: app/<module>.py
Tests: X failed, Y passed
Failures:
- test_xxx: <error message>
```

Fix the implementation. Re-run. Repeat until GREEN.

### Step 7: Log success
```
[PHASE X] COMPLETE ✓
File: app/<module>.py
Tests: X passed, 0 failed
```

### Step 8: Run ALL tests
```bash
pytest tests/ -v
```

If any previous tests broke, **STOP and fix before continuing**.

---

## PHASE GATES

You CANNOT proceed to Phase N+1 until:

1. ✅ Phase N tests written
2. ✅ Phase N tests failed (red)
3. ✅ Phase N implementation written
4. ✅ Phase N tests pass (green)
5. ✅ ALL previous tests still pass
6. ✅ Success logged

---

## LOG FORMAT

Keep a running log in `BUILD_LOG.md`:

```markdown
# ZORRO Backend Build Log

## Phase 1: Project Setup
- [x] Tests written: tests/unit/test_config.py
- [x] Tests failed (expected): 3 failures
- [x] Implementation: app/config/settings.py, app/config/models.py
- [x] Tests passed: 3/3 ✓
- [x] All tests: 3/3 ✓
- Commit: `chore(backend): initialize project structure`

## Phase 2: Pydantic Models
- [x] Tests written: tests/unit/test_models.py
- [x] Tests failed (expected): 12 failures
- [x] Implementation: app/models/*.py
- [x] Tests passed: 12/12 ✓
- [x] All tests: 15/15 ✓
- Commit: `feat(models): add all Pydantic models`

## Phase 3: ...
```

---

## FAILURE PROTOCOL

If a test fails after implementation:

1. **STOP** - Do not write more code
2. **READ** - What does the error say?
3. **ISOLATE** - Run just that one test: `pytest tests/unit/test_x.py::test_name -v`
4. **DEBUG** - Add print statements, check types, verify logic
5. **FIX** - Change implementation (not test, unless test is wrong)
6. **VERIFY** - Run test again
7. **CONTINUE** - Only when green

---

## FORBIDDEN ACTIONS

❌ Writing implementation before test exists
❌ Skipping a failing test to "come back later"
❌ Modifying tests to make them pass (unless test is genuinely wrong)
❌ Proceeding to next phase with any red tests
❌ Bulk-writing multiple phases at once
❌ "It probably works" without running pytest

---

## COMMANDS CHEAT SHEET

```bash
# Run one test file
pytest tests/unit/test_models.py -v

# Run one specific test
pytest tests/unit/test_models.py::TestFinding::test_requires_anchor -v

# Run all unit tests
pytest tests/unit/ -v

# Run all tests
pytest tests/ -v

# Run with print output visible
pytest tests/unit/test_models.py -v -s

# Run and stop on first failure
pytest tests/unit/ -v -x

# Run tests matching a name pattern
pytest tests/ -v -k "test_chunk"
```

---

## EXAMPLE PHASE EXECUTION

**You say:** "Do Phase 5: Briefing Agent"

**Claude does:**

```
1. Create tests/integration/test_briefing.py

[writes test file]

2. Run test:
$ pytest tests/integration/test_briefing.py -v

3. Output:
FAILED test_briefing.py::TestBriefingAgent::test_returns_briefing_output - ModuleNotFoundError
FAILED test_briefing.py::TestBriefingAgent::test_with_steering - ModuleNotFoundError
2 failed

[PHASE 5] TEST WRITTEN - EXPECTED FAIL ✓

4. Create app/agents/briefing.py

[writes implementation]

5. Run test:
$ pytest tests/integration/test_briefing.py -v

6. Output:
PASSED test_briefing.py::TestBriefingAgent::test_returns_briefing_output
PASSED test_briefing.py::TestBriefingAgent::test_with_steering
2 passed

7. Run all tests:
$ pytest tests/ -v
25 passed

[PHASE 5] COMPLETE ✓

8. Update BUILD_LOG.md
```

---

## WHY THIS MATTERS

- Tests document expected behavior
- Failing test proves the test works
- Passing test proves implementation works
- Regression caught immediately
- Build log tracks progress
- No "it worked on my machine"

**Red → Green → Refactor. Always.**
