# Yayına Alma: Railway + Cloudflare

Bu doküman bu projeye özel; genel bir rehber değil. Değerler kodda doğrulandı.

## Mimari — neden Cloudflare tek başına yetmiyor

Cloudflare Workers/Pages bu uygulamayı **çalıştıramaz**. Sunucu şunlara ihtiyaç duyuyor:

| Gereksinim | Neden | Kaynak |
|---|---|---|
| PostgreSQL | `DATABASE_URL production ortamında zorunludur` | `server/src/lib/database.ts` |
| Redis | `Production session store için Redis bağlantısı zorunludur` | `server/src/app.ts` |
| Chromium | `whatsapp-web.js` (Puppeteer) | `Dockerfile` |
| Kalıcı disk | `WHATSAPP_DATA_DIR` oturum verisi | `Dockerfile` |

Bunların hiçbiri Workers runtime'ında mümkün değil. Doğru dağılım:

```
Kullanıcı → Cloudflare (DNS + SSL + WAF/proxy) → Railway (Docker: Node + Chromium)
                                                    ├── Railway PostgreSQL
                                                    └── Railway Redis
```

Cloudflare = trafik katmanı. Railway = uygulamanın kendisi.

---

## 1. Railway servisleri

### 1.1 Projeyi bağla

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → `Dvppels-dev/Narcos-Taco`.
2. Railway `railway.json`'ı okur: `DOCKERFILE` builder, healthcheck `/api/health` (30 sn).
3. İlk deploy env değişkenleri olmadan **başarısız olur** — normal, önce 1.2 ve 1.3'ü yap.

### 1.2 Veritabanı ve Redis ekle

Aynı proje içinde **+ New** →

- **Database → PostgreSQL** → oluşur, `DATABASE_URL` referansı verir.
- **Database → Redis** → oluşur, `REDIS_URL` referansı verir.

