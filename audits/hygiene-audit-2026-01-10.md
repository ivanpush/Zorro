# Hygiene Audit — 2026-01-10

Timestamp: 2026-01-10

## Scope
- Audited directory: `/Users/ivanforcytebio/Projects/Zorro/backend/`
- **ALSO RELEVANT**: `/Users/ivanforcytebio/Projects/Zorro/apps/api/` (stale orphan)

## Executive Summary
- **CRITICAL**: Orphaned `apps/api/` directory exists at project root - stale code from earlier approach, should be deleted
- **CRITICAL**: `CLAUDE.md` documents wrong structure (`apps/api/`) instead of actual structure (`backend/`)
- The `backend/` directory is polluted with 10+ markdown build documentation files at root level; these should be in a dedicated `docs/` folder
- Code architecture is clean: clear module boundaries, proper separation of concerns, sensible dependency direction
- Tests are well-organized with unit/integration split but `tests/fixtures/` is empty (unused placeholder)
- The `app/` structure follows standard FastAPI patterns with no major issues
- One circular import workaround exists in `services/__init__.py` (documented, acceptable)
- Empty `tests/fixtures/` directory should either be populated or removed

## What's Solid (Do Not Touch)
- `app/` folder structure: `agents/`, `api/`, `composer/`, `config/`, `core/`, `models/`, `parsers/`, `services/` - clear and intuitive
- Agent submodule organization: `adversary/`, `domain/`, `rigor/` - well-scoped with single-purpose files
- Pydantic models are properly separated by domain: `document.py`, `finding.py`, `briefing.py`, `domain.py`, `events.py`, `metrics.py`, `review.py`, `chunks.py`
- The `Composer` pattern (library + builder) cleanly separates prompts from logic
- Test file naming convention: `test_*.py` in both `unit/` and `integration/`
- `pyproject.toml` is minimal and correctly configured
- `__init__.py` files consistently re-export relevant symbols with proper `__all__`

## Structural Issues

### 0. Orphaned `apps/api/` directory (CRITICAL) - PARTIALLY RESOLVED
Project root contains `apps/api/` with code from an earlier approach.

**RESOLVED**: Parsers from `apps/api/src/parsers/` have been merged into `backend/app/parsers/` with:
- Model fields enriched (BoundingBox, Figure, Reference added to backend models)
- Field names adapted to backend conventions (paragraph_id, section_id, etc.)
- Dependencies added to pyproject.toml (PyMuPDF, python-docx)

**REMAINING**:
- `apps/api/` directory can now be deleted (parsers merged, other code is stale)
- `CLAUDE.md` still references `apps/api/` and `apps/web/` - needs update to reflect `backend/` structure

### 1. Root-level documentation clutter (HIGH)
Backend root contains 10 markdown files that are build/implementation documentation:
- `00_MASTER_BUILD.md`, `01_PYDANTIC_MODELS.md`, `02_GLOBAL_CONFIG.md`, `03_COMPOSER_PROMPTS.md`
- `04_CORE_INFRASTRUCTURE.md`, `05_TDD_TESTS.md`, `06_ASSEMBLER.md`
- `BUILD_LOG.md`, `BuildPrompts.md`, `IMPLEMENTATION_PROMPTS.md`, `TDD_PROTOCOL.md`
- `QUICKSTART.md` (only legitimate user-facing doc at root)

These should be consolidated into `backend/docs/` or `backend/docs/build/`.

### 2. Empty fixtures directory (LOW)
`tests/fixtures/` exists but is empty. Either:
- Populate with demo fixtures as mentioned in `00_MASTER_BUILD.md`
- Remove if demo fixtures will live elsewhere

### 3. No `.env.example` (MINOR)
Settings reference `.env` file but there's no template for required env vars.

## Architectural Issues

### 1. Documented circular import workaround (ACCEPTABLE)
`app/services/__init__.py` has a comment explaining that `Orchestrator` is imported directly to avoid circular imports. This is documented and intentional - no action needed.

