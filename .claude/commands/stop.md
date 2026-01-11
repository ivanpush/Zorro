# Stop Development Servers

Kill all frontend and backend development servers and clear ports.

## Instructions

1. **Kill processes on port 8000** (backend):
   ```bash
   lsof -ti:8000 | xargs kill 2>/dev/null || true
   ```

2. **Kill processes on port 5173** (frontend):
   ```bash
   lsof -ti:5173 | xargs kill 2>/dev/null || true
   ```

3. **Kill any running background shells** for dev servers if they exist

4. **Verify ports are free**:
   ```bash
   lsof -i:8000,5173
   ```
   Should return empty (no processes)

5. **Report status** to user confirming both ports are cleared

## Port Reference

| Service  | Port |
|----------|------|
| Frontend | 5173 |
| Backend  | 8000 |
