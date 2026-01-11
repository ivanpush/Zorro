# Frontend + Backend Integration Testing - Research Summary

**Date**: 2026-01-10

## Executive Summary

ZORRO is a document review system with clear separation between frontend (React/Vite) and backend (FastAPI). Both can run independently, but integrate via REST API for real-time document analysis.

**Key Finding**: Frontend has a pre-built demo fixture that can be sent directly to the backend for testing, requiring no document upload or parsing.

---

## What I Found

### Frontend (React/Vite - Port 5173)

**Structure**:
- Routes: Upload → Setup → Process → Review
- Two modes: **Demo** (fixtures) and **Dynamic** (API)
- State management: Zustand
- UI: React with Radix + Tailwind

**Key Files**:
- `/frontend/src/screens/SetupScreen.tsx` - Mode toggle and config
- `/frontend/src/screens/ProcessScreen.tsx` - API integration + SSE
- `/frontend/src/services/fixtures.ts` - Demo data loader
- `/frontend/public/fixtures/manuscript_pdf.json` - Pre-parsed test document

**Dependencies**:
```
react, react-router-dom, axios, zustand
@radix-ui/*, @tailwindcss/*, lucide-react
```

### Backend (FastAPI - Port 8000)

**Structure**:
- Main: `/backend/app/main.py` - FastAPI app
- Routes: `/backend/app/api/routes/review.py` - REST endpoints
- Models: `/backend/app/models/` - Pydantic v2 schemas
- Services: Orchestrator + SSE streaming
- Agents: Multi-phase analysis (Briefing, Clarity, Rigor, Adversary, Domain)

**Key Dependencies**:
```
fastapi, uvicorn, pydantic>=2.5.0
anthropic>=0.18.0 (Claude API)
PyMuPDF, python-docx (parsing)
instructor (structured LLM outputs)
```

---

## API Integration

### Critical Endpoint

**POST /review/demo/start**
- Input: DocObj (full document structure) + ReviewConfig
- Output: { job_id }
- Test data available: `/frontend/public/fixtures/manuscript_pdf.json`

**Frontend Call** (ProcessScreen.tsx:113):
```javascript
const response = await fetch(`${API_BASE}/review/demo/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    document: currentDocument,
    config: { ... }
  })
});
```

### Data Flow: Demo Mode

```
Frontend (local)
  └─ Load /fixtures/manuscript_pdf.json
  └─ Create findings via fixtures.ts functions
  └─ Display in ReviewScreen
  └─ No backend calls
```

### Data Flow: Dynamic Mode

```
Frontend (SetupScreen)
  └─ POST /review/demo/start { document, config }
  └─ Receive job_id
  └─ EventSource /review/{job_id}/stream (SSE)
  │   └─ Listen for events:
  │       ├─ phase_started
  │       ├─ agent_started
  │       ├─ agent_completed
  │       ├─ finding_discovered (accumulate)
  │       └─ review_completed (navigate)
  └─ GET /review/{job_id}/result (final state)
```

---

## DocObj Structure (What Backend Expects)

The fixture file is a complete, immutable document representation:

```typescript
DocObj {
  document_id: string        // UUID, stable forever
  filename: string           // "manuscript.pdf"
  type: 'pdf' | 'docx'
  title: string
  sections: Section[] {      // Heading hierarchy
    section_id: "sec_001"
    section_index: 0
    section_title: "Introduction"
    level: 1                  // Heading level
    paragraph_ids: ["p_001", "p_002"]
  }
  paragraphs: Paragraph[] {   // Full text segments
    paragraph_id: "p_001"
    section_id: "sec_001"
    paragraph_index: 0
    text: "Full paragraph text..."
    sentences: Sentence[] {
      sentence_id: "p_001_s_001"
      paragraph_id: "p_001"
      sentence_index: 0
      text: "Individual sentence..."
      start_char: 0
      end_char: 42
    }
  }
  figures: Figure[]
  references: Reference[]
  metadata: DocumentMetadata {
    wordCount: number
    characterCount: number
    pageCount?: number
    author?: string
  }
  createdAt: ISO8601
}
```

**Status**: Fully structured example available in fixture file (~50KB JSON)

---

## Testing Checklist

### What Needs to Happen

1. **Backend Setup** (10 min)
   - Python 3.11+ venv
   - `pip install -e ".[dev]"`
   - `.env` with API keys (can be dummy for testing structure)
   - `./start.sh` to run on port 8000

2. **Frontend Setup** (5 min)
   - Node 18+ with npm
   - `npm install`
   - `.env` with `VITE_API_URL=http://localhost:8000` (optional, defaults exist)
   - `./start.sh` to run on port 5173

3. **Test Demo Mode** (no backend needed)
   - Load http://localhost:5173/
   - Toggle "Static" mode at bottom of SetupScreen
   - Click "Run Review"
   - Should show ~6 pre-loaded findings
   - No API calls made

