#!/usr/bin/env bash
# ==============================================================================
# 5G Smart Campus Traffic Monitoring & Mobility Analytics System
# Production Deployment Script for Non-Sudo / Rootless 5G Edge Servers
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}==================================================================${NC}"
echo -e "${BOLD}${CYAN} 🚦 5G Smart Campus Traffic Monitoring System - Edge Deployer     ${NC}"
echo -e "${BOLD}${CYAN} Mode: Non-Sudo / Rootless Docker / UID $(id -u)                      ${NC}"
echo -e "${BOLD}${CYAN}==================================================================${NC}"

# ------------------------------------------------------------------------------
# 1. Non-Sudo Safety Check
# ------------------------------------------------------------------------------
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)
CURRENT_USER=$(whoami)

if [ "${CURRENT_UID}" -eq 0 ]; then
  echo -e "${RED}[ERROR] Do NOT run this script as root or with sudo.${NC}"
  echo -e "This deployment is specifically designed for unprivileged users (e.g. UID 1000)."
  exit 1
fi

echo -e "${GREEN}[✓] Executing as non-root user: ${CURRENT_USER} (UID=${CURRENT_UID}, GID=${CURRENT_GID})${NC}"

# Export APP_UID/APP_GID for docker compose variable substitution (avoids Bash readonly $UID conflict)
export APP_UID="${CURRENT_UID}"
export APP_GID="${CURRENT_GID}"

# ------------------------------------------------------------------------------
# 2. Rootless Docker Socket & Daemon Detection
# ------------------------------------------------------------------------------
COMPOSE_CMD=""

if command -v docker >/dev/null 2>&1; then
  # Check for Rootless Docker socket
  XDG_DIR="${XDG_RUNTIME_DIR:-/run/user/${CURRENT_UID}}"
  ROOTLESS_SOCK="${XDG_DIR}/docker.sock"

  if [ -S "${ROOTLESS_SOCK}" ] && [ -z "${DOCKER_HOST:-}" ]; then
    echo -e "${CYAN}[i] Detected rootless Docker socket at ${ROOTLESS_SOCK}. Exporting DOCKER_HOST...${NC}"
    export DOCKER_HOST="unix://${ROOTLESS_SOCK}"
  fi

  if docker info >/dev/null 2>&1; then
    echo -e "${GREEN}[✓] Docker daemon is running and accessible.${NC}"
    if docker compose version >/dev/null 2>&1; then
      COMPOSE_CMD="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
      COMPOSE_CMD="docker-compose"
    fi
  fi
fi

# Fallback: Check for Podman
if [ -z "${COMPOSE_CMD}" ] && command -v podman >/dev/null 2>&1; then
  echo -e "${CYAN}[i] Docker not active; checking for Podman Rootless Compose...${NC}"
  if podman compose version >/dev/null 2>&1; then
    COMPOSE_CMD="podman compose"
  elif command -v podman-compose >/dev/null 2>&1; then
    COMPOSE_CMD="podman-compose"
  fi
fi

if [ -z "${COMPOSE_CMD}" ]; then
  echo -e "${RED}[ERROR] Neither Docker (rootless) nor Podman compose could be reached.${NC}"
  echo -e "Troubleshooting Steps:"
  echo -e "  1. If Rootless Docker is installed, start it with:"
  echo -e "       systemctl --user start docker"
  echo -e "  2. Ensure your shell session exports the user runtime socket:"
  echo -e "       export DOCKER_HOST=unix:///run/user/\$(id -u)/docker.sock"
  echo -e "  3. Check status with: systemctl --user status docker"
  exit 1
fi

echo -e "${GREEN}[✓] Using container orchestrator: ${COMPOSE_CMD}${NC}"

# ------------------------------------------------------------------------------
# 3. Enable Systemd User Lingering (Persistent on SSH Logout without Sudo)
# ------------------------------------------------------------------------------
echo -e "${CYAN}[*] Configuring process lingering to keep services alive after SSH logout...${NC}"
if command -v loginctl >/dev/null 2>&1; then
  if loginctl enable-linger "${CURRENT_USER}" 2>/dev/null; then
    echo -e "${GREEN}[✓] User lingering successfully enabled via loginctl.${NC}"
  else
    echo -e "${YELLOW}[!] Note: 'loginctl enable-linger' returned non-zero. If linger is not already enabled on this host, request system admin to run: loginctl enable-linger ${CURRENT_USER}${NC}"
  fi
fi

# ------------------------------------------------------------------------------
# 4. Create Host Directories with Strict Non-Root Permissions
# ------------------------------------------------------------------------------
echo -e "${CYAN}[*] Initializing local volume directories...${NC}"
mkdir -p data/mongo data/uploads backend/models backend/data/seed

# Ensure group read/write so rootless containers with matching UID/GID never face EACCES
chmod -R 775 data
echo -e "${GREEN}[✓] Directories ready: ./data/mongo, ./data/uploads${NC}"

