# Arayüz ve sunucu TEK imajda.
#
# İkisini ayrı servis olarak dağıtmak da mümkündü ama iki alan adı, CORS
# ve çerez `sameSite` ayarlarıyla uğraşmak demek. Aynı köken en az
# hareketli parça; panel tek kutuya sığacak boyutta.

# Sunucu bagimliliklari iki katman tarafindan da kullaniliyor: sunucu
# kendi derlemesi icin, arayuz ise tip sozlesmesini cozebilmek icin.
# Tek yerde kurulup paylasiliyor.
FROM node:22-alpine AS sunucu-bagimliliklar
WORKDIR /yapi/backend
COPY backend/package*.json ./
RUN npm ci

FROM sunucu-bagimliliklar AS sunucu
COPY backend/ ./
RUN npm run build

FROM node:22-alpine AS arayuz
WORKDIR /yapi/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Arayuzun tipleri sunucu kaynagindan geliyor: `@sunucu/*` takma adi
# ../backend/src'e bakiyor (tsconfig.json + vite.config.ts). Yalnizca
# `import type` kullaniliyor, yani buradan pakete HICBIR kod girmiyor --
# ama `tsc -b` sozlesmeyi okurken sunucu kaynagini da programa aliyor;
# bu da hem dosyalari hem onlarin @types/node'unu gerektiriyor.
# Ikisi de yoksa derleme TS2307 ile duser.
COPY backend/src /yapi/backend/src
COPY --from=sunucu-bagimliliklar /yapi/backend/node_modules /yapi/backend/node_modules
# Vite ciktisi ../backend/genel'e yaziliyor (vite.config.ts); ust dizini
# yukaridaki COPY zaten olusturuyor.
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