4. **Test Dynamic Mode** (with backend)
   - Both services running
   - Toggle "Dynamic" mode
   - Click "Run Review"
   - Watch ProcessScreen for live updates
   - Verify SSE events arriving
   - Check findings accumulate in real-time

5. **Test API Directly** (with cURL)
   - `curl http://localhost:8000/health`
   - `curl -X POST ... /review/demo/start` with fixture data
   - `curl -N ... /review/{job_id}/stream` for SSE
   - `curl ... /review/{job_id}/result` for final results

---

## Critical Files

### Backend

| File | Purpose |
|------|---------|
| `/backend/pyproject.toml` | Dependencies, Python 3.11+ requirement |
| `/backend/app/main.py` | FastAPI app, CORS config |
| `/backend/app/config/settings.py` | Pydantic settings from .env |
| `/backend/app/api/routes/review.py` | All 4 review endpoints |
| `/backend/app/models/__init__.py` | Exports DocObj, Finding, ReviewJob, etc. |
| `/backend/start.sh` | Startup script (uses uvicorn) |

### Frontend

| File | Purpose |
|------|---------|
| `/frontend/package.json` | Dependencies, Node 18+ |
| `/frontend/src/store/index.ts` | Zustand state (document, findings, mode) |
| `/frontend/src/screens/SetupScreen.tsx` | Mode toggle, config input |
| `/frontend/src/screens/ProcessScreen.tsx` | API calls, SSE connection |
| `/frontend/src/services/fixtures.ts` | Demo data loading |
| `/frontend/public/fixtures/manuscript_pdf.json` | Test DocObj |
| `/frontend/start.sh` | Startup script (uses Vite) |

---

## Environment Variables Needed

### Backend (.env)

**Required** (for real agents, can be dummy):
```
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
```

**Optional** (defaults shown):
```
DEBUG=False
LOG_LEVEL=INFO
DEMO_MODE_DEFAULT=True
MAX_CONCURRENT_AGENTS=4
DEFAULT_CHUNK_WORDS=1500
CONTEXT_OVERLAP_SENTENCES=3
```

### Frontend (.env)

**Optional** (defaults to localhost):
```
VITE_API_URL=http://localhost:8000
```

---

## Known Working Paths

**Fixture Data Location**:
- `/Users/ivanforcytebio/Projects/Zorro/frontend/public/fixtures/manuscript_pdf.json`
- Size: ~50KB
- Contains: Fully parsed scientific manuscript with 5000+ words
- Use case: Direct POST to `/review/demo/start` for testing

**API Routes**:
- `/backend/app/api/routes/review.py` (lines 62-88 = demo/start endpoint)
- Lines 113-124 show POST request structure in ProcessScreen

**Mode Toggle**:
- SetupScreen.tsx line 449-468: Toggle between "Static" and "Dynamic"
- Initial state: demo mode (line 62 in store/index.ts)

---

## Blockers to Handle

1. **Port Conflicts**: 
   - Backend uses 8000 (check with `lsof -i :8000`)
   - Frontend uses 5173 (check with `lsof -i :5173`)
   - Scripts support `--port` argument

2. **Virtual Environment**:
   - Must be activated before `pip install`
   - Scripts try to auto-detect `.venv` or `../.venv`

3. **API Keys**:
   - Not needed for demo mode
   - Can use dummy values for testing API structure
   - Real calls blocked by agents checking flags

4. **Node/Python Version**:
   - Python 3.11+ (checking in pyproject.toml)
   - Node 18+ (checking in scripts)

---

## Documents Generated

1. **FRONTEND_BACKEND_TESTING.md** (15KB)
   - Complete integration guide
   - 11 sections with step-by-step instructions
   - Checklist format
   - File reference summary
   - Troubleshooting guide

2. **INTEGRATION_QUICK_START.md** (3KB)
   - Quick reference (fits on screen)
   - Key commands only
   - Common issues table
   - Links to detailed guide

3. **RESEARCH_SUMMARY.md** (this file)
   - What I found
   - Key discoveries
   - Data structure details
   - File reference

---

## Next Actions

1. Copy both guides to `/docs/` directory ✓ Done
2. Follow Part 2-3 of FRONTEND_BACKEND_TESTING.md to set up
3. Use INTEGRATION_QUICK_START.md for development workflow
4. Reference CLAUDE.md for coding standards while modifying

---

## Key Insights

1. **Fixture-First Testing**: The frontend has a pre-built DocObj fixture that's ready to send to the backend. No need to upload/parse a document first.

2. **Two Independent Flows**: Demo mode works entirely in the frontend (good for testing UI). Dynamic mode needs both services running (good for testing integration).

3. **SSE for Real-Time**: Backend uses Server-Sent Events (EventSource API) for real-time findings streaming, not WebSockets.

4. **Immutable DocObj**: Once created, the DocObj never changes. All agents read from the same structure and create independent findings with text anchors.

5. **Pydantic v2**: All models use Pydantic v2 for validation and JSON schema generation.

6. **Auto-Reload**: Both `start.sh` scripts support auto-reload on file changes (uvicorn with --reload, Vite by default).
