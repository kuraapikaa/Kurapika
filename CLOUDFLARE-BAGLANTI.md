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
