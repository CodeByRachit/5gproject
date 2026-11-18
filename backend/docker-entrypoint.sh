#!/bin/sh
set -e

echo "=================================================================="
echo "🚀 5G Smart Campus Traffic Monitoring - Backend Starting Up"
echo "=================================================================="

TARGET_MONGO="${MONGO_URI:-${MONGODB_URI:-mongodb://mongodb:27017/smart_campus_traffic}}"
echo "[Entrypoint] Target MongoDB: $TARGET_MONGO"

# Wait for MongoDB using dedicated probe
echo "[Entrypoint] Waiting for MongoDB to become ready..."
node src/utils/waitForMongo.js

# Automatically seed initial camera configurations, system settings, and CSV history
echo "[Entrypoint] Verifying database seeding status..."
npm run seed || echo "[Entrypoint] Seed check completed."

echo "=================================================================="
echo "📡 Launching Express + Socket.IO Server"
echo "=================================================================="
exec "$@"
