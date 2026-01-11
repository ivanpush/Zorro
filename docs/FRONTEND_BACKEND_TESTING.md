# Frontend + Backend Integration Testing Checklist

Generated: 2026-01-10

## System Architecture Overview

```
Frontend (React/Vite - Port 5173)
    ↓
    ├─ Demo Mode: Loads fixture data locally
    │   - Fixture: /frontend/public/fixtures/manuscript_pdf.json (DocObj)
    │   - Findings: Simulated or pre-loaded
    │
    └─ Dynamic Mode: Calls Backend API
        ├─ POST /review/demo/start → Backend parses & queues
        ├─ SSE /review/{job_id}/stream → Real-time events
        └─ GET /review/{job_id}/result → Final results

Backend (FastAPI - Port 8000)
    ├─ Models: Pydantic v2 data structures
    ├─ Agents: Multi-agent orchestration
    └─ Services: Orchestrator, SSE event streaming
```

---

## Part 1: Prerequisites

### System Requirements
- Python 3.11+
- Node.js 18+
- macOS/Linux (tested on Darwin 25.0.0)

### Check Existing Setup
```bash
# Python
python3 --version  # Should be >= 3.11

# Node
node --version     # Should be >= 18
npm --version      # Should be >= 9

# Git
cd /Users/ivanforcytebio/Projects/Zorro
git status         # Confirm you're in the repo
```

---

## Part 2: Backend Setup

### 2.1 Python Dependencies

Current dependencies (from `backend/pyproject.toml`):
```
fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
httpx>=0.26.0
anthropic>=0.18.0
instructor>=1.0.0
python-multipart>=0.0.6
structlog>=24.1.0
PyMuPDF>=1.23.0          # PDF parsing
python-docx>=1.1.0       # DOCX parsing
```

### 2.2 Create Python Virtual Environment

```bash
cd /Users/ivanforcytebio/Projects/Zorro/backend

# Option A: Using venv (recommended)
python3 -m venv .venv
source .venv/bin/activate

# Option B: Using conda
conda create -n zorro-backend python=3.11
conda activate zorro-backend
```

### 2.3 Install Backend Dependencies

```bash
cd /Users/ivanforcytebio/Projects/Zorro/backend

# Install in editable mode with dev dependencies
pip install -e ".[dev]"

# Verify installation
python -c "import fastapi, pydantic, anthropic; print('✓ Core deps OK')"
```

### 2.4 Backend Environment Variables

Create `backend/.env`:
```bash
# Required - Get from Anthropic console
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE

# Required - Get from Perplexity  
PERPLEXITY_API_KEY=pplx-YOUR_KEY_HERE

# Optional
DEBUG=False
LOG_LEVEL=INFO
DEMO_MODE_DEFAULT=True
MAX_CONCURRENT_AGENTS=4
```

**For Testing Without API Keys:**
- Demo mode skips API calls
- Can test API structure without real keys
- Use `export ANTHROPIC_API_KEY=test-key` if needed

### 2.5 Verify Backend Imports

```bash
cd /Users/ivanforcytebio/Projects/Zorro/backend

# Test imports
python -c "from app.main import app; print('✓ Main app loads')"
python -c "from app.models import DocObj, Finding, ReviewJob; print('✓ Models load')"
python -c "from app.api.routes import review_router; print('✓ Routes load')"
```

---

## Part 3: Frontend Setup

### 3.1 Install Node Dependencies

```bash
cd /Users/ivanforcytebio/Projects/Zorro/frontend

# Clean install
rm -rf node_modules package-lock.json
npm install
```

### 3.2 Frontend Environment Variables

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:8000
```

Default is already `http://localhost:8000`, so this is optional.

### 3.3 Verify Frontend Build

```bash
cd /Users/ivanforcytebio/Projects/Zorro/frontend

# Type check
npm run lint

# Verify app loads (optional, full build)
npm run build
```

---

## Part 4: API Endpoint Verification

### 4.1 Key Backend Endpoints

