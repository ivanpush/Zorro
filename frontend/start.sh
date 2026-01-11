#!/bin/bash
# ZORRO Frontend Startup Script
# Usage: ./start.sh [--port PORT]

set -e

# Default port
PORT=${1:-5173}
if [[ "$1" == "--port" ]]; then
    PORT=$2
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting ZORRO Frontend...${NC}"
echo -e "${YELLOW}Port: ${PORT}${NC}"

# Change to frontend directory
cd "$(dirname "$0")"

# Check node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Kill any existing process on the port
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

# Start vite
echo -e "${GREEN}Starting Vite on http://localhost:${PORT}${NC}"
echo ""
npm run dev -- --port $PORT
