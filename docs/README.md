# ZORRO Documentation

This directory contains all documentation for the ZORRO automated document review system.

## Getting Started

If you're setting up the frontend and backend for the first time, start here:

1. **[INTEGRATION_QUICK_START.md](INTEGRATION_QUICK_START.md)** (5 min read)
   - Quick 20-minute setup overview
   - Key commands and steps
   - Common issues and solutions

2. **[FRONTEND_BACKEND_TESTING.md](FRONTEND_BACKEND_TESTING.md)** (detailed reference)
   - Complete 11-part integration guide
   - Step-by-step instructions
   - API specifications
   - Testing procedures
   - Troubleshooting

3. **[RESEARCH_SUMMARY.md](RESEARCH_SUMMARY.md)** (reference)
   - What was researched and discovered
   - System architecture details
   - Critical files and paths
   - Data structures

## Project Documentation

Core documentation about the ZORRO system:

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design and components
- **[DATA_CONTRACTS.md](DATA_CONTRACTS.md)** - Type definitions and data structures
- **[API_CONTRACTS.md](API_CONTRACTS.md)** - REST API endpoints and contracts
- **[BEHAVIORS.md](BEHAVIORS.md)** - Agent behavior specifications
- **[BUILD_PHASES.md](BUILD_PHASES.md)** - Build plan and implementation phases
- **[PROMPTS.md](PROMPTS.md)** - All LLM prompts used by agents
- **[TESTING.md](TESTING.md)** - Testing philosophy and procedures
- **[LOGGING.md](LOGGING.md)** - Logging standards and configuration

## Quick Reference

### System Ports
- Frontend: http://localhost:5173 (Vite dev server)
- Backend: http://localhost:8000 (FastAPI)
- API Docs: http://localhost:8000/docs (Swagger UI)

### Start Commands

**Backend (Terminal 1):**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
./start.sh
```

**Frontend (Terminal 2):**
```bash
cd frontend
npm install
./start.sh
```

### Test Data
- Location: `/frontend/public/fixtures/manuscript_pdf.json`
- Ready to POST directly to `/review/demo/start` endpoint

### Key Files
- Backend entry: `/backend/app/main.py`
- Frontend entry: `/frontend/src/App.tsx`
- API routes: `/backend/app/api/routes/review.py`
- Frontend state: `/frontend/src/store/index.ts`

## Modes

### Demo Mode
Frontend loads fixture data locally, no backend API calls needed. Good for UI testing.

### Dynamic Mode
Frontend sends document to backend via REST API, receives findings in real-time via SSE (Server-Sent Events).

## Environment Variables

**Backend (.env):**
```
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
DEBUG=False
LOG_LEVEL=INFO
DEMO_MODE_DEFAULT=True
MAX_CONCURRENT_AGENTS=4
```

**Frontend (.env):**
```
VITE_API_URL=http://localhost:8000
```

## Next Steps

1. Read INTEGRATION_QUICK_START.md for a quick overview
2. Follow FRONTEND_BACKEND_TESTING.md for detailed setup
3. Test both demo and dynamic modes
4. Reference CLAUDE.md for coding standards

## Support

If you run into issues:

1. Check "Blockers & Known Issues" in FRONTEND_BACKEND_TESTING.md (Part 8)
2. Verify both services are running: `curl http://localhost:8000/health`
3. Check the browser console for JavaScript errors
4. Look at backend logs in the terminal for Python errors
5. Ensure `.env` files are created in both directories

---

Last Updated: 2026-01-10