### 2. Implicit async pattern (OBSERVATION)
`LLMClient.call()` and `call_raw()` are declared `async` but use synchronous Anthropic client internally. This works because the sync client is called directly (not awaited), but could cause issues if true async is needed later. Not a bug, but worth noting.

### 3. In-memory job store in review routes (ACCEPTABLE FOR NOW)
`app/api/routes/review.py` uses `_jobs: dict[str, ReviewJob] = {}` - explicitly commented as placeholder. Acceptable for current stage.

## Suggested Fixes (Not Implemented)

### Fix 0: Delete orphaned apps/api/ and update CLAUDE.md (CRITICAL)
Delete the entire `apps/` directory (contains only stale `api/` code). Update `CLAUDE.md` to document the actual structure using `backend/` paths.

### Fix 1: Move build documentation to dedicated folder
Move all numbered markdown files + BUILD_LOG + BuildPrompts + IMPLEMENTATION_PROMPTS + TDD_PROTOCOL into `backend/docs/build/`. Keep only QUICKSTART.md at root (or move it to `docs/` too).

### Fix 2: Handle empty fixtures directory
Either add demo DocObj fixtures for testing or remove the empty directory.

### Fix 3: Add .env.example
Create a template file showing required environment variables.

## Implementation Prompts

### Fix 0: Delete orphaned apps/ and fix CLAUDE.md (CRITICAL) - PARTIALLY DONE

**Already completed:**
- Parsers merged into `backend/app/parsers/`
- Model enriched with BoundingBox, Figure, Reference
- Dependencies added to pyproject.toml
- All 228 tests passing

**Remaining prompt:**
```
CLEANUP (parsers already merged):

1. Delete the entire /Users/ivanforcytebio/Projects/Zorro/apps/ directory
   - Parsers have been merged to backend/app/parsers/
   - Remaining code (clients/, export/, routers/) is stale

2. Update /Users/ivanforcytebio/Projects/Zorro/CLAUDE.md:
   - Change all references from `apps/api/` to `backend/`
   - Change all references from `apps/api/src/` to `backend/app/`
   - Add `parsers/` to the backend file structure section
   - Remove references to `apps/web/` if frontend doesn't exist there

DO NOT:
- Touch anything in backend/
- Modify any code files
```

### Fix 1: Consolidate build documentation

**Prompt:**
```
In /Users/ivanforcytebio/Projects/Zorro/backend/:

1. Create directory: docs/build/
2. Move these files INTO docs/build/:
   - 00_MASTER_BUILD.md
   - 01_PYDANTIC_MODELS.md
   - 02_GLOBAL_CONFIG.md
   - 03_COMPOSER_PROMPTS.md
   - 04_CORE_INFRASTRUCTURE.md
   - 05_TDD_TESTS.md
   - 06_ASSEMBLER.md
   - BUILD_LOG.md
   - BuildPrompts.md
   - IMPLEMENTATION_PROMPTS.md
   - TDD_PROTOCOL.md

3. Keep QUICKSTART.md at backend/ root (it's user-facing)

DO NOT:
- Modify file contents
- Change any code files
- Touch the app/ or tests/ directories
```

### Fix 2: Remove empty fixtures directory

**Prompt:**
```
In /Users/ivanforcytebio/Projects/Zorro/backend/tests/:

Remove the empty fixtures/ directory.

If fixtures are needed later, they can be recreated with actual content.

DO NOT:
- Modify any test files
- Touch any other directories
```

### Fix 3: Add environment template

**Prompt:**
```
In /Users/ivanforcytebio/Projects/Zorro/backend/:

Create .env.example with the following content:

# Required API Keys
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...

# Optional Configuration
DEBUG=false
LOG_LEVEL=INFO
DEMO_MODE_DEFAULT=true
MAX_CONCURRENT_AGENTS=4

Base this on app/config/settings.py fields.

DO NOT:
- Create an actual .env file with real credentials
- Modify any existing files
```
