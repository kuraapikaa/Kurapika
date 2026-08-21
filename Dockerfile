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

# CHROMIUM KALDIRILDI.
#
# Imaj `apk add chromium` ile ~300 MB Chromium kuruyor ve `whatsapp-web.js`
# (Puppeteer) bagimliligini tasiyordu. Kaynak kodda o paketi IMPORT EDEN
# TEK BIR SATIR YOK: WhatsApp modulu yalnizca GELISTIRME-FIKIRLERI.md
# icinde bir fikir olarak duruyor, uygulanmamis.
#
# Bedeli her deploy'da odeniyordu: buyuk imaj, uzun build (Railway build
# dakikasi faturaliyor), fazladan disk ve indirme. DEPLOY-RAILWAY-
# CLOUDFLARE.md zaten bunu oneriyordu, yapilmamisti.
#
# WhatsApp modulu gercekten yazilirsa geri gelmesi gerekenler:
#   RUN apk add --no-cache chromium
#   ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
#   ENV WHATSAPP_DATA_DIR=/data
# ve `server/package.json` icine `whatsapp-web.js`.

# Build arg and env
ENV NODE_ENV=production
ENV PORT=3750

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

CMD ["node", "dist/index.js"]
