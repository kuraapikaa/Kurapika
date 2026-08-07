# Arayüz ve sunucu TEK imajda.
#
# İkisini ayrı servis olarak dağıtmak da mümkündü ama iki alan adı, CORS
# ve çerez `sameSite` ayarlarıyla uğraşmak demek. Aynı köken en az
# hareketli parça; panel tek kutuya sığacak boyutta.

FROM node:22-alpine AS arayuz
WORKDIR /yapi/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Vite ciktisi ../backend/genel'e yaziliyor (vite.config.ts).
RUN mkdir -p /yapi/backend && npm run build

FROM node:22-alpine AS sunucu
WORKDIR /yapi/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /uygulama
ENV NODE_ENV=production

COPY backend/package*.json ./
# Yalnizca uretim bagimliliklari: derleyici ve test araclari imajda
# durmasin.
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=sunucu /yapi/backend/dist ./dist
COPY --from=arayuz /yapi/backend/genel ./genel

EXPOSE 4100
CMD ["node", "dist/index.js"]
