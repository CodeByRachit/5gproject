#!/usr/bin/env bash
# ==============================================================================
# 5G Smart Campus Traffic Monitoring - Native Non-Docker Runner
# Runs MongoDB, Node.js Backend, and React Frontend directly under user account
# ZERO SUDO / ZERO DOCKER REQUIRED
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
echo -e "${BOLD}${CYAN} Mode: Native Process (No Docker / Non-Sudo / User $(whoami))     ${NC}"
echo -e "${BOLD}${CYAN}==================================================================${NC}"

# 1. Check Node.js and Python
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}[ERROR] Node.js is not installed on this host.${NC}"
  exit 1
fi

echo -e "${GREEN}[✓] Node.js $(node -v) detected.${NC}"
echo -e "${GREEN}[✓] NPM $(npm -v) detected.${NC}"

# 2. Setup directories and assets
mkdir -p data/mongo data/uploads backend/models backend/data/seed logs

# Copy model and seeds if needed
if [ ! -f "backend/models/yolov8n.onnx" ] && [ -f "5G_Smart_Campus_Traffic_Dual_Input/yolov8n.onnx" ]; then
  cp 5G_Smart_Campus_Traffic_Dual_Input/yolov8n.onnx backend/models/yolov8n.onnx
fi
if [ ! -f "backend/data/seed/traffic_history.csv" ] && [ -f "5G_Smart_Campus_Traffic_Dual_Input/data/traffic_history.csv" ]; then
  cp 5G_Smart_Campus_Traffic_Dual_Input/data/traffic_history.csv backend/data/seed/traffic_history.csv
fi
if [ ! -f "backend/data/seed/traffic_alerts.csv" ] && [ -f "5G_Smart_Campus_Traffic_Dual_Input/data/traffic_alerts.csv" ]; then
  cp 5G_Smart_Campus_Traffic_Dual_Input/data/traffic_alerts.csv backend/data/seed/traffic_alerts.csv
fi

# 3. Start MongoDB if mongod binary is installed
if command -v mongod >/dev/null 2>&1; then
  echo -e "${CYAN}[*] Starting user-space MongoDB daemon on port 27017...${NC}"
  mongod --dbpath "$(pwd)/data/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$(pwd)/logs/mongod.log" --fork || true
else
  echo -e "${YELLOW}[!] mongod binary not in PATH. Assuming MongoDB is already active or using external URI.${NC}"
fi

# 4. Install backend dependencies and seed
echo -e "${CYAN}[*] Initializing Backend dependencies...${NC}"
cd backend
npm install --omit=dev

echo -e "${CYAN}[*] Seeding database...${NC}"
npm run seed || true

echo -e "${CYAN}[*] Starting Node.js Backend Server on port 5000 in background...${NC}"
nohup npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}[✓] Backend running (PID: ${BACKEND_PID}). Logs: logs/backend.log${NC}"
cd ..

# 5. Build and serve Frontend
echo -e "${CYAN}[*] Initializing and building Frontend...${NC}"
cd frontend
npm install
npm run build

echo -e "${CYAN}[*] Serving Frontend on unprivileged port 8080 in background...${NC}"
nohup npx --yes serve -s dist -l 8080 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}[✓] Frontend running (PID: ${FRONTEND_PID}). Logs: logs/frontend.log${NC}"
cd ..

# 6. Enable lingering so processes stay alive after SSH logout
if command -v loginctl >/dev/null 2>&1; then
  loginctl enable-linger "$(whoami)" 2>/dev/null || true
fi

# 7. Summary
HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")
echo ""
echo -e "${BOLD}${GREEN}==================================================================${NC}"
echo -e "${BOLD}${GREEN} 🎉 5G Smart Campus Traffic Monitoring System Active (Native)!    ${NC}"
echo -e "${BOLD}${GREEN}==================================================================${NC}"
echo -e "  🌐 Frontend Dashboard: http://${HOST_IP}:8080"
echo -e "  📡 REST API:            http://${HOST_IP}:5000/api"
echo -e "  ⚡ WebSocket Stream:    http://${HOST_IP}:5000"
echo -e "  📄 Logs:                tail -f logs/backend.log"
echo -e "${BOLD}${GREEN}==================================================================${NC}"