| Endpoint | Method | Purpose | Input |
|----------|--------|---------|-------|
| `/health` | GET | Health check | - |
| `/review/demo/start` | POST | Start review with DocObj | `{ document: DocObj, config: ReviewConfig }` |
| `/review/{job_id}/stream` | GET | SSE event stream | - |
| `/review/{job_id}/result` | GET | Get final results | - |

### 4.2 Request/Response Models

**POST /review/demo/start**
```typescript
// Request
{
  document: DocObj,              // Full document structure
  config: ReviewConfig {         // Optional
    panel_mode?: boolean
    steering_memo?: string
    enable_domain?: boolean
  }
}

// Response
{
  job_id: string                 // UUID for tracking
}
```

**DocObj Structure** (Loaded from fixture)
```typescript
{
  document_id: string
  filename: string
  type: 'pdf' | 'docx'
  title: string
  sections: Section[]            // Heading hierarchy
  paragraphs: Paragraph[] {       // Full text segments
    paragraph_id: string
    text: string
    sentences: Sentence[]
  }
  figures: Figure[]
  metadata: DocumentMetadata
  createdAt: ISO8601
}
```

### 4.3 Fixture Data Available

**Frontend has a pre-parsed DocObj:**
- Location: `/frontend/public/fixtures/manuscript_pdf.json`
- Type: Fully structured DocObj
- Size: ~50KB JSON
- Ready to POST to backend

This is the **test data you'll use** to verify API integration.

---

## Part 5: Demo vs Dynamic Mode

### Demo Mode (No Backend)
```
SetupScreen → User clicks "Run Review" → SetupScreen loads demo findings
  → Navigates to ReviewScreen with pre-loaded findings
  → No API calls
  → Uses: /frontend/public/fixtures/manuscript_pdf.json
  → Uses: frontend/src/services/fixtures.ts (loadDemoFindings)
```

**Enabled by:**
- Toggle at bottom of SetupScreen: "Static" vs "Dynamic"
- Initial state in `frontend/src/store/index.ts`: `reviewMode: 'demo'`
- Loading findings from fixtures in SetupScreen.tsx line 128-139

### Dynamic Mode (With Backend)
```
UploadScreen → SetupScreen (select Dynamic) → ProcessScreen
  → POST /review/demo/start with DocObj
  → SSE stream /review/{job_id}/stream (real-time events)
  → Accumulate findings as they arrive
  → GET /review/{job_id}/result for final state
  → Navigate to ReviewScreen with findings
```

**Enabled by:**
- Toggle in SetupScreen: "Static" vs "Dynamic"
- Frontend calls `${API_BASE}/review/demo/start` (ProcessScreen.tsx line 113)
- Connects to EventSource for SSE (ProcessScreen.tsx line 141)

---

## Part 6: Start Both Services

### 6.1 Backend Startup

```bash
# Option A: Manual
cd /Users/ivanforcytebio/Projects/Zorro/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Option B: Using provided script
cd /Users/ivanforcytebio/Projects/Zorro/backend
./start.sh
# or with custom port:
./start.sh --port 9000
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### 6.2 Frontend Startup

```bash
# Option A: Manual
cd /Users/ivanforcytebio/Projects/Zorro/frontend
npm run dev -- --port 5173

