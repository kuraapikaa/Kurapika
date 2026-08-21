# Railway’de deploy

Bu proje Railway’de **Dockerfile** ile build edilir. Client (Vite/React) ve server (Fastify) tek container’da çalışır.

## Adımlar

1. **Railway’e bağla**  
   [railway.app](https://railway.app) → New Project → Deploy from GitHub repo (veya CLI ile `railway link`).

2. **Root directory**  
   Repo kökü (`TOP`) kullanılmalı. Dockerfile ve `railway.json` burada.

3. **Ortam değişkenleri**  
   Railway Dashboard → Service → Variables’a en az şunları ekleyin:
   - `AUTH_TOKEN` veya `DASHBOARD_AUTH` — BetConstruct Dashboard API token (zorunlu)
   - İsteğe bağlı: `ADMIN_USER`, `ADMIN_PASS` (giriş sayfası; varsayılan: admin / 123456)  
   Detay için `.env.example` dosyasına bakın.

4. **Deploy**  
   Push sonrası otomatik build/deploy çalışır.  
   Health check: `/api/health` (railway.json’da tanımlı).

5. **Domain**  
   Service → Settings → Generate Domain ile public URL alın.

## Notlar

- **PORT** Railway tarafından atanır; uygulama `process.env.PORT` kullanır.
- Build: Dockerfile ile client + server build, tek image’da `node dist/index.js` (server) çalışır; static dosyalar `/app/client/dist`’ten servis edilir.
## PostgreSQL ve Redis

Production deploy artık iki bağlı servis gerektirir:

1. Railway projesine PostgreSQL ekleyin ve uygulama servisine `DATABASE_URL` referansını bağlayın.
2. Railway projesine Redis ekleyin ve uygulama servisine `REDIS_URL` referansını bağlayın.
3. İlk deploy öncesi veya bakım terminalinde mevcut JSON verilerini içe aktarın:

```bash
npm run migrate:storage --prefix server
```

`DATABASE_REQUIRED=true` ve `REDIS_REQUIRED=true` kullanın. Bağlantılardan biri hazır değilse production sunucusu başlamaz; bu davranış verinin sessizce geçici diske veya process belleğine düşmesini engeller. Ayrıntılar `PERSISTENCE.md` dosyasındadır.