# ------------------------------------------------------------------------------
# 5. Asset Verification (ONNX Model & Seed CSV Data)
# ------------------------------------------------------------------------------
echo -e "${CYAN}[*] Verifying YOLOv8 ONNX model and database seed files...${NC}"

# Check YOLOv8 Model Weights
if [ ! -f "backend/models/yolov8n.onnx" ]; then
  if [ -f "5G_Smart_Campus_Traffic_Dual_Input/yolov8n.onnx" ]; then
    echo -e "${CYAN}[i] Copying yolov8n.onnx from legacy folder into backend/models/...${NC}"
    cp 5G_Smart_Campus_Traffic_Dual_Input/yolov8n.onnx backend/models/yolov8n.onnx
  else
    echo -e "${RED}[ERROR] backend/models/yolov8n.onnx is missing.${NC}"
    echo -e "Place yolov8n.onnx inside backend/models/ before building."
    exit 1
  fi
fi

# Check Seed CSV Data
if [ ! -f "backend/data/seed/traffic_history.csv" ]; then
  if [ -f "5G_Smart_Campus_Traffic_Dual_Input/data/traffic_history.csv" ]; then
    echo -e "${CYAN}[i] Copying traffic_history.csv from legacy folder into backend/data/seed/...${NC}"
    cp 5G_Smart_Campus_Traffic_Dual_Input/data/traffic_history.csv backend/data/seed/traffic_history.csv
  fi
fi

if [ ! -f "backend/data/seed/traffic_alerts.csv" ]; then
  if [ -f "5G_Smart_Campus_Traffic_Dual_Input/data/traffic_alerts.csv" ]; then
    echo -e "${CYAN}[i] Copying traffic_alerts.csv from legacy folder into backend/data/seed/...${NC}"
    cp 5G_Smart_Campus_Traffic_Dual_Input/data/traffic_alerts.csv backend/data/seed/traffic_alerts.csv
  fi
fi

echo -e "${GREEN}[✓] Asset verification complete.${NC}"

# ------------------------------------------------------------------------------
# 6. Build and Launch Stack
# ------------------------------------------------------------------------------
echo -e "${BOLD}${CYAN}[*] Building and launching 5G Smart Campus containers...${NC}"
${COMPOSE_CMD} build --pull
${COMPOSE_CMD} up -d

echo -e "${CYAN}[*] Waiting for services to become healthy...${NC}"

# Health check polling loop (up to 60 seconds)
BACKEND_HEALTHY=0
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
    BACKEND_HEALTHY=1
    break
  fi
  sleep 2
done

if [ "${BACKEND_HEALTHY}" -eq 1 ]; then
  echo -e "${GREEN}[✓] Backend service is ONLINE and healthy!${NC}"
else
  echo -e "${YELLOW}[!] Backend did not respond to local healthcheck yet. Checking container logs:${NC}"
  ${COMPOSE_CMD} logs --tail=20 backend || true
fi

# Trigger Rolling Prediction Model Initial Training
echo -e "${CYAN}[*] Triggering rolling 5-minute traffic prediction initial training...${NC}"
TRAIN_RESP=$(curl -s -X POST http://127.0.0.1:5000/api/predictions/train || echo "pending")
echo -e "${GREEN}[✓] Prediction Training Response: ${TRAIN_RESP}${NC}"

# ------------------------------------------------------------------------------
# 7. Deployment Summary & Edge Access URLs
# ------------------------------------------------------------------------------
# Detect Server IP
HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")

echo ""
echo -e "${BOLD}${GREEN}==================================================================${NC}"
echo -e "${BOLD}${GREEN} 🎉 5G Smart Campus Traffic Monitoring System Deployed!            ${NC}"
echo -e "${BOLD}${GREEN}==================================================================${NC}"
echo -e " Access your 5G dashboard and endpoints:"
echo ""
echo -e "  🌐 ${BOLD}Frontend Dashboard (HTTP):${NC}    http://${HOST_IP}:8080"
echo -e "  🔒 ${BOLD}Frontend Dashboard (HTTPS):${NC}   https://${HOST_IP}:8443"
echo -e "     ${YELLOW}↳ Note: Use HTTPS for remote browser webcam (getUserMedia) access${NC}"
echo -e "  📡 ${BOLD}REST API Healthcheck:${NC}         http://${HOST_IP}:5000/api/health"
echo -e "  ⚡ ${BOLD}WebSocket Frame Engine:${NC}       http://${HOST_IP}:5000"
echo -e "  🗄️  ${BOLD}MongoDB Database:${NC}             127.0.0.1:27017"
echo ""
echo -e "${BOLD}Helpful Non-Sudo Commands:${NC}"
echo -e "  • View live logs:      ${COMPOSE_CMD} logs -f"
echo -e "  • View backend logs:   ${COMPOSE_CMD} logs -f backend"
echo -e "  • Check status:        ${COMPOSE_CMD} ps"
echo -e "  • Stop all containers: ${COMPOSE_CMD} down"
echo -e "  • Restart stack:       ${COMPOSE_CMD} restart"
echo -e "${BOLD}${GREEN}==================================================================${NC}"
