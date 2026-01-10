# Hygiene Audit — 2026-01-10 (Project Root)

Timestamp: 2026-01-10

## Scope
- Audited directory: `/Users/ivanforcytebio/Projects/Zorro/` (full project)

## Executive Summary
- **CRITICAL**: Project root has 14 markdown docs that should be in a `docs/` folder - root is cluttered
- **CRITICAL**: `apps/api/` is stale orphan code (parsers merged to backend) - should be deleted
- **CRITICAL**: `CLAUDE.md` references `apps/api/` and `apps/web/` but actual structure is `backend/` and `frontend/`
- `backend/` is well-structured with 228 passing tests, parsers integrated
- `frontend/` exists with React/Vite setup but minimal analysis performed (not primary focus)
- Empty `Build_Plan.md` file at root (0 bytes) - should be deleted

## What's Solid (Do Not Touch)
- `backend/` directory structure is clean and well-organized
- `backend/app/` follows standard FastAPI patterns: `agents/`, `api/`, `composer/`, `config/`, `core/`, `models/`, `parsers/`, `services/`
- `frontend/` has standard React/Vite layout: `src/components/`, `src/screens/`, `src/hooks/`, `src/types/`
- `.gitignore` is properly configured
- `audits/` directory exists for audit artifacts

## Structural Issues

### 0. Project root documentation clutter (CRITICAL)
Root has 14 markdown files creating noise:
```
API_CONTRACTS.md, ARCHITECTURE.md, BEHAVIORS.md, BUILD_PHASES.md,
Build_Plan.md (EMPTY), CLAUDE.md, DATA_CONTRACTS.md, EXPLORATION_SUMMARY.md,
FILE_REFERENCE_GUIDE.md, LOGGING.md, PROMPTS.md, README.md, TESTING.md,
ZORRO_CURRENT_REVIEW_IMPLEMENTATION_EXPLORATION.md
```

Only `README.md` and `CLAUDE.md` belong at root. The rest should be in `docs/`.

### 1. Orphaned `apps/api/` directory (CRITICAL)
```
apps/
└── api/
    ├── src/parsers/     # MERGED to backend/app/parsers/
    ├── src/clients/     # STALE
    ├── src/export/      # STALE
    ├── src/routers/     # STALE
    └── ...
```
Parsers were merged. The rest is dead code from an earlier approach.

### 2. `CLAUDE.md` references wrong paths (CRITICAL)
Documents:
- `apps/api/` → actual: `backend/`
- `apps/web/` → actual: `frontend/`
- `apps/api/src/` → actual: `backend/app/`

This misleads AI assistants and developers.

### 3. Empty `Build_Plan.md` (MINOR)
0-byte file at root. Either delete or populate.

### 4. Backend has build docs at its root (HIGH)
Already noted in backend-specific audit - 11 markdown files should be in `backend/docs/build/`.

## Architectural Issues

### 1. No `docs/` folder at project root
Design docs are scattered in root instead of organized in `docs/`.

### 2. Frontend not fully analyzed
`frontend/` appears functional but was not deeply audited. Notable:
- Has its own `BUILD_LOG.md`, `REVIEW_SCREEN_REBUILD.md`, `fix-summary.md`, `test-loading.md` at root
- These should likely be in `frontend/docs/`

## Suggested Fixes (Not Implemented)

### Fix 0: Delete orphaned apps/ directory
The entire `apps/` directory should be deleted. Parsers already merged to backend.

### Fix 1: Move root docs to docs/ folder
Create `docs/` and move all markdown except README.md and CLAUDE.md.

### Fix 2: Update CLAUDE.md paths
Change all `apps/api/` → `backend/` and `apps/web/` → `frontend/`.

### Fix 3: Delete empty Build_Plan.md
Remove the 0-byte file.

### Fix 4: Move backend build docs
Move backend's 11 build markdown files to `backend/docs/build/`.

### Fix 5: Move frontend docs
Move frontend's 4 markdown files to `frontend/docs/`.

## Implementation Prompts

### Fix 0: Delete orphaned apps/ directory

**Prompt:**
```
Delete the entire /Users/ivanforcytebio/Projects/Zorro/apps/ directory.

Rationale:
- Parsers have been merged to backend/app/parsers/
- Remaining code (clients/, export/, routers/, models/, services/) is stale
- This was from an earlier monorepo approach that was abandoned

DO NOT:
- Touch backend/ or frontend/
- Hesitate - this code is confirmed orphaned
```

### Fix 1: Move root docs to docs/ folder

**Prompt:**
```
In /Users/ivanforcytebio/Projects/Zorro/:

1. Create docs/ directory
2. Move these files INTO docs/:
   - API_CONTRACTS.md
   - ARCHITECTURE.md
   - BEHAVIORS.md
   - BUILD_PHASES.md
   - DATA_CONTRACTS.md
   - EXPLORATION_SUMMARY.md
   - FILE_REFERENCE_GUIDE.md
   - LOGGING.md
   - PROMPTS.md
   - TESTING.md
   - ZORRO_CURRENT_REVIEW_IMPLEMENTATION_EXPLORATION.md

3. Keep at root:
   - README.md (project readme)
   - CLAUDE.md (AI assistant instructions)
   - .gitignore

DO NOT:
- Modify file contents
- Move README.md or CLAUDE.md
- Touch backend/, frontend/, or audits/
```

### Fix 2: Update CLAUDE.md paths

**Prompt:**
```
Update /Users/ivanforcytebio/Projects/Zorro/CLAUDE.md:

Replace all occurrences:
- `apps/api/` → `backend/`
- `apps/api/src/` → `backend/app/`
- `apps/web/` → `frontend/`
- `apps/web/src/` → `frontend/src/`

In the file structure sections:
- Change "### Frontend (`apps/web/`)" to "### Frontend (`frontend/`)"
- Change "### Backend (`apps/api/`)" to "### Backend (`backend/`)"

In testing commands:
- Change `cd apps/api` → `cd backend`
- Change `cd apps/web` → `cd frontend`

In common tasks section:
- Update all file paths to use backend/ instead of apps/api/

DO NOT:
- Change any other content
- Modify code examples (just paths)
```

### Fix 3: Delete empty Build_Plan.md

**Prompt:**
```
Delete /Users/ivanforcytebio/Projects/Zorro/Build_Plan.md

It is a 0-byte empty file with no content.

DO NOT:
- Touch any other files
```

### Fix 4: Move backend build docs

**Prompt:**
```
In /Users/ivanforcytebio/Projects/Zorro/backend/:

1. Create docs/build/ directory
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

3. Keep at backend/ root:
   - QUICKSTART.md (user-facing)
   - pyproject.toml
   - app/
   - tests/

DO NOT:
- Modify file contents
- Touch app/ or tests/
```

### Fix 5: Move frontend docs

**Prompt:**
```
In /Users/ivanforcytebio/Projects/Zorro/frontend/:

1. Create docs/ directory
2. Move these files INTO docs/:
   - BUILD_LOG.md
   - REVIEW_SCREEN_REBUILD.md
   - fix-summary.md
   - test-loading.md

3. Keep at frontend/ root:
   - package.json, tsconfig.json, vite.config.ts, etc.
   - src/
   - public/
   - index.html

DO NOT:
- Modify file contents
- Touch src/ or any config files
```
