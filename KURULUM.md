# Kurulum Yönergeleri

Bu proje React/Vite istemcisi ve Fastify/TypeScript API sunucusundan oluşur. Komutlar Windows PowerShell için verilmiştir; macOS/Linux üzerinde `npm.cmd` yerine `npm` kullanabilirsiniz.

## Gereksinimler

- Node.js 20 veya üzeri
- npm 10 veya üzeri
- PostgreSQL 14 veya üzeri
- İsteğe bağlı: Redis 6 veya üzeri (çoklu instance, önbellek ve oturum sürekliliği için önerilir)
- Lynon/BetConstruct erişimi için yetkili backoffice hesabı veya API tokenı

Sürümleri kontrol edin:

```powershell
node --version
npm.cmd --version
```

## 1. Kaynak kodu alın

```powershell
git clone REPO_URL
cd narco-panel
```

## 2. Bağımlılıkları kurun

Kök kurulum komutu istemci ve sunucu bağımlılıklarını da yükler:

```powershell
npm.cmd install
```

Kurulumun bölümler halinde yapılması gerekirse:

```powershell
npm.cmd install --prefix client
npm.cmd install --prefix server
```

## 3. Ortam dosyasını hazırlayın

```powershell
Copy-Item .env.example .env
```

`.env` içindeki örnek değerleri kendi güvenli değerlerinizle değiştirin. En az şu alanları yapılandırın:

```env
NODE_ENV=development
PORT=3750
CORS_ORIGIN=http://localhost:5173
SESSION_SECRET=EN_AZ_64_KARAKTER_RASTGELE_DEGER
MASTER_USER=YONETICI_KULLANICI_ADI
MASTER_PASS=GUCLU_YONETICI_PAROLASI
LYNON_ENABLED=true
LYNON_SITE_ID=137
LYNON_CURRENCY=TRY
LYNON_PANEL_USERNAME=BACKOFFICE_KULLANICI_ADI
LYNON_PANEL_PASSWORD=BACKOFFICE_PAROLASI
LYNON_PANEL_OTP_SECRET=TOTP_SECRET
DATABASE_URL=postgresql://KULLANICI:PAROLA@localhost:5432/narco_panel
REDIS_URL=redis://localhost:6379
```

Lynon girişi kullanılmıyorsa `AUTH_TOKEN`, `DASHBOARD_AUTH` veya `BACKOFFICE_AUTH` seçeneklerinden uygun olanı tanımlayın. Üretimde `SESSION_SECRET` en az 64 karakter olmalı, `CORS_ORIGIN` yalnızca gerçek panel alan adını içermeli ve `PANEL_AUTH_DISABLED=false` kalmalıdır.

Rastgele session anahtarı üretmek için:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> `.env`, oturum JSON dosyaları, loglar ve oyuncu/tenant çalışma verileri Git tarafından dışlanır. Bunları hiçbir zaman repoya eklemeyin.

## 4. Veritabanını hazırlayın

PostgreSQL veritabanını oluşturup `DATABASE_URL` değerini ayarladıktan sonra mevcut JSON verilerini taşımak gerekiyorsa:

```powershell
npm.cmd run migrate:storage --prefix server
```

Kalıcı veri mimarisi ve Railway volume seçenekleri için `PERSISTENCE.md` dosyasına bakın.

## 5. Geliştirme ortamını çalıştırın

```powershell
npm.cmd run dev
```

- Panel: `http://localhost:5173`
- API: `http://localhost:3750`
- Sağlık kontrolü: `http://localhost:3750/api/health`

Sadece bir katmanı çalıştırmak için:

```powershell
npm.cmd run start:client
npm.cmd run start:server
```

## 6. Kontroller

```powershell
npm.cmd run typecheck --prefix server
npm.cmd run test --prefix server
npm.cmd run test:run --prefix client
```

## 7. Production

```powershell
npm.cmd run build
npm.cmd start
```

Production ortamında:

- `NODE_ENV=production` kullanın.
- HTTPS zorunlu olsun.
- `CORS_ORIGIN` değerini tek ve doğrulanmış panel domainiyle sınırlandırın.
- PostgreSQL ve Redis’i private network üzerinden bağlayın.
- Backoffice kimlik bilgilerini `.env` dosyası yerine hosting sağlayıcısının secret manager alanında saklayın.
- Kalıcı volume ve yedekleme politikasını etkinleştirin.

Railway kurulumu için `RAILWAY.md`, güvenlik kontrol listesi için `SECURE_DEPLOY.md` dosyasını kullanın.

## Sorun giderme

- `npm` PowerShell tarafından bulunamazsa `npm.cmd` kullanın.
- 5173 portu doluysa eski Vite/Node sürecini kapatın veya Vite portunu değiştirin.
- API bağlantısı başarısızsa önce `/api/health`, sonra `.env` içindeki CORS, token ve backoffice bilgilerini kontrol edin.
- Lynon oturumu sık düşüyorsa sunucu saatini Europe/Istanbul (UTC+3) olarak doğrulayın ve TOTP secret/token ayarlarını kontrol edin.