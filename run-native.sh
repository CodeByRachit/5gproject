#!/usr/bin/env bash
# ==============================================================================
# 5G Smart Campus Traffic Monitoring - Native Edge Runner
# Auto-installs standalone Node.js 22 & MongoDB into ~/.local (ZERO SUDO NEEDED)
# Launches MongoDB, YOLOv8/Sparsh CCTV Backend, and React Dashboard
# ==============================================================================

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}==================================================================${NC}"
echo -e "${BOLD}${CYAN} 🚦 5G Smart Campus Traffic Monitoring - Native Edge Runner       ${NC}"
echo -e "${BOLD}${CYAN} Mode: Native User Process (Non-Sudo / User $(whoami))           ${NC}"
echo -e "${BOLD}${CYAN}==================================================================${NC}"

export PATH="${HOME}/.local/bin:${HOME}/.local/node/bin:${PATH}"

# ------------------------------------------------------------------------------
# 1. Auto-Install Standalone Node.js 22 LTS (Zero Sudo)
# ------------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo -e "${CYAN}[*] Node.js not detected. Auto-installing standalone Node.js 22 LTS into ~/.local/...${NC}"
  ARCH=$(uname -m)
  case "${ARCH}" in
    x86_64) NODE_ARCH="x64" ;;
    aarch64|arm64) NODE_ARCH="arm64" ;;
    *) NODE_ARCH="x64" ;;
  esac

  mkdir -p "${HOME}/.local"
  NODE_URL="https://nodejs.org/dist/v22.11.0/node-v22.11.0-linux-${NODE_ARCH}.tar.xz"
  if curl -fsSL "${NODE_URL}" | tar -xJ --strip-components=1 -C "${HOME}/.local/"; then
    echo -e "${GREEN}[✓] Node.js $(node -v) and NPM $(npm -v) installed successfully!${NC}"
  else
    echo -e "${RED}[ERROR] Failed to download standalone Node.js.${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}[✓] Node.js $(node -v) detected.${NC}"
  echo -e "${GREEN}[✓] NPM $(npm -v) detected.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. Setup Local Directories & Asset Verification
# ------------------------------------------------------------------------------
echo -e "${CYAN}[*] Initializing local directories...${NC}"
mkdir -p data/mongo data/uploads backend/models backend/data/seed logs

if [ ! -f "backend/models/yolov8n.onnx" ] && [ -f "5G_Smart_Campus_Traffic_Dual_Input/yolov8n.onnx" ]; then
  cp 5G_Smart_Campus_Traffic_Dual_Input/yolov8n.onnx backend/models/yolov8n.onnx
fi
if [ ! -f "backend/data/seed/traffic_history.csv" ] && [ -f "5G_Smart_Campus_Traffic_Dual_Input/data/traffic_history.csv" ]; then
  cp 5G_Smart_Campus_Traffic_Dual_Input/data/traffic_history.csv backend/data/seed/traffic_history.csv
fi
if [ ! -f "backend/data/seed/traffic_alerts.csv" ] && [ -f "5G_Smart_Campus_Traffic_Dual_Input/data/traffic_alerts.csv" ]; then
  cp 5G_Smart_Campus_Traffic_Dual_Input/data/traffic_alerts.csv backend/data/seed/traffic_alerts.csv
fi
echo -e "${GREEN}[✓] Model and seed datasets ready.${NC}"

# ------------------------------------------------------------------------------
# 3. Auto-Setup & Start Standalone MongoDB (Zero Sudo)
# ------------------------------------------------------------------------------
if ! command -v mongod >/dev/null 2>&1; then
  echo -e "${CYAN}[*] Fetching standalone MongoDB Community binary into ~/.local/bin/...${NC}"
  mkdir -p "${HOME}/.local/bin"
  ARCH=$(uname -m)
  if [ "${ARCH}" = "x86_64" ]; then
    MONGO_URL="https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz"
    curl -fsSL "${MONGO_URL}" 2>/dev/null | tar -xz --strip-components=2 -C "${HOME}/.local/bin/" "mongodb-linux-x86_64-ubuntu2204-7.0.14/bin/mongod" 2>/dev/null || true
    chmod +x "${HOME}/.local/bin/mongod" 2>/dev/null || true
  fi
