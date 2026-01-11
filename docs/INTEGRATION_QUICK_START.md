# Frontend + Backend Integration - Quick Start Guide

**Generated**: 2026-01-10

## 1-Minute Overview

ZORRO has two modes:
- **Demo Mode**: Frontend loads fixture data locally (no backend needed)
- **Dynamic Mode**: Frontend sends document to backend API, waits for findings via SSE

This guide gets both running for testing in ~20 minutes.

---

## Prerequisites Check

```bash
python3 --version          # >= 3.11
node --version             # >= 18
npm --version              # >= 9
```

---

## Backend Setup (10 min)

```bash
cd /Users/ivanforcytebio/Projects/Zorro/backend

# 1. Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -e ".[dev]"

# 3. Create .env with API keys
cat > .env << 'EOF'
ANTHROPIC_API_KEY=test-key
PERPLEXITY_API_KEY=test-key
DEBUG=False
LOG_LEVEL=INFO
DEMO_MODE_DEFAULT=True
MAX_CONCURRENT_AGENTS=4
EOF

# 4. Start server
./start.sh
# Should show: "Uvicorn running on http://0.0.0.0:8000"
```

**Keep this terminal running.**

---

## Frontend Setup (5 min)

**In a new terminal:**

```bash
cd /Users/ivanforcytebio/Projects/Zorro/frontend

# 1. Install dependencies
npm install

# 2. Create .env (optional, already defaults to localhost:8000)
echo "VITE_API_URL=http://localhost:8000" > .env

# 3. Start dev server
./start.sh
# Should show: "Local: http://localhost:5173/"
```

**Keep this terminal running.**

---

## Test It (5 min)

### Option A: Demo Mode (No Backend Needed)

1. Open http://localhost:5173/
2. Navigate to Setup Screen
3. Verify "Static" toggle is selected (bottom of page)
4. Click "Run Review"
5. Should see ReviewScreen with ~6 pre-loaded findings

**Result**: Frontend-only flow works

---

### Option B: Dynamic Mode (Full Integration)

1. Open http://localhost:5173/
2. Navigate to Setup Screen
3. Click "Dynamic" toggle (bottom of page)
4. Click "Run Review"
5. Should see ProcessScreen with real-time updates
6. Phases should cycle: Researching → Assessing → Evaluating → Synthesizing
7. Findings appear as agents discover them
8. After ~30-60 sec, navigates to ReviewScreen

**Result**: Full integration works

---

## Test with cURL

**From a third terminal:**

```bash
# Health check
curl http://localhost:8000/health

# Start a review with test data
JOB_ID=$(curl -s -X POST http://localhost:8000/review/demo/start \
  -H "Content-Type: application/json" \
  -d @/Users/ivanforcytebio/Projects/Zorro/frontend/public/fixtures/manuscript_pdf.json \
  | jq -r '.job_id')

echo "Job ID: $JOB_ID"

# Stream SSE events
curl -N http://localhost:8000/review/$JOB_ID/stream | head -20

# Get final results (in another terminal)
curl http://localhost:8000/review/$JOB_ID/result | jq '.findings | length'
```

---

## File Locations

| Component | Location | Purpose |
|-----------|----------|---------|
| Backend code | `/backend/app/` | FastAPI app, agents, models |
| Backend startup | `/backend/start.sh` | Launches uvicorn |
| Backend config | `/backend/app/config/settings.py` | Settings from `.env` |
| Frontend code | `/frontend/src/` | React app, screens, components |
| Frontend startup | `/frontend/start.sh` | Launches Vite dev server |
| Test fixture | `/frontend/public/fixtures/manuscript_pdf.json` | Sample DocObj for testing |
| API routes | `/backend/app/api/routes/review.py` | REST endpoints |
| Models | `/backend/app/models/` | Pydantic schemas (DocObj, Finding, etc.) |

---

## Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Backend health check |
| `/review/demo/start` | POST | Start review with DocObj |
| `/review/{job_id}/stream` | GET | SSE event stream |
| `/review/{job_id}/result` | GET | Final findings |

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Port 8000 in use | `lsof -i :8000` then `kill -9 <PID>` or use `./start.sh --port 9000` |
| Port 5173 in use | `./start.sh --port 3000` |
| `pip install` fails | Ensure venv activated: `source .venv/bin/activate` |
| `npm install` fails | Delete `node_modules` and `package-lock.json`, reinstall |
| API returns 404 | Ensure backend is running on port 8000 |
| Fixture not found | Check `/frontend/public/fixtures/manuscript_pdf.json` exists |

---

## Development Workflow

```bash
# Terminal 1: Backend
cd /Users/ivanforcytebio/Projects/Zorro/backend
source .venv/bin/activate
./start.sh
# Auto-reloads on file changes

# Terminal 2: Frontend
cd /Users/ivanforcytebio/Projects/Zorro/frontend
./start.sh
# Auto-reloads on file changes

# Terminal 3: Testing
cd /Users/ivanforcytebio/Projects/Zorro
# Run tests, manual API calls, etc.
pytest backend/tests/
```

---

## What's Happening Under the Hood

### Demo Mode Flow
```
UploadScreen → SetupScreen (toggle "Static")
  → loadDemoDocument('manuscript_pdf')
  → loads /fixtures/manuscript_pdf.json
  → loadDemoFindings('manuscript_pdf')
  → ReviewScreen displays findings
  
No API calls, all local
```

### Dynamic Mode Flow
```
UploadScreen → SetupScreen (toggle "Dynamic")
  → ProcessScreen
  → POST /review/demo/start { document, config }
  → Receive job_id
  → EventSource /review/{job_id}/stream
  → Listen for events (agent_started, finding_discovered, etc.)
  → Accumulate findings as they arrive
  → ReviewCompleted event triggers navigation
  → ReviewScreen displays findings
```

---

## Next Steps

1. **Verify both running**: 
   - `curl http://localhost:8000/health` (backend)
   - Visit `http://localhost:5173/` (frontend)

2. **Test demo mode**: Click "Static" toggle, run review
   
3. **Test dynamic mode**: Click "Dynamic" toggle, run review (backend must be running)

4. **Inspect API**: Open `http://localhost:8000/docs` (Swagger UI)

5. **Debug in browser**: 
   - DevTools Network tab to see API calls
   - Console to see JavaScript errors
   - Application tab to see Zustand state

6. **Check backend logs**: 
   - Terminal 1 shows Uvicorn logs
   - Structured logging with agent phase info

---

## Document Structure (DocObj)

The fixture contains a fully-parsed scientific manuscript:

```json
{
  "document_id": "man_f61b2cf0",
  "title": "Building an atlas of mechanobiology...",
  "type": "pdf",
  "sections": [
    { "section_id": "abstract", "section_title": "Abstract", ... },
    { "section_id": "sec_intro", "section_title": "1. Introduction", ... }
  ],
  "paragraphs": [
    {
      "paragraph_id": "p_abs_1",
      "text": "Full paragraph text here...",
      "sentences": [
        {
          "sentence_id": "p_abs_1_s_001",
          "text": "Individual sentence...",
          "start_char": 0,
          "end_char": 42
        }
      ]
    }
  ],
  "figures": [...],
  "metadata": { "wordCount": 5234, "pageCount": 12, ... }
}
```

Agents read from this and create Finding objects with text anchors.

---

## For More Details

See `/Users/ivanforcytebio/Projects/Zorro/docs/FRONTEND_BACKEND_TESTING.md` for:
- Detailed architecture explanation
- Complete checklist with all steps
- Troubleshooting guide
- File reference summary
- Development workflow details
- Testing strategies

---

## Support

If stuck:
1. Check `FRONTEND_BACKEND_TESTING.md` Part 8 (Blockers & Known Issues)
2. Look at backend logs in terminal
3. Check browser DevTools Console
4. Verify both servers running with `curl` health checks
5. Ensure `.env` files created in both directories
