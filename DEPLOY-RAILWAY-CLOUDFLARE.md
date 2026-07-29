# Yayına Alma: Railway + Cloudflare — narcosbahis.vip

Bu doküman bu projeye ve bu domaine özel; genel bir rehber değil. Değerler kodda doğrulandı.

## Mevcut durum (2026-07-27 tespiti)

| Kontrol | Sonuç |
|---|---|
| Nameserver'lar | `gigi.ns.cloudflare.com`, `damiete.ns.cloudflare.com` — Cloudflare'da ✓ |
| Zone | Aktif, DNS çözülüyor ✓ |
| Kök + `www` | Cloudflare proxy IP'lerine çözülüyor (`104.21.63.243`, `172.67.173.94`) ✓ |
| HTTP yanıtı | **530 — `error code: 1033`** ✗ |

**1033 = Cloudflare Tunnel hatası.** DNS kayıtları bir Cloudflare Tunnel'a bakıyor ama
tünel bağlayıcısı çalışmıyor (bu makinede `~/.cloudflared` yok — tünel başka bir yerde
kurulmuş ya da silinmiş, DNS kayıtları öksüz kalmış).

Railway'e geçtiğimiz için bu kayıtlar **tünel yerine Railway'i göstermeli**. Aşağıdaki
2.3 adımı bunu anlatıyor.

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
CORS_ORIGIN=https://narcosbahis.vip
FRAME_ANCESTORS=https://narcosbahis.vip

SESSION_SECRET=<en az 64 karakter — .env.production.NEW>
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_PARTITIONED=true
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
> `FRAME_ANCESTORS` dolu olduğunda panel ana sitede **iframe** içinde çalışır ve
> tarayıcı için istekler cross-site sayılır. `SESSION_COOKIE_SAMESITE=lax`
> bırakılırsa oturum çerezi hiç gönderilmez: kullanıcı adı doğrulaması başarılı
> görünür ama çark/kazı-kazan "Önce kullanıcı adı doğrulaması yapmalısınız",
> bonus talebi ise "Oturum süreniz dolmuş." döner. Bu senaryoda `none` + `Secure`
> zorunludur (değişken boş bırakılırsa uygulama zaten `none`'a düşer).
>
> **`SameSite=none` tek başına yetmez.** Chrome üçüncü taraf çerezleri
> engellediğinde gömülü panelde çerez hiç gönderilmez — istekte `cookie` başlığı
> olmaz ve tarayıcı `Sec-Fetch-Storage-Access: none` der. Belirti `lax` ile
> birebir aynıdır, bu yüzden karıştırması kolaydır. Çözüm `Partitioned` (CHIPS):
> çerez üst seviye siteye göre bölümlenir, her gömen alan adı kendi oturumunu
> tutar. Açılış logunda doğrulayın:
>
> ```
> [session] cerez: sameSite=none secure=true partitioned=true gomulu=true
> ```

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

Cloudflare Dashboard → narcosbahis.vip → durum **Active** olmalı. `Pending Nameserver Update` görünüyorsa propagasyon sürüyor (5 dk – 24 sa). Kontrol:

```bash
dig +short NS narcosbahis.vip
```

Cloudflare nameserver'ları dönmeli.

### 2.2 Railway'de custom domain

Railway → uygulama servisi → **Settings → Networking → Custom Domain** → domainini gir.
Railway sana bir CNAME hedefi verir (`xxx.up.railway.app`). Bunu not al.

### 2.3 DNS kaydı — önce mevcut tünel kaydını temizle

Şu an kök ve `www` bir Cloudflare Tunnel'a bakıyor ve tünel çalışmadığı için 1033
veriyor. Cloudflare → **DNS → Records**:

1. Kök (`narcosbahis.vip`) ve `www` kayıtlarını bul. Hedefleri büyük ihtimalle
   `<uuid>.cfargotunnel.com` görünecek.
2. Bu kayıtları **sil** (ya da hedefini aşağıdaki Railway adresiyle değiştir).
3. Yerlerine şunları ekle:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | `xxx.up.railway.app` | Proxied 🟠 |
| CNAME | `www` | `xxx.up.railway.app` | Proxied 🟠 |

Kök domain için CNAME → Cloudflare bunu CNAME flattening ile çözer, sorun değil.

> **Zero Trust tarafını da temizle:** Tünel artık kullanılmayacaksa
> [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Networks → Tunnels**
> altındaki eski tüneli sil. Bırakılırsa ileride DNS'i geri çalabilir.

Doğrulama (kayıt değişikliğinden 1-2 dk sonra):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://narcosbahis.vip/api/health   # 200 bekleniyor
```

`530` görüyorsan hâlâ tünele bakıyor; `521/522` görüyorsan Railway ayakta değil.

### 2.4 SSL

**SSL/TLS → Overview → Full (strict)**. Railway geçerli sertifika sunuyor, `Flexible` seçme — tarayıcı ile Cloudflare arası şifreli olur ama Cloudflare ile Railway arası açık kalır.

**SSL/TLS → Edge Certificates**:
- Always Use HTTPS: **On**
- Minimum TLS Version: **1.2**
- Automatic HTTPS Rewrites: **On**

### 2.5 Uygulama tarafını hizala

Domain kesinleşince Railway'de güncelle ve yeniden deploy et:

```
CORS_ORIGIN=https://narcosbahis.vip
FRAME_ANCESTORS=https://narcosbahis.vip
```

Bunlar yanlışsa panel açılır ama API çağrıları CORS'tan düşer.

---

## 3. Yayın sonrası kontrol listesi

- [ ] `https://narcosbahis.vip/api/health` → `ok:true`
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
