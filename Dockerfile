# --- Stage 1: Build Frontend ---
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci 2>/dev/null || npm install
COPY client/ ./
RUN npm run build

# --- Stage 2: Build Backend ---
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci 2>/dev/null || npm install
COPY server/ ./
RUN npm run build

# --- Stage 3: Production Runtime ---
FROM node:20-alpine
WORKDIR /app

# Chromium for whatsapp-web.js (Puppeteer)
RUN apk add --no-cache chromium

# Build arg and env
ENV NODE_ENV=production
ENV PORT=3750
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Temsilci/lead verileri kalıcı olsun: volume mount ile /data kullanın (örn. -v whatsapp-data:/data)
ENV WHATSAPP_DATA_DIR=/data

# Copy server build and dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY --from=server-builder /app/server/dist ./dist

# Copy client build to the location server expects (../../client/dist)
WORKDIR /app/client
COPY --from=client-builder /app/client/dist ./dist

# Final working directory is server
WORKDIR /app/server

EXPOSE 3750

# Kalıcı veri: Railway'de Volume ekleyip WHATSAPP_DATA_DIR mount path'ine ayarlayın (örn. /data)

CMD ["node", "dist/index.js"]
