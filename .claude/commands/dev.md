# Start Development Servers

Launch both frontend and backend development servers.

## Instructions

1. **Kill any existing processes** on ports 8000 (backend) and 5173 (frontend)

2. **Start Backend** (port 8000):
   ```bash
   cd backend && ./start.sh
   ```
   Run this in background mode.

3. **Start Frontend** (port 5173):
   ```bash
   cd frontend && npm run dev
   ```
   Run this in background mode.

4. **Verify both are running**:
   - Check backend: `curl -s http://localhost:8000/health`
   - Check frontend: `curl -s http://localhost:5173` (or check process)

5. **Report status** to user with URLs:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - Backend Health: http://localhost:8000/health
   - API Docs: http://localhost:8000/docs

## Port Configuration

| Service  | Port | Purpose |
|----------|------|---------|
| Frontend | 5173 | Vite dev server |
| Backend  | 8000 | FastAPI/uvicorn |

## Notes

- Frontend connects to backend via `VITE_API_URL` env var (defaults to http://localhost:8000)
- Backend has CORS configured for all origins in dev mode
- Use `/dev stop` intention to kill both servers
