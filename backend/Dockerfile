# 5G Smart Campus Traffic Monitoring - Backend Dockerfile
# Base Image: Debian Bookworm Slim with glibc for onnxruntime-node
FROM node:22-bookworm-slim

# Install ffmpeg, python3, opencv, numpy, and onnxruntime-node runtime C++ libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-numpy \
    python3-opencv \
    libgomp1 \
    ca-certificates \
    curl \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory and application directories
WORKDIR /app

# Ensure directories exist and are owned by the non-root node user (UID 1000)
RUN mkdir -p /app/uploads /app/models /app/data/seed && \
    chown -R node:node /app

# Copy dependency manifests
COPY --chown=node:node package*.json ./

# Switch to non-root user (UID 1000) for security compliance
USER node

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source code, model weights, seed data, and entrypoint
COPY --chown=node:node src/ ./src/
COPY --chown=node:node models/ ./models/
COPY --chown=node:node data/seed/ ./data/seed/
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    MODEL_PATH=/app/models/yolov8n.onnx \
    SEED_DATA_DIR=/app/data/seed \
    PYTHON_PATH=/usr/bin/python3

# Expose unprivileged backend port
EXPOSE 5000

# Healthcheck endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD node -e "fetch('http://localhost:5000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
