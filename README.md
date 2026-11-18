# 🚦 5G Smart Campus Traffic Monitoring & Mobility Analytics System

Enterprise-level Intelligent Transportation System (ITS) modernizing campus traffic monitoring into a full-stack **React.js + Node.js + Express.js + MongoDB + Socket.IO** architecture with **YOLOv8** object detection and **ByteTrack** multi-object tracking.

---

## 🌟 Key Features

1. **Modern Enterprise UI**: High-performance React 19 + Vite dashboard styled with Tailwind CSS, Recharts, and Lucide React.
2. **Multi-Input Camera Support**:
   - Built-in Laptop Webcam (via browser `navigator.mediaDevices.getUserMedia()`)
   - External USB Optical Cameras (DirectShow device indexing)
   - Sparsh IP CCTV (RTSP H.264 streams)
   - Video File Upload (MP4, AVI, MOV, MKV)
3. **YOLOv8 Object Detection**: Pretrained COCO weights identifying cars, motorcycles, buses, trucks, bicycles, and pedestrians.
4. **ByteTrack Object Tracking**: Persistent integer tracking IDs with Kalman filter motion prediction and two-stage IoU association.
5. **Virtual Line-Crossing Counting**: Directional collision counting at configurable line positions (default: 55% of video height) with single-count deduplication per track.
6. **Weighted Vehicle Congestion Analysis**:
   - Car: 1.0, Motorcycle: 0.5, Bus: 2.5, Truck: 2.0, Bicycle: 0.4
   - Distinct separation of pedestrian counts from vehicular traffic.
   - 4-Tier classification: NO DATA, LOW (1–5), MODERATE (6–15), HIGH (> 15).
7. **Rolling 5-Minute ML Prediction**:
   - Feature engineering: `vehicle_count`, `mean_1m` (6 samples), `mean_3m` (18 samples), `trend_1m` (shift 5).
   - Comparative model evaluation between Linear Regression (OLS) and Random Forest Regressor.
   - Minimum MAE model selection and automated retraining.
8. **Automated Incident Alerts**:
   - Rate-limited notification engine with 60-second cooldown or immediate trigger on congestion level change.
9. **MongoDB 9.0 Persistence**: Indexed document collections replacing legacy CSV files.

---

## 🏗️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS | Enterprise Smart City Dashboard |
| **Icons & Charts** | Lucide React, Recharts | Interactive SVG telemetry |
| **Backend API** | Node.js, Express.js | Modular REST API service layer |
| **Real-time Pipeline**| Socket.IO | Bidirectional WebSocket frame streaming |
| **Database** | MongoDB 9.0, Mongoose | Sub-second historical indexing |
| **Inference Engine** | ONNX Runtime Node (`onnxruntime-node`)| YOLOv8n ONNX inference |
| **Tracker** | ByteTrack | Multi-object tracking state machine |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18+ (Node v24.21.0 recommended)
- **MongoDB**: Community Server v7.0 or v9.0 running on `localhost:27017`

---

### 2. Start MongoDB Database

If MongoDB is not running as a Windows service, start it pointing to the local data directory:

```powershell
& "C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe" --dbpath "backend\data\db" --bind_ip 127.0.0.1 --port 27017
```

---

### 3. Start Node.js Backend Server

Open a terminal in the root directory:

```powershell
cd backend
npm install
npm run seed     # Seeds existing CSV history into MongoDB (one-time)
npm start        # Starts server on http://localhost:5000
```

The backend server exposes:
- **REST API**: `http://localhost:5000/api`
- **Socket.IO**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/api/health`

---

### 4. Start React Frontend Dashboard

Open a second terminal in the root directory:

```powershell
cd frontend
npm install
npm run dev
```

Open your browser at:
👉 **`http://localhost:5173`**

---

## 🖥️ Application Pages

1. **Overview Dashboard** (`/`): Executive campus traffic KPIs, live detection vs crossings, and traffic flow timeline.
2. **Live Camera Monitoring** (`/live-camera`): Live video view with YOLOv8 bounding boxes, tracking IDs, counting line overlay, and camera switcher.
3. **Traffic Analytics** (`/analytics`): Vehicle category distribution pie charts, cumulative crossing bars, and historical time-series tables.
4. **Congestion Monitoring** (`/congestion`): Numerical congestion score gauge, vehicle weight multipliers, and status indicators.
5. **Future Prediction** (`/prediction`): 5-minute traffic forecast, Linear Regression vs Random Forest MAE benchmarks, and feature inspection.
6. **Traffic Alerts** (`/alerts`): Severity-classified incident alerts, 60-second rate-limiting policy, and alert logs.
7. **Camera Management** (`/cameras`): Register, edit, and configure USB camera indexes and Sparsh IP CCTV RTSP endpoints.
8. **System Settings** (`/settings`): Configure virtual line height ratio (default: 55%), thresholds, and vehicle weights.

---

## 🐳 5G Edge Server Containerized Deployment (Non-Sudo / Rootless Docker)

For production deployment on Linux 5G Multi-access Edge Computing (MEC) servers without `sudo` or `root` privileges:

### 1. One-Click Non-Sudo Deployment
Ensure Rootless Docker or Podman is active, then run:

```bash
chmod +x deploy-non-sudo.sh backend/docker-entrypoint.sh
./deploy-non-sudo.sh
```

### 2. Manual Docker Compose Deployment

```bash
# 1. Export unprivileged user UID & GID
export APP_UID=$(id -u)
export APP_GID=$(id -g)

# 2. Create host persistence directories with non-root write permissions
mkdir -p data/mongo data/uploads backend/models backend/data/seed
chmod -R 775 data

# 3. Build and launch services in background
docker compose build --pull
docker compose up -d

# 4. Verify system health
curl -s http://localhost:5000/api/health
curl -s -X POST http://localhost:5000/api/predictions/train
```

### 3. Edge Access URLs

| Service | Protocol & Port | URL | Description |
| :--- | :--- | :--- | :--- |
| **Frontend UI (HTTP)** | HTTP `8080` | `http://<5G_SERVER_IP>:8080` | Production React 19 dashboard via Nginx |
| **Frontend UI (HTTPS)** | HTTPS `8443` | `https://<5G_SERVER_IP>:8443` | Secure context for remote webcam (`getUserMedia`) |
| **Backend REST API** | HTTP `5000` | `http://<5G_SERVER_IP>:5000/api` | Express REST API endpoints |
| **WebSocket Engine** | WS `5000` | `ws://<5G_SERVER_IP>:5000` | Real-time Socket.IO frame streaming |
| **MongoDB** | TCP `27017` | `127.0.0.1:27017` | Database persistence |

### 4. Background Persistence Without Sudo (Keep-Alive on SSH Logout)
On systemd-managed Linux 5G servers, enable lingering so containers remain running after disconnecting SSH:

```bash
loginctl enable-linger $USER
```

---

## 🧪 Testing & Validation

### API Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
```

### Trigger ML Model Retraining
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/predictions/train"
```

### Test Production Build
```powershell
cd frontend
npm run build
```

---

## 📂 Legacy Python Project Preservation

The original Python/Streamlit implementation is safely preserved in:
`5G_Smart_Campus_Traffic_Dual_Input/`
It remains completely functional and untouched.
