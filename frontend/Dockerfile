# ==============================================================================
# Stage 1: Build React 19 Frontend with Vite
# ==============================================================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies for build
RUN npm ci

# Copy application source files
COPY . .

# Build production distribution assets
RUN npm run build

# ==============================================================================
# Stage 2: Serve via Unprivileged Nginx with Automated Self-Signed SSL
# ==============================================================================
FROM nginxinc/nginx-unprivileged:alpine

# Temporarily switch to root during build to generate self-signed SSL certs
USER root

RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/certs/selfsigned.key \
      -out /etc/nginx/certs/selfsigned.crt \
      -subj "/C=IN/ST=Campus/L=5GLab/O=SmartCampus/OU=EdgeComputing/CN=5g-smart-campus" && \
    chmod 644 /etc/nginx/certs/selfsigned.crt /etc/nginx/certs/selfsigned.key && \
    chown -R 101:101 /etc/nginx/certs /usr/share/nginx/html

# Drop privileges permanently to unprivileged nginx user (UID 101)
USER 101

# Copy custom Nginx reverse proxy configuration
COPY --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder --chown=101:101 /app/dist /usr/share/nginx/html

# Expose unprivileged HTTP (8080) and HTTPS (8443) ports
EXPOSE 8080 8443

# Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080 || exit 1

CMD ["nginx", "-g", "daemon off;"]