# Option B: Using provided script
cd /Users/ivanforcytebio/Projects/Zorro/frontend
./start.sh
# or with custom port:
./start.sh --port 3000
```

**Expected output:**
```
✓ built in Xs
➜  Local:   http://localhost:5173/
```

### 6.3 Verify Both Are Running

```bash
# In separate terminals
curl http://localhost:8000/health      # Backend health check
curl http://localhost:5173/            # Frontend (may return HTML)
```

---

## Part 7: Testing the Integration

### 7.1 Test Demo Mode (No Backend Required)

1. Open http://localhost:5173/ in browser
2. On SetupScreen, verify "Static" toggle is selected
3. Click "Run Review"
4. Should navigate to ReviewScreen with pre-loaded findings (~6 findings)
5. No errors about missing API

**What's happening:**
- Fixture data loaded from `/fixtures/manuscript_pdf.json`
- Findings created by `createSimpleDemoFindings()` in fixtures.ts
- No backend calls made

### 7.2 Test Dynamic Mode (With Backend)

**Prerequisites:**
- Backend running on http://localhost:8000
- API keys set (even dummy values for now)

**Steps:**

1. Open http://localhost:5173/ in browser
2. Upload a document (or let it auto-select the fixture)
3. On SetupScreen, click "Dynamic" toggle at bottom
4. Click "Run Review"
5. Should navigate to ProcessScreen with live updates
6. Watch the phases: Researching → Assessing → Evaluating → Synthesizing
7. Findings should appear in real-time
8. Should eventually navigate to ReviewScreen with final findings

**Check the browser console for:**
```
✓ No "Failed to fetch" errors
✓ SSE events arriving (should see in Network tab)
✓ Findings being added to store
```

**Check backend logs for:**
```
✓ POST /review/demo/start received
✓ Document stored with ID
✓ Job created
✓ SSE stream connected
✓ Agent phases starting
```

### 7.3 Test API Directly (cURL)

```bash
# 1. Start review with fixture data
curl -X POST http://localhost:8000/review/demo/start \
  -H "Content-Type: application/json" \
  -d @/Users/ivanforcytebio/Projects/Zorro/frontend/public/fixtures/manuscript_pdf.json \
  | jq '.job_id'

# 2. Save the job_id and stream events
JOB_ID="<from step 1>"
curl -N http://localhost:8000/review/$JOB_ID/stream

# 3. Get final results (in another terminal)
curl http://localhost:8000/review/$JOB_ID/result | jq '.findings | length'
```

---

## Part 8: Blockers & Known Issues

### 8.1 Environment Variables

**Blocker:** API keys not set
- **Impact:** Agents can't make LLM calls
- **Solution:** Set dummy keys or use demo mode
- **Workaround:** Backend has `demo_mode_default=True` by default

**Blocker:** `VITE_API_URL` not set
- **Impact:** Frontend calls wrong API endpoint
- **Solution:** Frontend defaults to `http://localhost:8000`
- **Workaround:** Manually set in frontend/.env

### 8.2 Port Conflicts

**Blocker:** Backend port 8000 already in use
- **Solution:** Use `lsof -i :8000` to find process, then kill or use different port
- **Workaround:** `./start.sh --port 9000` then update frontend `.env`

**Blocker:** Frontend port 5173 already in use
- **Solution:** Use `./start.sh --port 3000`

### 8.3 Missing Node Modules

**Blocker:** Node packages not installed
- **Solution:** `cd frontend && npm install`

### 8.4 Python Venv Not Activated

**Blocker:** `pip install` fails or wrong Python version
- **Solution:** Explicitly source venv: `source backend/.venv/bin/activate`

### 8.5 Fixture File Not Found

**Blocker:** 404 when loading `/fixtures/manuscript_pdf.json`
- **Check:** File exists at `frontend/public/fixtures/manuscript_pdf.json`
- **Solution:** Ensure frontend/public/ is served by Vite
- **Verify:** Vite serves static files from `public/` automatically

---

## Part 9: Development Workflow

### Terminal 1: Backend
```bash
cd /Users/ivanforcytebio/Projects/Zorro/backend
source .venv/bin/activate
./start.sh
# Uvicorn auto-reloads on file changes
```

### Terminal 2: Frontend
```bash
cd /Users/ivanforcytebio/Projects/Zorro/frontend
./start.sh
# Vite auto-reloads on file changes
```

### Terminal 3: Testing/Exploration
```bash
cd /Users/ivanforcytebio/Projects/Zorro
# Run tests, check logs, etc.
```

---

## Part 10: Quick Reference - First-Time Setup

```bash
# 1. Backend (10-15 min)
cd /Users/ivanforcytebio/Projects/Zorro/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
echo "ANTHROPIC_API_KEY=test-key" > .env
echo "PERPLEXITY_API_KEY=test-key" >> .env
./start.sh
# Ctrl+C to stop, keep running

# 2. Frontend (5-10 min) [NEW TERMINAL]
cd /Users/ivanforcytebio/Projects/Zorro/frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
./start.sh
# Keep running

# 3. Test (NEW TERMINAL or Browser)
# Option A: Browser demo mode
open http://localhost:5173

# Option B: Test API
curl http://localhost:8000/health
```