Uygulama servisinin **Variables** sekmesinde bunları referansla bağla (elle kopyalama, Railway'in `${{Postgres.DATABASE_URL}}` sözdizimi parola döndüğünde kendini günceller):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

### 1.3 Kalıcı disk

Uygulama servisi → **Settings → Volumes → New Volume**
- Mount path: `/data`

`Dockerfile` zaten `WHATSAPP_DATA_DIR=/data` tanımlıyor. Volume olmazsa her deploy'da WhatsApp oturumu sıfırlanır.

### 1.4 Değişkenler

`.env.production.NEW` dosyasındaki üretilmiş sırları buraya yapıştır. Zorunlu olanlar:

```
NODE_ENV=production
PORT=3750
CORS_ORIGIN=https://SENIN-DOMAIN
FRAME_ANCESTORS=https://SENIN-DOMAIN

SESSION_SECRET=<en az 64 karakter — .env.production.NEW>
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax
SESSION_TTL_MS=86400000

MASTER_USER=<...>
MASTER_PASS=<.env.production.NEW>
ADMIN_USER=<...>
ADMIN_PASS=<.env.production.NEW>
PANEL_AUTH_DISABLED=false

DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_REQUIRED=true
DATABASE_SSL=true
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_REQUIRED=true
REDIS_KEY_PREFIX=narcos:

LYNON_ENABLED=true
LYNON_BACKOFFICE_BASE_URL=<...>
LYNON_ID_BASE_URL=<...>
LYNON_SITE_ID=137
LYNON_CURRENCY=TRY
LYNON_PANEL_USERNAME=<...>
LYNON_PANEL_PASSWORD=<YENİ — döndürüldükten sonra>
LYNON_PANEL_OTP_SECRET=<YENİ — döndürüldükten sonra>

TOKEN_UPDATE_SECRET=<.env.production.NEW>
ENABLE_DOCS=false
RATE_LIMIT_MAX=100
```

> `SESSION_SECRET` 64 karakterden kısaysa uygulama açılışta hata verip durur.
> `ENABLE_DOCS=false` — API dokümanını herkese açık bırakma.

### 1.5 Deploy'u doğrula

Railway → **Deployments → View Logs**. Beklenen satırlar:

```
[database] PostgreSQL bağlantısı ve şema hazır.
[redis] Session ve ortak cache bağlantısı hazır.
Server listening at http://0.0.0.0:3750
Lynon gateway configured (site 137).
```

Sonra Railway'in verdiği geçici adreste:

```
https://xxx.up.railway.app/api/health   → {"ok":true,...}
```

`ok:true` gelmeden domain bağlama.

---

## 2. Cloudflare

Nameserver'lar Dynadot'ta zaten Cloudflare'a çevrildi. Kalanlar:

### 2.1 Zone aktif mi

Cloudflare Dashboard → domain → durum **Active** olmalı. `Pending Nameserver Update` görünüyorsa propagasyon sürüyor (5 dk – 24 sa). Kontrol:

```bash
dig +short NS SENIN-DOMAIN
```

Cloudflare nameserver'ları dönmeli.

### 2.2 Railway'de custom domain

Railway → uygulama servisi → **Settings → Networking → Custom Domain** → domainini gir.
Railway sana bir CNAME hedefi verir (`xxx.up.railway.app`). Bunu not al.

### 2.3 DNS kaydı

Cloudflare → **DNS → Records → Add record**:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | `xxx.up.railway.app` | Proxied 🟠 |
| CNAME | `www` | `xxx.up.railway.app` | Proxied 🟠 |

Kök domain için CNAME → Cloudflare bunu CNAME flattening ile çözer, sorun değil.

### 2.4 SSL

**SSL/TLS → Overview → Full (strict)**. Railway geçerli sertifika sunuyor, `Flexible` seçme — tarayıcı ile Cloudflare arası şifreli olur ama Cloudflare ile Railway arası açık kalır.

**SSL/TLS → Edge Certificates**:
- Always Use HTTPS: **On**
- Minimum TLS Version: **1.2**
- Automatic HTTPS Rewrites: **On**

### 2.5 Uygulama tarafını hizala

Domain kesinleşince Railway'de güncelle ve yeniden deploy et:

```
CORS_ORIGIN=https://SENIN-DOMAIN
FRAME_ANCESTORS=https://SENIN-DOMAIN
```

Bunlar yanlışsa panel açılır ama API çağrıları CORS'tan düşer.

---

## 3. Yayın sonrası kontrol listesi

- [ ] `https://SENIN-DOMAIN/api/health` → `ok:true`
- [ ] Panele giriş çalışıyor (Redis oturumu ayakta)
- [ ] Lynon girişi çalışıyor → `/api/health` içinde `lynon.authenticated:true`
- [ ] Lobi ve alt sayfalar açılıyor (`/#/lobi`, `/#/bonus-talep`)
- [ ] Yeniden deploy sonrası oturum kopmuyor (Redis kalıcı)
- [ ] WhatsApp oturumu deploy sonrası duruyor (volume çalışıyor)

## 4. Cloudflare sertleştirme (yayın sonrası)

- **WAF → Managed Rules**: Cloudflare Managed Ruleset açık.
- **Security → Bots**: Bot Fight Mode açık.
- **Rate limiting**: `/api/*` için IP başına dakikada ~100 istek.
- **Access (Zero Trust)**: Admin paneli yolunu e-posta doğrulaması arkasına almayı düşün — uygulama kimlik doğrulamasının üstüne ikinci katman.

---

## Notlar

- **Cloudflare Pages kullanma.** Client'ı ayrı Pages'e koymak API'yi çapraz-origin yapar; sunucu zaten `client/dist`'i kendisi servis ediyor. Tek servis daha basit ve CORS sorunu çıkarmaz.
- **Chromium ~300 MB.** Railway imajı buna göre büyük; WhatsApp özelliğini kullanmıyorsan `Dockerfile`'dan `apk add chromium` satırını ve `whatsapp-web.js` bağımlılığını çıkarmak imajı ciddi küçültür.
- **Yalnızca `main` deploy edilsin.** Railway → Settings → Source → Branch: `main`. Aksi halde her PR dalı production'a gider.