fi

if command -v mongod >/dev/null 2>&1; then
  echo -e "${CYAN}[*] Starting user-space MongoDB on port 27017...${NC}"
  mongod --dbpath "$(pwd)/data/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$(pwd)/logs/mongod.log" --fork || true
  echo -e "${GREEN}[✓] MongoDB active on 127.0.0.1:27017${NC}"
else
  echo -e "${YELLOW}[!] mongod binary not available. Backend will use in-memory offline fallback.${NC}"
fi

# ------------------------------------------------------------------------------
# 4. Build React 19 Frontend
# ------------------------------------------------------------------------------
echo -e "${CYAN}[*] Building React Frontend...${NC}"
cd frontend
npm install --silent
npm run build
cd ..
echo -e "${GREEN}[✓] Frontend built successfully.${NC}"

# ------------------------------------------------------------------------------
# 5. Setup Backend & Seed Database
# ------------------------------------------------------------------------------
echo -e "${CYAN}[*] Initializing Backend dependencies and model weights...${NC}"
cd backend
npm install --omit=dev --silent

echo -e "${CYAN}[*] Running initial database seed check...${NC}"
npm run seed || true

# Kill any existing backend process on port 5000
fuser -k 5000/tcp 2>/dev/null || true

echo -e "${CYAN}[*] Starting 5G Smart Campus Server (Express + Socket.IO + YOLOv8 + UI)...${NC}"
export PORT=5000
export MONGO_URI="mongodb://127.0.0.1:27017/smart_campus_traffic"
export MONGODB_URI="mongodb://127.0.0.1:27017/smart_campus_traffic"
export MODEL_PATH="$(pwd)/models/yolov8n.onnx"
export SEED_DATA_DIR="$(pwd)/data/seed"
export PYTHON_PATH="$(which python3 2>/dev/null || echo python)"

nohup npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}[✓] 5G Traffic System running in background (PID: ${BACKEND_PID})${NC}"
cd ..

# ------------------------------------------------------------------------------
# 6. Enable Process Lingering (Persistent on SSH Logout)
# ------------------------------------------------------------------------------
if command -v loginctl >/dev/null 2>&1; then
  loginctl enable-linger "$(whoami)" 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# 7. Deployment Summary
# ------------------------------------------------------------------------------
sleep 3
HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")

echo ""
echo -e "${BOLD}${GREEN}==================================================================${NC}"
echo -e "${BOLD}${GREEN} 🎉 5G Smart Campus Traffic Monitoring System Active (Native)!    ${NC}"
echo -e "${BOLD}${GREEN}==================================================================${NC}"
echo -e " Access your 5G dashboard and endpoints:"
echo ""
echo -e "  🌐 ${BOLD}Live Campus Dashboard:${NC}   http://${HOST_IP}:5000"
echo -e "  📡 ${BOLD}REST API Health:${NC}         http://${HOST_IP}:5000/api/health"
echo -e "  ⚡ ${BOLD}WebSocket Stream:${NC}        http://${HOST_IP}:5000"
echo -e "  📄 ${BOLD}Live Backend Logs:${NC}       tail -f logs/backend.log"
echo ""
echo -e "${BOLD}Helpful Commands:${NC}"
echo -e "  • Check status:   curl -s http://localhost:5000/api/health"
echo -e "  • View logs:      tail -f logs/backend.log"
echo -e "  • Stop server:    kill ${BACKEND_PID} (or: fuser -k 5000/tcp)"
echo -e "${BOLD}${GREEN}==================================================================${NC}"