---

## Part 11: File Reference Summary

### Backend Key Files
```
backend/
├── pyproject.toml              # Dependencies (Python 3.11+)
├── .env                        # API keys (create manually)
├── start.sh                    # Startup script
├── app/
│   ├── main.py                 # FastAPI app entry
│   ├── config/
│   │   ├── settings.py         # Settings from .env
│   │   └── models.py           # Model costs, agent registry
│   ├── models/                 # Pydantic data structures
│   │   ├── __init__.py         # Exports all models
│   │   ├── document.py         # DocObj, Section, Paragraph
│   │   ├── finding.py          # Finding, Anchor, ProposedEdit
│   │   ├── review.py           # ReviewConfig, ReviewJob
│   │   └── events.py           # SSE event types
│   ├── api/routes/
│   │   └── review.py           # POST /review/demo/start, GET /review/{job_id}/stream
│   ├── services/
│   │   ├── orchestrator.py     # Agent coordination
│   │   └── assembler.py        # Finding dedup/merge
│   └── agents/                 # Individual agents
└── tests/                      # Pytest suite
```

### Frontend Key Files
```
frontend/
├── package.json                # npm dependencies (Node 18+)
├── .env                        # VITE_API_URL (create manually)
├── .env.example                # Template
├── start.sh                    # Startup script
├── public/
│   └── fixtures/
│       └── manuscript_pdf.json # Demo DocObj (50KB)
└── src/
    ├── App.tsx                 # Route definitions
    ├── types/
    │   └── index.ts            # TypeScript interfaces (mirror backend)
    ├── store/
    │   └── index.ts            # Zustand state (document, findings, config)
    ├── screens/
    │   ├── UploadScreen.tsx     # Load document
    │   ├── SetupScreen.tsx      # Configure review (Demo/Dynamic toggle)
    │   ├── ProcessScreen.tsx    # Real-time progress (calls API)
    │   └── ReviewScreen.tsx     # Display findings, decisions
    ├── services/
    │   └── fixtures.ts         # loadDemoDocument, loadDemoFindings
    └── components/
        └── domain/             # FindingCard, DocumentViewer, etc.
```

---

## Checklist: Mark as Complete

- [ ] **2.1**: Backend dependencies installed (`pip install -e ".[dev]"`)
- [ ] **2.2**: Python venv created and activated
- [ ] **2.3**: Backend .env file created with API keys
- [ ] **2.4**: Backend imports verified (`python -c "from app.main import app"`)
- [ ] **3.1**: Frontend dependencies installed (`npm install`)
- [ ] **3.2**: Frontend .env file created (or using defaults)
- [ ] **3.3**: Frontend type check passes (`npm run lint`)
- [ ] **6.1**: Backend running on http://localhost:8000
- [ ] **6.2**: Frontend running on http://localhost:5173
- [ ] **6.3**: Both services respond to health checks
- [ ] **7.1**: Demo mode works (no backend calls)
- [ ] **7.2**: Dynamic mode works (backend integration)
- [ ] **7.3**: API calls verified with cURL
- [ ] **Test Data**: Fixture file exists at `/frontend/public/fixtures/manuscript_pdf.json`

---

## Next Steps After Setup

1. **Run tests**: `cd backend && pytest -v`
2. **Check logs**: Both services print structured logs
3. **Explore API**: `curl http://localhost:8000/docs` (auto-generated Swagger UI)
4. **Monitor SSE**: Open browser DevTools Network tab, check EventSource
5. **Debug state**: React DevTools + Zustand state inspection
6. **Modify agents**: Add to `backend/app/agents/` and register in orchestrator

---

## Notes

- **DocObj immutability**: Once created, DocObj never changes. All agents read from it.
- **Finding anchors**: Every finding MUST reference text via anchors (paragraphId + sentence context).
- **SSE events**: Backend streams events in real-time, frontend accumulates findings.
- **Demo fixtures**: Pre-built DocObj and findings for fast testing without API calls.
- **Pydantic v2**: All models use Pydantic v2 for validation and JSON serialization.

