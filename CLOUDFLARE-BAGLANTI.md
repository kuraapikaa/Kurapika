# Cloudflare Nasıl Bağlanır?

Projen Railway veya Render’da yayında. Cloudflare ile iki ana kullanım:

1. **Domain’i Cloudflare DNS ile yönetip uygulamaya yönlendirmek** (en yaygın)
2. **Cloudflare Tunnel** ile sunucuyu Cloudflare üzerinden yayına açmak (opsiyonel)

---

## 1. Domain’i Cloudflare’a Bağlamak (DNS)

### 1.1 Domain’i Cloudflare’e ekleme

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site**.
2. Domain’i yaz (örn. `example.com`) → **Add site**.
3. Plan seç (ücretsiz **Free** yeterli) → **Continue**.
4. Cloudflare, mevcut DNS kayıtlarını tarar; **Continue** de.
5. **Nameservers** ekranında Cloudflare’ın verdiği 2 nameserver’ı görürsün (örn. `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`).

### 1.2 Domain sağlayıcısında nameserver değiştirme

Domain’i aldığın yerde (GoDaddy, Namecheap, Getir, vs.):

- **Nameserver / DNS ayarları** bölümüne gir.
- Varsayılan nameserver’ları **kaldır**.
- Cloudflare’dan kopyaladığın **2 nameserver’ı** ekle ve kaydet.
- Propagasyon 5 dakika – 24 saat sürebilir.

### 1.3 Uygulamayı (Railway/Render) gösterme

Cloudflare Dashboard → **Websites** → siteni seç → **DNS** → **Records**.

| Type  | Name     | Content                    | Proxy |
|-------|----------|----------------------------|-------|
| CNAME | `app`    | `xxx.railway.app` veya `xxx.onrender.com` | Proxied (turuncu bulut) |
| CNAME | `www`    | `xxx.railway.app` veya `xxx.onrender.com` | Proxied |

- **Name:** Alt alan adı. `app` → `app.example.com`, boş bırakırsan `example.com`.
- **Content:** Railway/Render’dan verilen **tek bir adres** olmalı:
  - **Railway:** Project → Settings → Domains → “xxx.railway.app” veya custom domain. Bu adresi CNAME **Content** kısmına yaz.
  - **Render:** Dashboard’da servisin **URL’si** (örn. `xyz.onrender.com`). Aynı şekilde CNAME Content’e yaz.
- **Proxy status:** **Proxied** (turuncu) = trafik Cloudflare’dan geçer (SSL, DDoS koruması).

### 1.4 Railway’da custom domain tanımlama (Cloudflare’a uyumlu)

1. Railway → Proje → **Settings** → **Domains**.
2. **Custom Domain** ekle: Cloudflare’da kullandığın tam adres (örn. `app.example.com`).
3. Railway bir CNAME hedefi verir (örn. `xxx.railway.app`). Cloudflare’daki CNAME **Content** değeri tam olarak bu olmalı.

### 1.5 Render’da custom domain

1. Render → Service → **Settings** → **Custom Domains**.
2. `app.example.com` (veya `www` / root) ekle.
3. Render’ın söylediği CNAME hedefini Cloudflare DNS’te **Content** olarak kullan.

---

## 2. SSL (HTTPS)

- **Proxy: Proxied** kullanıyorsan Cloudflare otomatik HTTPS verir (Full veya Full Strict).
- Cloudflare Dashboard → **SSL/TLS** → **Overview**: **Full** veya **Full (strict)** seç (Railway/Render zaten HTTPS veriyorsa Full yeterli).

---

## 3. Özet Akış

```
[Kullanıcı] → app.example.com (Cloudflare DNS)
    → Cloudflare (proxy, SSL)
    → Railway/Render gerçek adresi (xxx.railway.app / xxx.onrender.com)
    → Uygulaman (Node + React)
```

---

## 4. Cloudflare Tunnel (Opsiyonel)

Kendi sunucunda (VPS / ev) çalışan uygulamayı port açmadan Cloudflare üzerinden yayına almak için:

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com) → **Networks** → **Tunnels**.
2. **Create a tunnel** → **cloudflared** kur (sunucunda).
3. Tunnel’a **Public Hostname** ekle: `app.example.com` → **http://localhost:3750** (veya senin portun).
4. Artık trafik: İnternet → Cloudflare → Tunnel → senin makinedeki `localhost:3750`.

Bu yöntemde DNS’i yine Cloudflare’da yönetirsin; CNAME’i tunnel’a yönlendirirsin.

---

## Hızlı Kontrol Listesi

- [ ] Domain Cloudflare’a eklendi, nameserver’lar domain sağlayıcıda güncellendi.
- [ ] DNS’te CNAME: `app` (veya www) → Railway/Render adresi, **Proxied**.
- [ ] Railway/Render tarafında custom domain olarak `app.example.com` tanımlı.
- [ ] SSL/TLS: Full veya Full (strict).

