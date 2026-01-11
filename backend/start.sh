#!/bin/bash
# ZORRO Backend Startup Script
# Usage: ./start.sh [--port PORT]

set -e

# Default port
PORT=${1:-8000}
if [[ "$1" == "--port" ]]; then
    PORT=$2
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ZORRO Backend...${NC}"
echo -e "${YELLOW}Port: ${PORT}${NC}"

# Change to backend directory (in case run from elsewhere)
cd "$(dirname "$0")"

# Check for virtual environment and activate if exists
if [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
elif [ -d "../.venv" ]; then
    echo "Activating project virtual environment..."
    source ../.venv/bin/activate
fi

# Check dependencies
if ! python -c "import fastapi" 2>/dev/null; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pip install -e ".[dev]"
fi

# Kill any existing process on the port
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

# Start uvicorn
echo -e "${GREEN}Starting uvicorn on http://localhost:${PORT}${NC}"
echo ""
uvicorn app.main:app --reload --host 0.0.0.0 --port $PORT