Bu adımlarla “Cloudflare’a bağlanmış” olursun: domain Cloudflare’da, trafik Cloudflare’dan geçer, uygulama Railway/Render’da çalışır.

---

# BU PROJEYE ÖZGÜ AYARLAR

Yukarıdaki adımlar her proje için geçerli. Aşağıdakiler **bu panele özgü** ve
birkaçı üretimde canlı arızayla öğrenildi — atlanırsa aynı arızalar geri gelir.

## 1. SSL/TLS: **Full (strict)** — "Full" değil

Railway geçerli sertifika sunuyor. `Full` (strict olmayan) kendinden imzalı
sertifikayı da kabul eder, yani Cloudflare ile origin arasındaki bacak
doğrulanmaz. `Flexible` ise **kesinlikle kullanılmamalı**: origin HTTPS
beklerken Cloudflare HTTP konuşur ve sonsuz yönlendirme döngüsü oluşur.

## 2. `/api/*` için **Bypass cache** kuralı — en kritik madde

> **Rules → Cache Rules → Create**
> `(http.request.uri.path contains "/api/")` → **Bypass cache**

Kod zaten her `/api` yanıtına `no-store, private` yazıyor. Buna rağmen bu
kuralı AÇIKÇA koyun, çünkü üretimde şu yaşandı:

`/api/bonus-panel/me` oturum sahibinin kimliğini döndürüyor. Yanıtta
`Cache-Control` yokken Cloudflare bu ucu önbelleğe aldı (`cf-cache-status:
EXPIRED` ile doğrulandı) ve **TEK girdiyi tüm ziyaretçilere servis etti** —
bir oyuncu lobide BAŞKA bir oyuncunun kullanıcı adıyla doğrulanmış göründü.

## 3. `Vary` başlığına güvenmeyin

**Ölçüldü:** Cloudflare `Accept-Encoding` dışındaki `Vary` değerlerini
önbellekleme için **yok sayıyor**. `Vary: Cookie` ya da `Vary: Referer`
yazmak yanıtı ayrıştırmaz.

Bunun somut sonucu: `FRAME_ANCESTOR_PATTERNS` kullanılırsa CSP başlığı istek
başına değişir, ama önbellekteki kopya onu **ilk dolduran** isteğin listesini
taşır; ana sitenin adresi döndüğünde tarayıcı çerçeveyi reddeder. Bu yüzden
CDN arkasında **`FRAME_ANCESTOR_RANGE`** kullanılıyor — liste her istekte
aynı olduğu için önbelleklenmesi zararsız.

## 4. Statik varlıklarda ad değişmeden içerik değiştirmeyin

Sunucu, dosya adında içerik hash'i varsa bir yıllık `immutable` veriyor.
Hash tespiti bir desene bakıyor ve **tirenin ardından 8+ karakter** gören her
adı hash'li sanıyor:

    grand-casino-login.jpg   -> "casino-login" 12 karakter -> immutable, 1 YIL
    bugs-logo.png            -> "logo" 4 karakter          -> max-age=3600

Yani elle konmuş bir görseli **aynı adla** değiştirirseniz kimse yenisini
görmez. İki çözüm: dosya adını değiştirin, ya da Cloudflare'da
**Purge Cache → Custom Purge** ile o URL'i temizleyin.

## 5. Kapatılması gerekenler

- **Rocket Loader**: script yükleme sırasını değiştirir, React uygulamasını
  bozabilir. Kapalı olsun.
- **Auto Minify**: derlenmiş çıktı zaten küçültülmüş; ikinci kez işlemek
  fayda getirmez.
- **Email Obfuscation**: panel HTML'ine script enjekte eder; CSP
  `script-src 'self'` olduğu için o script ENGELLENİR ve konsola hata düşer.

## 6. Domain değişince güncellenecek değişkenler

| Değişken | Değer |
|---|---|
| `CORS_ORIGIN` | `https://<panel-adresi>` — `*` veya `true` KULLANMAYIN |
| `FRAME_ANCESTOR_RANGE` | Paneli gömen ana sitelerin aralığı |

`CORS_ORIGIN` panelin kendi adresi, `FRAME_ANCESTOR_RANGE` ise onu **gömen**
sitelerin adresi. İkisi farklı şeyler; karıştırmak "panel açılıyor ama
iframe'de boş" ya da "istekler CORS'tan düşüyor" olarak görünür.

## 7. Bağlantı sonrası doğrulama

```bash
# API önbelleğe alınmamalı: BYPASS ya da DYNAMIC bekleriz
curl -sI https://<adres>/api/health | grep -i cf-cache-status

# SPA kabuğu da önbelleğe alınmamalı
curl -sI https://<adres>/ | grep -iE "cf-cache-status|cache-control"

# Kiracı kaydı var mı (yoksa bütün siteler default'a çöker)
curl -s https://<adres>/api/health | grep -o '"tenants":{[^}]*}'
```
